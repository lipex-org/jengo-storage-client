import {
    ChunkPart,
    ChunkedUploadOptions,
    StandardUploadOptions,
    UploadProgress,
    UploadResult,
    UploadStatus,
} from './types.js';
import { calculateSha256, generateFileUuid, sliceFileIntoChunks, DEFAULT_CHUNK_SIZE } from './chunker.js';
import { formatSpeed, SpeedTracker } from './support/speed.js';
import { resolveCsrfToken } from './support/csrf.js';

/**
 * Robust chunked file uploader with concurrent streams, pause/resume, and integrity verification.
 */
export class ChunkedUploader {
    public readonly file: File | Blob;
    public readonly uuid: string;
    public readonly options: Required<Omit<ChunkedUploadOptions, 'metadata' | 'headers'>> & {
        headers?: Record<string, string> | (() => Record<string, string>);
        metadata?: Record<string, unknown>;
    };

    private status: UploadStatus = 'idle';
    private parts: ChunkPart[] = [];
    private uploadedIndexes: Set<number> = new Set();
    private activeRequests: Map<number, XMLHttpRequest> = new Map();
    private bytesUploaded: Map<number, number> = new Map();
    private speedTracker: SpeedTracker = new SpeedTracker();
    private isPausedInternal: boolean = false;
    private isAbortedInternal: boolean = false;
    private resolvePromise: ((res: UploadResult) => void) | null = null;
    private rejectPromise: ((err: Error) => void) | null = null;

    constructor(file: File | Blob, options: ChunkedUploadOptions = {}) {
        this.file = file;
        this.uuid = generateFileUuid();
        this.options = {
            endpoint: options.endpoint ?? '/storage/chunks/upload',
            assembleEndpoint: options.assembleEndpoint ?? '/storage/chunks/assemble',
            abortEndpoint: options.abortEndpoint ?? '/storage/chunks/abort',
            chunkSize: options.chunkSize ?? DEFAULT_CHUNK_SIZE,
            concurrency: Math.max(1, Math.min(options.concurrency ?? 3, 10)),
            retries: Math.max(0, options.retries ?? 3),
            disk: options.disk ?? 'public',
            folder: options.folder ?? 'uploads',
            computeChecksums: options.computeChecksums ?? false,
            headers: options.headers,
            metadata: options.metadata,
            onProgress: options.onProgress ?? (() => {}),
            onSuccess: options.onSuccess ?? (() => {}),
            onError: options.onError ?? (() => {}),
            onStatusChange: options.onStatusChange ?? (() => {}),
        };

        this.parts = sliceFileIntoChunks(this.file, this.options.chunkSize);
    }

    public getStatus(): UploadStatus {
        return this.status;
    }

    public getProgress(): UploadProgress {
        const total = this.file.size;
        let loaded = 0;
        for (const [idx, part] of this.parts.entries()) {
            if (this.uploadedIndexes.has(idx)) {
                loaded += part.blob.size;
            } else {
                loaded += this.bytesUploaded.get(idx) || 0;
            }
        }
        loaded = Math.min(loaded, total);
        const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 100;
        const metrics = this.speedTracker.update(loaded, total);

        return {
            percent,
            loaded,
            total,
            speed: metrics.speedFormatted,
            speedBytesPerSec: metrics.speedBytesPerSec,
            remainingSeconds: metrics.remainingSeconds,
            chunkIndex: this.uploadedIndexes.size,
            totalChunks: this.parts.length,
        };
    }

    private setStatus(newStatus: UploadStatus): void {
        if (this.status !== newStatus) {
            this.status = newStatus;
            this.options.onStatusChange(newStatus);
        }
    }

    public async start(): Promise<UploadResult> {
        if (this.status === 'uploading' || this.status === 'assembling') {
            throw new Error('Upload is already in progress.');
        }

        this.isPausedInternal = false;
        this.isAbortedInternal = false;
        this.setStatus('uploading');

        return new Promise<UploadResult>((resolve, reject) => {
            this.resolvePromise = resolve;
            this.rejectPromise = reject;
            this.processQueue();
        });
    }

    public pause(): void {
        if (this.status !== 'uploading') {
            return;
        }

        this.isPausedInternal = true;
        this.setStatus('paused');

        // Cancel all active in-flight requests
        for (const [idx, xhr] of this.activeRequests.entries()) {
            try {
                xhr.abort();
            } catch {
                // Ignore abort errors
            }
            this.bytesUploaded.set(idx, 0);
        }
        this.activeRequests.clear();
    }

    public resume(): Promise<UploadResult> {
        if (this.status !== 'paused') {
            return Promise.reject(new Error('Cannot resume upload that is not paused.'));
        }

        this.isPausedInternal = false;
        this.setStatus('uploading');

        return new Promise<UploadResult>((resolve, reject) => {
            this.resolvePromise = resolve;
            this.rejectPromise = reject;
            this.processQueue();
        });
    }

    public async abort(): Promise<void> {
        this.isAbortedInternal = true;
        this.setStatus('aborted');

        for (const xhr of this.activeRequests.values()) {
            try {
                xhr.abort();
            } catch {
                // Ignore abort errors
            }
        }
        this.activeRequests.clear();

        // Inform backend to clean staging directory
        try {
            const csrfToken = resolveCsrfToken();
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (csrfToken) {
                headers['X-CSRF-TOKEN'] = csrfToken;
                headers['X-Requested-With'] = 'XMLHttpRequest';
            }

            await fetch(this.options.abortEndpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({ file_uuid: this.uuid }),
            });
        } catch {
            // Ignore backend abort network failures
        }

        if (this.rejectPromise) {
            this.rejectPromise(new Error('Upload was aborted.'));
            this.rejectPromise = null;
        }
    }

    private emitProgress(): void {
        const progress = this.getProgress();
        this.options.onProgress(progress);
    }

    private async processQueue(): Promise<void> {
        if (this.isPausedInternal || this.isAbortedInternal) {
            return;
        }

        // If all chunks uploaded, assemble file
        if (this.uploadedIndexes.size === this.parts.length) {
            if (this.activeRequests.size === 0 && this.status !== 'assembling' && this.status !== 'completed') {
                await this.assembleFinalFile();
            }
            return;
        }

        // Fill pool up to concurrency limit
        while (
            this.activeRequests.size < this.options.concurrency &&
            !this.isPausedInternal &&
            !this.isAbortedInternal
        ) {
            const nextPart = this.parts.find(
                (p) => !this.uploadedIndexes.has(p.index) && !this.activeRequests.has(p.index)
            );

            if (!nextPart) {
                break;
            }

            this.uploadChunk(nextPart);
        }
    }

    private uploadChunk(part: ChunkPart): void {
        const xhr = new XMLHttpRequest();
        this.activeRequests.set(part.index, xhr);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && !this.isPausedInternal) {
                this.bytesUploaded.set(part.index, event.loaded);
                this.emitProgress();
            }
        };

        xhr.onload = async () => {
            this.activeRequests.delete(part.index);

            if (xhr.status >= 200 && xhr.status < 300) {
                this.uploadedIndexes.add(part.index);
                this.bytesUploaded.set(part.index, part.blob.size);
                this.emitProgress();
                this.processQueue();
            } else if (part.retries < this.options.retries && !this.isPausedInternal && !this.isAbortedInternal) {
                part.retries++;
                const backoffMs = Math.min(1000 * Math.pow(2, part.retries), 6000);
                setTimeout(() => {
                    if (!this.isPausedInternal && !this.isAbortedInternal) {
                        this.uploadChunk(part);
                    }
                }, backoffMs);
            } else {
                this.handleError(new Error(`Chunk #${part.index} failed with HTTP ${xhr.status}: ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => {
            this.activeRequests.delete(part.index);
            if (part.retries < this.options.retries && !this.isPausedInternal && !this.isAbortedInternal) {
                part.retries++;
                const backoffMs = Math.min(1000 * Math.pow(2, part.retries), 6000);
                setTimeout(() => {
                    if (!this.isPausedInternal && !this.isAbortedInternal) {
                        this.uploadChunk(part);
                    }
                }, backoffMs);
            } else {
                this.handleError(new Error(`Network error during chunk #${part.index} upload.`));
            }
        };

        xhr.open('POST', this.options.endpoint, true);

        // Headers
        const resolvedHeaders = typeof this.options.headers === 'function'
            ? this.options.headers()
            : this.options.headers ?? {};

        for (const [key, val] of Object.entries(resolvedHeaders)) {
            xhr.setRequestHeader(key, val);
        }

        const csrfToken = resolveCsrfToken();
        if (csrfToken) {
            xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken);
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        }

        xhr.setRequestHeader('X-File-Id', this.uuid);
        xhr.setRequestHeader('X-Chunk-Index', String(part.index));
        xhr.setRequestHeader('X-Total-Chunks', String(this.parts.length));

        // Prepare FormData
        const formData = new FormData();
        formData.append('file_uuid', this.uuid);
        formData.append('chunk_index', String(part.index));
        formData.append('total_chunks', String(this.parts.length));
        formData.append('chunk', part.blob, `part_${part.index}.part`);

        if (this.options.metadata) {
            formData.append('metadata', JSON.stringify(this.options.metadata));
        }

        if (this.options.computeChecksums && part.checksum) {
            formData.append('chunk_checksum', part.checksum);
            xhr.setRequestHeader('X-Chunk-Checksum', part.checksum);
            xhr.send(formData);
        } else if (this.options.computeChecksums) {
            calculateSha256(part.blob).then((hash: string) => {
                part.checksum = hash;
                formData.append('chunk_checksum', hash);
                xhr.setRequestHeader('X-Chunk-Checksum', hash);
                if (!this.isPausedInternal && !this.isAbortedInternal) {
                    xhr.send(formData);
                }
            }).catch(() => {
                if (!this.isPausedInternal && !this.isAbortedInternal) {
                    xhr.send(formData);
                }
            });
        } else {
            xhr.send(formData);
        }
    }

    private async assembleFinalFile(): Promise<void> {
        this.setStatus('assembling');

        try {
            let expectedChecksum = '';
            if (this.options.computeChecksums) {
                expectedChecksum = await calculateSha256(this.file);
            }

            const filename = this.file instanceof File ? this.file.name : 'file_' + Date.now();
            const payload: Record<string, unknown> = {
                file_uuid: this.uuid,
                total_chunks: this.parts.length,
                filename,
                disk: this.options.disk,
                folder: this.options.folder,
                expected_checksum: expectedChecksum,
                metadata: this.options.metadata,
            };

            const csrfToken = resolveCsrfToken();
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            };

            if (csrfToken) {
                headers['X-CSRF-TOKEN'] = csrfToken;
                headers['X-Requested-With'] = 'XMLHttpRequest';
            }

            const resolvedHeaders = typeof this.options.headers === 'function'
                ? this.options.headers()
                : this.options.headers ?? {};

            Object.assign(headers, resolvedHeaders);

            const response = await fetch(this.options.assembleEndpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const msg = errorData.message || `File assembly failed with HTTP ${response.status}`;
                throw new Error(msg);
            }

            const resJson = await response.json();

            const result: UploadResult = {
                status: resJson.status || 'success',
                disk: resJson.disk || this.options.disk,
                path: resJson.path || '',
                filename: resJson.filename || filename,
                url: resJson.url || '',
                size: resJson.size || this.file.size,
                mime: resJson.mime || this.file.type || 'application/octet-stream',
                checksum: resJson.checksum || expectedChecksum,
                raw: resJson,
            };

            this.setStatus('completed');
            this.emitProgress();
            this.options.onSuccess(result);

            if (this.resolvePromise) {
                this.resolvePromise(result);
                this.resolvePromise = null;
            }
        } catch (err: any) {
            this.handleError(err instanceof Error ? err : new Error(String(err)));
        }
    }

    private handleError(error: Error): void {
        this.setStatus('error');
        this.options.onError(error);
        if (this.rejectPromise) {
            this.rejectPromise(error);
            this.rejectPromise = null;
        }
    }
}

/**
 * Standard single-request multipart uploader with progress tracking.
 */
export class StandardUploader {
    public readonly file: File | Blob;
    public readonly options: Required<Omit<StandardUploadOptions, 'headers' | 'extraData'>> & {
        headers?: Record<string, string> | (() => Record<string, string>);
        extraData?: Record<string, string | Blob>;
    };

    private status: UploadStatus = 'idle';
    private xhr: XMLHttpRequest | null = null;
    private speedTracker: SpeedTracker = new SpeedTracker();
    private loadedBytes: number = 0;

    constructor(file: File | Blob, options: StandardUploadOptions = {}) {
        this.file = file;
        this.options = {
            endpoint: options.endpoint ?? '/storage/upload',
            fieldName: options.fieldName ?? 'file',
            disk: options.disk ?? 'public',
            folder: options.folder ?? 'uploads',
            headers: options.headers,
            extraData: options.extraData,
            onProgress: options.onProgress ?? (() => {}),
            onSuccess: options.onSuccess ?? (() => {}),
            onError: options.onError ?? (() => {}),
            onStatusChange: options.onStatusChange ?? (() => {}),
        };
    }

    public getStatus(): UploadStatus {
        return this.status;
    }

    public getProgress(): UploadProgress {
        const total = this.file.size;
        const loaded = Math.min(this.loadedBytes, total);
        const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 100;
        const metrics = this.speedTracker.update(loaded, total);

        return {
            percent,
            loaded,
            total,
            speed: metrics.speedFormatted,
            speedBytesPerSec: metrics.speedBytesPerSec,
            remainingSeconds: metrics.remainingSeconds,
            chunkIndex: 1,
            totalChunks: 1,
        };
    }

    private setStatus(newStatus: UploadStatus): void {
        if (this.status !== newStatus) {
            this.status = newStatus;
            this.options.onStatusChange(newStatus);
        }
    }

    public async start(): Promise<UploadResult> {
        if (this.status === 'uploading') {
            throw new Error('Upload is already in progress.');
        }

        this.setStatus('uploading');
        this.loadedBytes = 0;
        this.speedTracker.reset();

        return new Promise<UploadResult>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            this.xhr = xhr;

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    this.loadedBytes = event.loaded;
                    const prog = this.getProgress();
                    this.options.onProgress(prog);
                }
            };

            xhr.onload = () => {
                this.xhr = null;
                if (xhr.status >= 200 && xhr.status < 300) {
                    this.setStatus('completed');
                    let resData: any = {};
                    try {
                        resData = JSON.parse(xhr.responseText);
                    } catch {
                        resData = { raw: xhr.responseText };
                    }

                    const fileObj = resData.file || {};
                    const filename = this.file instanceof File ? this.file.name : 'file';

                    const result: UploadResult = {
                        status: resData.status || 'success',
                        disk: fileObj.disk || this.options.disk,
                        path: fileObj.path || '',
                        filename: fileObj.filename || filename,
                        url: fileObj.url || '',
                        size: fileObj.size || this.file.size,
                        mime: fileObj.mime || this.file.type || 'application/octet-stream',
                        checksum: fileObj.checksum || '',
                        raw: resData,
                    };

                    this.options.onSuccess(result);
                    resolve(result);
                } else {
                    this.setStatus('error');
                    let errMsg = `Upload failed with HTTP ${xhr.status}: ${xhr.statusText}`;
                    try {
                        const errObj = JSON.parse(xhr.responseText);
                        if (errObj.message) errMsg = errObj.message;
                    } catch {
                        // ignore parse error
                    }
                    const err = new Error(errMsg);
                    this.options.onError(err);
                    reject(err);
                }
            };

            xhr.onerror = () => {
                this.xhr = null;
                this.setStatus('error');
                const err = new Error('Network error during upload.');
                this.options.onError(err);
                reject(err);
            };

            xhr.open('POST', this.options.endpoint, true);

            const resolvedHeaders = typeof this.options.headers === 'function'
                ? this.options.headers()
                : this.options.headers ?? {};

            for (const [key, val] of Object.entries(resolvedHeaders)) {
                xhr.setRequestHeader(key, val);
            }

            const csrfToken = resolveCsrfToken();
            if (csrfToken) {
                xhr.setRequestHeader('X-CSRF-TOKEN', csrfToken);
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            }

            const formData = new FormData();
            formData.append(this.options.fieldName, this.file);
            formData.append('disk', this.options.disk);
            formData.append('folder', this.options.folder);

            if (this.options.extraData) {
                for (const [k, v] of Object.entries(this.options.extraData)) {
                    formData.append(k, v);
                }
            }

            xhr.send(formData);
        });
    }

    public abort(): void {
        if (this.xhr) {
            this.xhr.abort();
            this.xhr = null;
            this.setStatus('aborted');
        }
    }
}
