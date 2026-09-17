import { useState, useRef, useCallback, useEffect } from 'react';
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
    status: UploadStatus;
    progress: UploadProgress;
    result: UploadResult | null;
    error: Error | null;
    isUploading: boolean;
    isCompleted: boolean;
    isError: boolean;
    upload: (file: File | Blob, options?: StandardUploadOptions) => Promise<UploadResult>;
    abort: () => void;
    reset: () => void;
}

export function useUpload(defaultOptions: StandardUploadOptions = {}): UseUploadReturn {
    const [status, setStatus] = useState<UploadStatus>('idle');
    const [progress, setProgress] = useState<UploadProgress>(initialProgress);
    const [result, setResult] = useState<UploadResult | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const uploaderRef = useRef<StandardUploader | null>(null);

    const reset = useCallback(() => {
        if (uploaderRef.current) {
            uploaderRef.current.abort();
            uploaderRef.current = null;
        }
        setStatus('idle');
        setProgress(initialProgress);
        setResult(null);
        setError(null);
    }, []);

    const upload = useCallback(
        async (file: File | Blob, options: StandardUploadOptions = {}): Promise<UploadResult> => {
            reset();
            const mergedOptions: StandardUploadOptions = {
                ...defaultOptions,
                ...options,
                onProgress: (p: UploadProgress) => {
                    setProgress(p);
                    defaultOptions.onProgress?.(p);
                    options.onProgress?.(p);
                },
                onStatusChange: (s: UploadStatus) => {
                    setStatus(s);
                    defaultOptions.onStatusChange?.(s);
                    options.onStatusChange?.(s);
                },
                onSuccess: (res: UploadResult) => {
                    setResult(res);
                    defaultOptions.onSuccess?.(res);
                    options.onSuccess?.(res);
                },
                onError: (err: Error) => {
                    setError(err);
                    defaultOptions.onError?.(err);
                    options.onError?.(err);
                },
            };

            const uploader = new StandardUploader(file, mergedOptions);
            uploaderRef.current = uploader;
            return uploader.start();
        },
        [defaultOptions, reset]
    );

    const abort = useCallback(() => {
        if (uploaderRef.current) {
            uploaderRef.current.abort();
            uploaderRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            if (uploaderRef.current) {
                uploaderRef.current.abort();
            }
        };
    }, []);

    return {
        status,
        progress,
        result,
        error,
        isUploading: status === 'uploading',
        isCompleted: status === 'completed',
        isError: status === 'error',
        upload,
        abort,
        reset,
    };
}

export interface UseChunkedUploadReturn {
    status: UploadStatus;
    progress: UploadProgress;
    result: UploadResult | null;
    error: Error | null;
    isUploading: boolean;
    isPaused: boolean;
    isCompleted: boolean;
    isError: boolean;
    start: (file: File | Blob, options?: ChunkedUploadOptions) => Promise<UploadResult>;
    pause: () => void;
    resume: () => Promise<UploadResult>;
    abort: () => Promise<void>;
    reset: () => void;
}

export function useChunkedUpload(defaultOptions: ChunkedUploadOptions = {}): UseChunkedUploadReturn {
    const [status, setStatus] = useState<UploadStatus>('idle');
    const [progress, setProgress] = useState<UploadProgress>(initialProgress);
    const [result, setResult] = useState<UploadResult | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const uploaderRef = useRef<ChunkedUploader | null>(null);

    const reset = useCallback(() => {
        if (uploaderRef.current) {
            uploaderRef.current.abort();
            uploaderRef.current = null;
        }
        setStatus('idle');
        setProgress(initialProgress);
        setResult(null);
        setError(null);
    }, []);

    const start = useCallback(
        async (file: File | Blob, options: ChunkedUploadOptions = {}): Promise<UploadResult> => {
            reset();
            const mergedOptions: ChunkedUploadOptions = {
                ...defaultOptions,
                ...options,
                onProgress: (p: UploadProgress) => {
                    setProgress(p);
                    defaultOptions.onProgress?.(p);
                    options.onProgress?.(p);
                },
                onStatusChange: (s: UploadStatus) => {
                    setStatus(s);
                    defaultOptions.onStatusChange?.(s);
                    options.onStatusChange?.(s);
                },
                onSuccess: (res: UploadResult) => {
                    setResult(res);
                    defaultOptions.onSuccess?.(res);
                    options.onSuccess?.(res);
                },
                onError: (err: Error) => {
                    setError(err);
                    defaultOptions.onError?.(err);
                    options.onError?.(err);
                },
            };

            const uploader = new ChunkedUploader(file, mergedOptions);
            uploaderRef.current = uploader;
            return uploader.start();
        },
        [defaultOptions, reset]
    );

    const pause = useCallback(() => {
        if (uploaderRef.current) {
            uploaderRef.current.pause();
        }
    }, []);

    const resume = useCallback(async (): Promise<UploadResult> => {
        if (!uploaderRef.current) {
            throw new Error('No active upload session to resume.');
        }
        return uploaderRef.current.resume();
    }, []);

    const abort = useCallback(async (): Promise<void> => {
        if (uploaderRef.current) {
            await uploaderRef.current.abort();
            uploaderRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            if (uploaderRef.current) {
                uploaderRef.current.abort();
            }
        };
    }, []);

    return {
        status,
        progress,
        result,
        error,
        isUploading: status === 'uploading',
        isPaused: status === 'paused',
        isCompleted: status === 'completed',
        isError: status === 'error',
        start,
        pause,
        resume,
        abort,
        reset,
    };
}

export * from './JengoUploader.js';
export * from '../ui/types.js';

