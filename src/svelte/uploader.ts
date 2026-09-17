import { JengoUploaderUI } from '../ui/uploader-ui.js';
import { UploaderUIOptions, FileQueueItem } from '../ui/types.js';
import { UploadProgress, UploadResult } from '../types.js';
import { writable, type Readable } from 'svelte/store';

export interface SvelteUploaderActionReturn {
    update: (newOptions: Partial<UploaderUIOptions>) => void;
    destroy: () => void;
}

/**
 * Svelte Action to mount and manage the Jengo Uploader on any HTML element.
 * Usage: <div use:uploader={{ disk: 'public', theme: 'minimal' }}></div>
 */
export function uploader(
    node: HTMLElement,
    options: UploaderUIOptions = {}
): SvelteUploaderActionReturn {
    let instance: JengoUploaderUI | null = new JengoUploaderUI(node, {
        ...options,
        onComplete: (results, queue) => {
            options.onComplete?.(results, queue);
            node.dispatchEvent(new CustomEvent('complete', { detail: { results, queue } }));
        },
        onFileSuccess: (item, result) => {
            options.onFileSuccess?.(item, result);
            node.dispatchEvent(new CustomEvent('file-success', { detail: { item, result } }));
        },
        onFileError: (item, error) => {
            options.onFileError?.(item, error);
            node.dispatchEvent(new CustomEvent('file-error', { detail: { item, error } }));
        },
        onUploadProgress: (item, overall) => {
            options.onUploadProgress?.(item, overall);
            node.dispatchEvent(new CustomEvent('progress', { detail: { item, overall } }));
        },
        onFilesAdded: (files, queue) => {
            options.onFilesAdded?.(files, queue);
            node.dispatchEvent(new CustomEvent('files-added', { detail: { files, queue } }));
        },
        onOpen: () => {
            options.onOpen?.();
            node.dispatchEvent(new CustomEvent('open'));
        },
        onClose: () => {
            options.onClose?.();
            node.dispatchEvent(new CustomEvent('close'));
        },
    });

    if (options.modal && options.isOpen) {
        instance.open();
    }

    return {
        update(newOptions: Partial<UploaderUIOptions>) {
            if (instance) {
                instance.updateOptions(newOptions);
                if (newOptions.modal) {
                    if (newOptions.isOpen) {
                        instance.open();
                    } else {
                        instance.close();
                    }
                }
            }
        },
        destroy() {
            if (instance) {
                instance.destroy();
                instance = null;
            }
        },
    };
}

export interface SvelteUploaderStoreState {
    items: FileQueueItem[];
    overallProgress: UploadProgress;
    isUploading: boolean;
    isCompleted: boolean;
}

export interface SvelteUploaderInstance extends Readable<SvelteUploaderStoreState> {
    mount: (node: HTMLElement) => void;
    open: () => void;
    close: () => void;
    addFiles: (files: File[] | FileList) => Promise<FileQueueItem[]>;
    upload: () => Promise<UploadResult[]>;
    pauseAll: () => void;
    resumeAll: () => void;
    cancelAll: () => void;
    clearCompleted: () => void;
    clearAll: () => void;
    destroy: () => void;
}

/**
 * Factory for creating a reactive Svelte store-driven uploader instance.
 */
export function createSvelteUploader(options: UploaderUIOptions = {}): SvelteUploaderInstance {
    const store = writable<SvelteUploaderStoreState>({
        items: [],
        overallProgress: {
            percent: 0,
            loaded: 0,
            total: 0,
            speed: '0 B/s',
            speedBytesPerSec: 0,
            remainingSeconds: null,
            chunkIndex: 0,
            totalChunks: 0,
        },
        isUploading: false,
        isCompleted: false,
    });

    let uploaderInstance: JengoUploaderUI | null = null;

    const mount = (node: HTMLElement) => {
        if (uploaderInstance) {
            uploaderInstance.destroy();
        }

        uploaderInstance = new JengoUploaderUI(node, {
            ...options,
            onUploadProgress: () => {
                if (uploaderInstance) {
                    const items = uploaderInstance.getItems();
                    const overall = uploaderInstance.getOverallProgress();
                    store.set({
                        items,
                        overallProgress: overall,
                        isUploading: items.some(i => i.status === 'uploading'),
                        isCompleted: items.length > 0 && items.every(i => i.status === 'completed'),
                    });
                }
            },
        });
    };

    return {
        subscribe: store.subscribe,
        mount,
        open: () => uploaderInstance?.open(),
        close: () => uploaderInstance?.close(),
        addFiles: (files) => uploaderInstance?.addFiles(files) ?? Promise.resolve([]),
        upload: () => uploaderInstance?.upload() ?? Promise.resolve([]),
        pauseAll: () => uploaderInstance?.pauseAll(),
        resumeAll: () => uploaderInstance?.resumeAll(),
        cancelAll: () => uploaderInstance?.cancelAll(),
        clearCompleted: () => uploaderInstance?.clearCompleted(),
        clearAll: () => uploaderInstance?.clearAll(),
        destroy: () => {
            uploaderInstance?.destroy();
            uploaderInstance = null;
        },
    };
}
