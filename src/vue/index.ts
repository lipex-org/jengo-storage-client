import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue';
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

export interface UseUploadReturn {
    status: Ref<UploadStatus>;
    progress: Ref<UploadProgress>;
    result: Ref<UploadResult | null>;
    error: Ref<Error | null>;
    isUploading: ComputedRef<boolean>;
    isCompleted: ComputedRef<boolean>;
    isError: ComputedRef<boolean>;
    upload: (file: File | Blob, options?: StandardUploadOptions) => Promise<UploadResult>;
    abort: () => void;
    reset: () => void;
}

export function useUpload(defaultOptions: StandardUploadOptions = {}): UseUploadReturn {
    const status = ref<UploadStatus>('idle');
    const progress = ref<UploadProgress>({ ...initialProgress });
    const result = ref<UploadResult | null>(null);
    const error = ref<Error | null>(null);
    let uploader: StandardUploader | null = null;

    const reset = () => {
        if (uploader) {
            uploader.abort();
            uploader = null;
        }
        status.value = 'idle';
        progress.value = { ...initialProgress };
        result.value = null;
        error.value = null;
    };

    const upload = async (file: File | Blob, options: StandardUploadOptions = {}): Promise<UploadResult> => {
        reset();
        const mergedOptions: StandardUploadOptions = {
            ...defaultOptions,
            ...options,
            onProgress: (p: UploadProgress) => {
                progress.value = p;
                defaultOptions.onProgress?.(p);
                options.onProgress?.(p);
            },
            onStatusChange: (s: UploadStatus) => {
                status.value = s;
                defaultOptions.onStatusChange?.(s);
                options.onStatusChange?.(s);
            },
            onSuccess: (res: UploadResult) => {
                result.value = res;
                defaultOptions.onSuccess?.(res);
                options.onSuccess?.(res);
            },
            onError: (err: Error) => {
                error.value = err;
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

    onUnmounted(() => {
        if (uploader) {
            uploader.abort();
        }
    });

    return {
        status,
        progress,
        result,
        error,
        isUploading: computed(() => status.value === 'uploading'),
        isCompleted: computed(() => status.value === 'completed'),
        isError: computed(() => status.value === 'error'),
        upload,
        abort,
        reset,
    };
}

export interface UseChunkedUploadReturn {
    status: Ref<UploadStatus>;
    progress: Ref<UploadProgress>;
    result: Ref<UploadResult | null>;
    error: Ref<Error | null>;
    isUploading: ComputedRef<boolean>;
    isPaused: ComputedRef<boolean>;
    isCompleted: ComputedRef<boolean>;
    isError: ComputedRef<boolean>;
    start: (file: File | Blob, options?: ChunkedUploadOptions) => Promise<UploadResult>;
    pause: () => void;
    resume: () => Promise<UploadResult>;
    abort: () => Promise<void>;
    reset: () => void;
}

export function useChunkedUpload(defaultOptions: ChunkedUploadOptions = {}): UseChunkedUploadReturn {
    const status = ref<UploadStatus>('idle');
    const progress = ref<UploadProgress>({ ...initialProgress });
    const result = ref<UploadResult | null>(null);
    const error = ref<Error | null>(null);
    let uploader: ChunkedUploader | null = null;

    const reset = () => {
        if (uploader) {
            uploader.abort();
            uploader = null;
        }
        status.value = 'idle';
        progress.value = { ...initialProgress };
        result.value = null;
        error.value = null;
    };

    const start = async (file: File | Blob, options: ChunkedUploadOptions = {}): Promise<UploadResult> => {
        reset();
        const mergedOptions: ChunkedUploadOptions = {
            ...defaultOptions,
            ...options,
            onProgress: (p: UploadProgress) => {
                progress.value = p;
                defaultOptions.onProgress?.(p);
                options.onProgress?.(p);
            },
            onStatusChange: (s: UploadStatus) => {
                status.value = s;
                defaultOptions.onStatusChange?.(s);
                options.onStatusChange?.(s);
            },
            onSuccess: (res: UploadResult) => {
                result.value = res;
                defaultOptions.onSuccess?.(res);
                options.onSuccess?.(res);
            },
            onError: (err: Error) => {
                error.value = err;
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

    onUnmounted(() => {
        if (uploader) {
            uploader.abort();
        }
    });

    return {
        status,
        progress,
        result,
        error,
        isUploading: computed(() => status.value === 'uploading'),
        isPaused: computed(() => status.value === 'paused'),
        isCompleted: computed(() => status.value === 'completed'),
        isError: computed(() => status.value === 'error'),
        start,
        pause,
        resume,
        abort,
        reset,
    };
}
