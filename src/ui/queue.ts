import {
    FileQueueItem,
    QueueItemStatus,
    UploaderUIOptions,
} from './types.js';
import { UploadProgress, UploadResult } from '../types.js';
import { ChunkedUploader, StandardUploader } from '../uploader.js';
import { createFilePreview } from '../preview.js';
import { formatBytes } from '../support/speed.js';
import { generateFileUuid } from '../chunker.js';

export type QueueListener = (items: FileQueueItem[], overallProgress: UploadProgress) => void;

export class UploadQueueManager {
    private items: FileQueueItem[] = [];
    private options: UploaderUIOptions;
    private listeners: Set<QueueListener> = new Set();
    private activeUploadsCount = 0;
    private isProcessing = false;

    constructor(options: UploaderUIOptions = {}) {
        this.options = {
            chunked: 'auto',
            chunkThreshold: 5 * 1024 * 1024, // 5 MB
            chunkSize: 2 * 1024 * 1024,      // 2 MB
            concurrency: 2,
            autoUpload: true,
            multiple: true,
            maxFiles: 50,
            computeChecksums: true,
            ...options,
        };
    }

    public updateOptions(newOptions: Partial<UploaderUIOptions>): void {
        this.options = { ...this.options, ...newOptions };
    }

    public subscribe(listener: QueueListener): () => void {
        this.listeners.add(listener);
        listener(this.items, this.getOverallProgress());
        return () => this.listeners.delete(listener);
    }

    private emit(): void {
        const overall = this.getOverallProgress();
        for (const l of this.listeners) {
            l([...this.items], overall);
        }
    }

    public getItems(): FileQueueItem[] {
        return [...this.items];
    }

    public async addFiles(files: File[] | FileList): Promise<FileQueueItem[]> {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return [];

        if (!this.options.multiple && this.items.length > 0) {
            this.clearAll();
        }

        const addedItems: FileQueueItem[] = [];

        for (const file of fileArray) {
            if (this.options.maxFiles && this.items.length >= this.options.maxFiles) {
                break;
            }

            // Validation
            if (this.options.maxFileSize && file.size > this.options.maxFileSize) {
                continue;
            }
            if (this.options.minFileSize && file.size < this.options.minFileSize) {
                continue;
            }
            if (this.options.allowedTypes && this.options.allowedTypes.length > 0) {
                const match = this.options.allowedTypes.some((type) => {
                    if (type.endsWith('/*')) {
                        const prefix = type.slice(0, -2);
                        return file.type.startsWith(prefix);
                    }
                    if (type.startsWith('.')) {
                        return file.name.toLowerCase().endsWith(type.toLowerCase());
                    }
                    return file.type === type;
                });
                if (!match) continue;
            }

            const id = generateFileUuid();
            const item: FileQueueItem = {
                id,
                file,
                name: file.name,
                size: file.size,
                formattedSize: formatBytes(file.size),
                mime: file.type || 'application/octet-stream',
                status: 'queued',
                progress: {
                    percent: 0,
                    loaded: 0,
                    total: file.size,
                    speed: '0 B/s',
                    speedBytesPerSec: 0,
                    remainingSeconds: null,
                    chunkIndex: 0,
                    totalChunks: 0,
                },
            };

            // Generate thumbnail asynchronously
            createFilePreview(file).then((preview) => {
                if (preview.url) {
                    item.previewUrl = preview.url;
                    this.emit();
                }
            }).catch(() => {});

            this.items.push(item);
            addedItems.push(item);
        }

        this.emit();
        this.options.onFilesAdded?.(addedItems.map(i => i.file), this.items);

        if (this.options.autoUpload) {
            this.processQueue();
        }

        return addedItems;
    }

    public async processQueue(): Promise<void> {
        if (this.isProcessing) return;
        this.isProcessing = true;

        const concurrency = this.options.concurrency ?? 2;

        while (this.activeUploadsCount < concurrency) {
            const nextItem = this.items.find(i => i.status === 'queued');
            if (!nextItem) break;
            this.startItemUpload(nextItem);
        }

        this.isProcessing = false;
    }

    private startItemUpload(item: FileQueueItem): void {
        item.status = 'uploading';
        this.activeUploadsCount++;
        this.emit();
        this.options.onUploadStart?.(item);

        const useChunked = this.options.chunked === true ||
            (this.options.chunked === 'auto' && item.file.size >= (this.options.chunkThreshold ?? 5 * 1024 * 1024));

        if (useChunked) {
            const uploader = new ChunkedUploader(item.file, {
                disk: this.options.disk,
                folder: this.options.folder,
                chunkSize: this.options.chunkSize,
                concurrency: this.options.chunkConcurrency ?? 3,
                computeChecksums: this.options.computeChecksums,
                headers: this.options.headers,
                csrfToken: this.options.csrfToken,
                metadata: this.options.metadata,
                endpoint: this.options.chunkUploadEndpoint,
                assembleEndpoint: this.options.chunkAssembleEndpoint,
                abortEndpoint: this.options.chunkAbortEndpoint,
                onProgress: (p: UploadProgress) => {
                    item.progress = p;
                    this.emit();
                    this.options.onUploadProgress?.(item, this.getOverallProgress());
                },
                onSuccess: (res: UploadResult) => {
                    item.status = 'completed';
                    item.result = res;
                    item.progress.percent = 100;
                    item.progress.loaded = item.size;
                    this.activeUploadsCount--;
                    this.emit();
                    this.options.onFileSuccess?.(item, res);
                    this.checkCompletion();
                    this.processQueue();
                },
                onError: (err: Error) => {
                    item.status = 'error';
                    item.error = err;
                    this.activeUploadsCount--;
                    this.emit();
                    this.options.onFileError?.(item, err);
                    this.checkCompletion();
                    this.processQueue();
                },
            });

            item.uploader = uploader;
            uploader.start().catch(() => {});
        } else {
            const uploader = new StandardUploader(item.file, {
                disk: this.options.disk,
                folder: this.options.folder,
                headers: this.options.headers,
                csrfToken: this.options.csrfToken,
                extraData: this.options.metadata as Record<string, string | Blob> | undefined,
                endpoint: this.options.uploadEndpoint,
                onProgress: (p: UploadProgress) => {
                    item.progress = p;
                    this.emit();
                    this.options.onUploadProgress?.(item, this.getOverallProgress());
                },
                onSuccess: (res: UploadResult) => {
                    item.status = 'completed';
                    item.result = res;
                    item.progress.percent = 100;
                    item.progress.loaded = item.size;
                    this.activeUploadsCount--;
                    this.emit();
                    this.options.onFileSuccess?.(item, res);
                    this.checkCompletion();
                    this.processQueue();
                },
                onError: (err: Error) => {
                    item.status = 'error';
                    item.error = err;
                    this.activeUploadsCount--;
                    this.emit();
                    this.options.onFileError?.(item, err);
                    this.checkCompletion();
                    this.processQueue();
                },
            });

            item.uploader = uploader;
            uploader.start().catch(() => {});
        }
    }

    private checkCompletion(): void {
        const hasPending = this.items.some(i => i.status === 'queued' || i.status === 'uploading');
        if (!hasPending && this.items.length > 0) {
            const completedResults = this.items
                .filter(i => i.status === 'completed' && i.result)
                .map(i => i.result as UploadResult);
            this.options.onComplete?.(completedResults, this.items);
        }
    }

    public pauseItem(id: string): void {
        const item = this.items.find(i => i.id === id);
        if (item && item.status === 'uploading' && item.uploader instanceof ChunkedUploader) {
            item.uploader.pause();
            item.status = 'paused';
            this.activeUploadsCount--;
            this.emit();
            this.processQueue();
        }
    }

    public resumeItem(id: string): void {
        const item = this.items.find(i => i.id === id);
        if (item && item.status === 'paused' && item.uploader instanceof ChunkedUploader) {
            item.status = 'queued';
            this.emit();
            this.processQueue();
        }
    }

    public cancelItem(id: string): void {
        const item = this.items.find(i => i.id === id);
        if (item) {
            if (item.status === 'uploading') {
                item.uploader?.abort();
                this.activeUploadsCount--;
            }
            item.status = 'canceled';
            this.emit();
            this.processQueue();
        }
    }

    public retryItem(id: string): void {
        const item = this.items.find(i => i.id === id);
        if (item && (item.status === 'error' || item.status === 'canceled')) {
            item.status = 'queued';
            item.error = undefined;
            item.progress.percent = 0;
            item.progress.loaded = 0;
            this.emit();
            this.processQueue();
        }
    }

    public removeItem(id: string): void {
        const index = this.items.findIndex(i => i.id === id);
        if (index !== -1) {
            const item = this.items[index];
            if (item.status === 'uploading') {
                item.uploader?.abort();
                this.activeUploadsCount--;
            }
            this.items.splice(index, 1);
            this.emit();
            this.processQueue();
        }
    }

    public pauseAll(): void {
        for (const item of this.items) {
            if (item.status === 'uploading' && item.uploader instanceof ChunkedUploader) {
                item.uploader.pause();
                item.status = 'paused';
            }
        }
        this.activeUploadsCount = 0;
        this.emit();
    }

    public resumeAll(): void {
        for (const item of this.items) {
            if (item.status === 'paused') {
                item.status = 'queued';
            }
        }
        this.emit();
        this.processQueue();
    }

    public cancelAll(): void {
        for (const item of this.items) {
            if (item.status === 'uploading') {
                item.uploader?.abort();
            }
            if (item.status === 'queued' || item.status === 'uploading' || item.status === 'paused') {
                item.status = 'canceled';
            }
        }
        this.activeUploadsCount = 0;
        this.emit();
    }

    public clearCompleted(): void {
        this.items = this.items.filter(i => i.status !== 'completed');
        this.emit();
    }

    public clearAll(): void {
        this.cancelAll();
        this.items = [];
        this.emit();
    }

    public startUpload(): Promise<UploadResult[]> {
        return new Promise((resolve) => {
            for (const item of this.items) {
                if (item.status === 'paused' || item.status === 'error' || item.status === 'canceled') {
                    item.status = 'queued';
                }
            }
            this.emit();
            this.processQueue();

            const checkDone = () => {
                const pending = this.items.some(i => i.status === 'queued' || i.status === 'uploading');
                if (!pending) {
                    unsub();
                    resolve(this.items.filter(i => i.status === 'completed' && i.result).map(i => i.result!));
                }
            };

            const unsub = this.subscribe(() => checkDone());
        });
    }

    public getOverallProgress(): UploadProgress {
        if (this.items.length === 0) {
            return {
                percent: 0,
                loaded: 0,
                total: 0,
                speed: '0 B/s',
                speedBytesPerSec: 0,
                remainingSeconds: null,
                chunkIndex: 0,
                totalChunks: 0,
            };
        }

        let totalBytes = 0;
        let loadedBytes = 0;
        let totalSpeed = 0;

        for (const item of this.items) {
            totalBytes += item.size;
            loadedBytes += item.progress.loaded;
            totalSpeed += item.progress.speedBytesPerSec || 0;
        }

        const percent = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;
        const remainingBytes = Math.max(0, totalBytes - loadedBytes);
        const remainingSeconds = totalSpeed > 0 ? Math.ceil(remainingBytes / totalSpeed) : null;

        return {
            percent,
            loaded: loadedBytes,
            total: totalBytes,
            speed: formatBytes(totalSpeed) + '/s',
            speedBytesPerSec: totalSpeed,
            remainingSeconds,
            chunkIndex: this.items.filter(i => i.status === 'completed').length,
            totalChunks: this.items.length,
        };
    }
}
