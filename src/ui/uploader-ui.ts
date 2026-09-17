import {
    FileQueueItem,
    UploaderUIOptions,
} from './types.js';
import { UploadProgress, UploadResult } from '../types.js';
import { UploadQueueManager } from './queue.js';
import { DomUploaderRenderer } from './dom-renderer.js';

export class JengoUploaderUI {
    private queue: UploadQueueManager;
    private renderer: DomUploaderRenderer;

    constructor(container: HTMLElement | string, options: UploaderUIOptions = {}) {
        const targetElement = typeof container === 'string'
            ? document.querySelector(container) as HTMLElement
            : container;

        if (!targetElement) {
            throw new Error(`[JengoUploaderUI] Target container element not found.`);
        }

        this.queue = new UploadQueueManager(options);
        this.renderer = new DomUploaderRenderer(targetElement, options, this.queue);
    }

    public open(): void {
        this.renderer.openModal();
    }

    public close(): void {
        this.renderer.closeModal();
    }

    public openFilePicker(): void {
        this.renderer.openFilePicker();
    }

    public addFiles(files: File[] | FileList): Promise<FileQueueItem[]> {
        return this.queue.addFiles(files);
    }

    public upload(): Promise<UploadResult[]> {
        return this.queue.startUpload();
    }

    public pauseAll(): void {
        this.queue.pauseAll();
    }

    public resumeAll(): void {
        this.queue.resumeAll();
    }

    public cancelAll(): void {
        this.queue.cancelAll();
    }

    public clearCompleted(): void {
        this.queue.clearCompleted();
    }

    public clearAll(): void {
        this.queue.clearAll();
    }

    public getItems(): FileQueueItem[] {
        return this.queue.getItems();
    }

    public getOverallProgress(): UploadProgress {
        return this.queue.getOverallProgress();
    }

    public updateOptions(options: Partial<UploaderUIOptions>): void {
        this.renderer.updateOptions(options);
    }

    public destroy(): void {
        this.renderer.destroy();
    }
}

/**
 * Convenient factory function to instantiate and mount the Jengo Uploader UI on any DOM element.
 */
export function createUploaderUI(
    container: HTMLElement | string,
    options: UploaderUIOptions = {}
): JengoUploaderUI {
    return new JengoUploaderUI(container, options);
}
