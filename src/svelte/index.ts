import { writable, type Readable } from 'svelte/store';
import {
    ChunkedUploadOptions,
    StandardUploadOptions,
    UploadProgress,
    UploadResult,
    UploadStatus,
} from '../types.js';
import { ChunkedUploader, StandardUploader } from '../uploader.js';

const initialProgress: UploadProgress = {
    percent: 0,
    loaded: 0,
    total: 0,
    speed: '0 B/s',
    speedBytesPerSec: 0,
    remainingSeconds: null,
    chunkIndex: 0,
    totalChunks: 0,
};

export interface UploadStoreState {
    status: UploadStatus;
    progress: UploadProgress;
    result: UploadResult | null;
    error: Error | null;
    isUploading: boolean;
    isCompleted: boolean;
    isError: boolean;
}

export interface ChunkedUploadStoreState {
    status: UploadStatus;
    progress: UploadProgress;
    result: UploadResult | null;
    error: Error | null;
    isUploading: boolean;
    isPaused: boolean;
    isCompleted: boolean;
    isError: boolean;
}

export interface UploadStore extends Readable<UploadStoreState> {
    upload: (file: File | Blob, options?: StandardUploadOptions) => Promise<UploadResult>;
    abort: () => void;
    reset: () => void;
}

export interface ChunkedUploadStore extends Readable<ChunkedUploadStoreState> {
    start: (file: File | Blob, options?: ChunkedUploadOptions) => Promise<UploadResult>;
    pause: () => void;
    resume: () => Promise<UploadResult>;
    abort: () => Promise<void>;
    reset: () => void;
}

export function createUpload(defaultOptions: StandardUploadOptions = {}): UploadStore {
    const state = writable<UploadStoreState>({
        status: 'idle',
        progress: { ...initialProgress },
        result: null,
        error: null,
        isUploading: false,
        isCompleted: false,
        isError: false,
    });

    let uploader: StandardUploader | null = null;

    const reset = () => {
        if (uploader) {
            uploader.abort();
            uploader = null;
        }
        state.set({
            status: 'idle',
            progress: { ...initialProgress },
            result: null,
            error: null,
            isUploading: false,
            isCompleted: false,
            isError: false,
        });
    };

    const upload = async (file: File | Blob, options: StandardUploadOptions = {}): Promise<UploadResult> => {
        reset();
        const mergedOptions: StandardUploadOptions = {
            ...defaultOptions,
            ...options,
            onProgress: (p: UploadProgress) => {
                state.update((s) => ({ ...s, progress: p }));
                defaultOptions.onProgress?.(p);
                options.onProgress?.(p);
            },
            onStatusChange: (status: UploadStatus) => {
                state.update((s) => ({
                    ...s,
                    status,
                    isUploading: status === 'uploading',
                    isCompleted: status === 'completed',
                    isError: status === 'error',
                }));
                defaultOptions.onStatusChange?.(status);
                options.onStatusChange?.(status);
            },
            onSuccess: (res: UploadResult) => {
                state.update((s) => ({ ...s, result: res }));
                defaultOptions.onSuccess?.(res);
                options.onSuccess?.(res);
            },
            onError: (err: Error) => {
                state.update((s) => ({ ...s, error: err }));
                defaultOptions.onError?.(err);
                options.onError?.(err);
            },
        };

        uploader = new StandardUploader(file, mergedOptions);
        return uploader.start();
    };

    const abort = () => {
        if (uploader) {
            uploader.abort();
            uploader = null;
        }
    };

    return {
        subscribe: state.subscribe,
        upload,
        abort,
        reset,
    };
}

export function createChunkedUpload(defaultOptions: ChunkedUploadOptions = {}): ChunkedUploadStore {
    const state = writable<ChunkedUploadStoreState>({
        status: 'idle',
        progress: { ...initialProgress },
        result: null,
        error: null,
        isUploading: false,
        isPaused: false,
        isCompleted: false,
        isError: false,
    });

    let uploader: ChunkedUploader | null = null;

    const reset = () => {
        if (uploader) {
            uploader.abort();
            uploader = null;
        }
        state.set({
            status: 'idle',
            progress: { ...initialProgress },
            result: null,
            error: null,
            isUploading: false,
            isPaused: false,
            isCompleted: false,
            isError: false,
        });
    };

    const start = async (file: File | Blob, options: ChunkedUploadOptions = {}): Promise<UploadResult> => {
        reset();
        const mergedOptions: ChunkedUploadOptions = {
            ...defaultOptions,
            ...options,
            onProgress: (p: UploadProgress) => {
                state.update((s) => ({ ...s, progress: p }));
                defaultOptions.onProgress?.(p);
                options.onProgress?.(p);
            },
            onStatusChange: (status: UploadStatus) => {
                state.update((s) => ({
                    ...s,
                    status,
                    isUploading: status === 'uploading',
                    isPaused: status === 'paused',
                    isCompleted: status === 'completed',
                    isError: status === 'error',
                }));
                defaultOptions.onStatusChange?.(status);
                options.onStatusChange?.(status);
            },
            onSuccess: (res: UploadResult) => {
                state.update((s) => ({ ...s, result: res }));
                defaultOptions.onSuccess?.(res);
                options.onSuccess?.(res);
            },
            onError: (err: Error) => {
                state.update((s) => ({ ...s, error: err }));
                defaultOptions.onError?.(err);
                options.onError?.(err);
            },
        };

        uploader = new ChunkedUploader(file, mergedOptions);
        return uploader.start();
    };

    const pause = () => {
        if (uploader) {
            uploader.pause();
        }
    };

    const resume = async (): Promise<UploadResult> => {
        if (!uploader) {
            throw new Error('No active upload session to resume.');
        }
        return uploader.resume();
    };

    const abort = async (): Promise<void> => {
        if (uploader) {
            await uploader.abort();
            uploader = null;
        }
    };

    return {
        subscribe: state.subscribe,
        start,
        pause,
        resume,
        abort,
        reset,
    };
}

export const useUpload = createUpload;
export const useChunkedUpload = createChunkedUpload;

export * from './uploader.js';
export * from '../ui/types.js';

