import { DirectCloudOptions, PresignedTicket, UploadProgress, UploadResult, UploadStatus } from './types.js';
import { SpeedTracker } from './support/speed.js';
import { resolveCsrfToken } from './support/csrf.js';

export interface DirectCloudUploadOptions extends DirectCloudOptions {
    ticket?: PresignedTicket;
    filename?: string;
}

/**
 * Direct-to-Cloud Uploader bypassing backend web servers for S3, Cloudflare R2, or Google Cloud Storage.
 */
export class DirectCloudUploader {
    public readonly file: File | Blob;
    public readonly options: DirectCloudUploadOptions;

    private status: UploadStatus = 'idle';
    private xhr: XMLHttpRequest | null = null;
    private speedTracker: SpeedTracker = new SpeedTracker();
    private loadedBytes: number = 0;

    constructor(file: File | Blob, options: DirectCloudUploadOptions = {}) {
        this.file = file;
        this.options = {
            ticketEndpoint: options.ticketEndpoint ?? '/storage/direct/ticket',
            confirmEndpoint: options.confirmEndpoint ?? '/storage/direct/confirm',
            ticket: options.ticket,
            filename: options.filename ?? (file instanceof File ? file.name : 'upload.bin'),
            headers: options.headers,
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
            this.options.onStatusChange?.(newStatus);
        }
    }

    public async start(): Promise<UploadResult> {
        if (this.status === 'uploading') {
            throw new Error('Upload is already in progress.');
        }

        this.setStatus('uploading');
        this.loadedBytes = 0;
        this.speedTracker.reset();

        try {
            // 1. Obtain presigned ticket if not explicitly provided
            let ticket: PresignedTicket;
            if (this.options.ticket) {
                ticket = this.options.ticket;
            } else {
                ticket = await this.fetchTicket();
            }

            // 2. Stream file directly to cloud destination
            await this.uploadToCloud(ticket);

            // 3. Confirm upload with application backend if confirmation endpoint exists
            let result: UploadResult;
            if (this.options.confirmEndpoint) {
                result = await this.confirmUpload(ticket);
            } else {
                result = {
                    status: 'success',
                    disk: 'cloud',
                    path: ticket.key,
                    filename: this.options.filename || 'upload.bin',
                    url: ticket.url.split('?')[0] || '',
                    size: this.file.size,
                    mime: this.file.type || 'application/octet-stream',
                    checksum: '',
                };
            }

            this.setStatus('completed');
            this.options.onSuccess?.(result);
            return result;
        } catch (err: any) {
            this.setStatus('error');
            const error = err instanceof Error ? err : new Error(String(err));
            this.options.onError?.(error);
            throw error;
        }
    }

    private async fetchTicket(): Promise<PresignedTicket> {
        const csrfToken = resolveCsrfToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        if (csrfToken) {
            headers['X-CSRF-TOKEN'] = csrfToken;
            headers['X-Requested-With'] = 'XMLHttpRequest';
        }

        const res = await fetch(this.options.ticketEndpoint!, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                filename: this.options.filename,
                size: this.file.size,
                mime: this.file.type || 'application/octet-stream',
            }),
        });

        if (!res.ok) {
            throw new Error(`Failed to request presigned upload ticket: HTTP ${res.status}`);
        }

        return (await res.json()) as PresignedTicket;
    }

    private uploadToCloud(ticket: PresignedTicket): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            this.xhr = xhr;

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    this.loadedBytes = event.loaded;
                    const prog = this.getProgress();
                    this.options.onProgress?.(prog);
                }
            };

            xhr.onload = () => {
                this.xhr = null;
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else {
                    reject(new Error(`Direct cloud upload failed: HTTP ${xhr.status} ${xhr.statusText}`));
                }
            };

            xhr.onerror = () => {
                this.xhr = null;
                reject(new Error('Network error during direct cloud upload.'));
            };

            const method = ticket.method ? ticket.method.toUpperCase() : 'PUT';
            xhr.open(method, ticket.url, true);

            if (ticket.headers) {
                for (const [key, val] of Object.entries(ticket.headers)) {
                    xhr.setRequestHeader(key, val);
                }
            } else if (this.file.type) {
                xhr.setRequestHeader('Content-Type', this.file.type);
            }

            xhr.send(this.file);
        });
    }

    private async confirmUpload(ticket: PresignedTicket): Promise<UploadResult> {
        const csrfToken = resolveCsrfToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        if (csrfToken) {
            headers['X-CSRF-TOKEN'] = csrfToken;
            headers['X-Requested-With'] = 'XMLHttpRequest';
        }

        const res = await fetch(this.options.confirmEndpoint!, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                key: ticket.key,
                filename: this.options.filename,
                size: this.file.size,
                mime: this.file.type || 'application/octet-stream',
            }),
        });

        if (!res.ok) {
            throw new Error(`Cloud upload confirmation failed: HTTP ${res.status}`);
        }

        const data = await res.json();
        return {
            status: data.status || 'success',
            disk: data.disk || 'cloud',
            path: data.path || ticket.key,
            filename: data.filename || this.options.filename || 'upload.bin',
            url: data.url || ticket.url.split('?')[0] || '',
            size: data.size || this.file.size,
            mime: data.mime || this.file.type || 'application/octet-stream',
            checksum: data.checksum || '',
            raw: data,
        };
    }

    public abort(): void {
        if (this.xhr) {
            this.xhr.abort();
            this.xhr = null;
            this.setStatus('aborted');
        }
    }
}
