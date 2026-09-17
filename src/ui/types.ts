import { UploadProgress, UploadResult } from '../types.js';
import { ChunkedUploader, StandardUploader } from '../uploader.js';

export type UploaderVariant = 'dropzone' | 'compact' | 'minimal' | 'button';

export type UploaderTheme = 'light' | 'dark' | 'minimal' | 'corporate' | 'glass' | 'custom';

export type QueueItemStatus = 'queued' | 'uploading' | 'paused' | 'completed' | 'error' | 'canceled';

export interface FileQueueItem {
    id: string;
    file: File;
    name: string;
    size: number;
    formattedSize: string;
    mime: string;
    previewUrl?: string;
    status: QueueItemStatus;
    progress: UploadProgress;
    result?: UploadResult;
    error?: Error;
    uploader?: ChunkedUploader | StandardUploader;
}

export interface UploaderLabels {
    title: string;
    dropzonePrompt: string;
    dropzoneSubtext: string;
    browseButton: string;
    uploadButton: string;
    pauseButton: string;
    resumeButton: string;
    cancelButton: string;
    removeButton: string;
    retryButton: string;
    clearCompletedButton: string;
    closeModalButton: string;
    statusQueued: string;
    statusUploading: string;
    statusPaused: string;
    statusCompleted: string;
    statusError: string;
    statusCanceled: string;
    speedLabel: string;
    etaLabel: string;
    totalProgressLabel: string;
    maxFilesError: string;
    maxSizeError: string;
    typeError: string;
    emptyQueueMessage: string;
}

export interface UploaderRenderContext {
    items: FileQueueItem[];
    overallProgress: UploadProgress;
    isUploading: boolean;
    isCompleted: boolean;
    hasErrors: boolean;
    startUpload: () => Promise<UploadResult[]>;
    pauseAll: () => void;
    resumeAll: () => Promise<UploadResult[]>;
    cancelAll: () => void;
    clearCompleted: () => void;
    openFilePicker: () => void;
    closeModal?: () => void;
}

export interface UploaderUIOptions {
    // Target disk and folder
    disk?: string;
    folder?: string;

    // Endpoints
    uploadEndpoint?: string;
    chunkUploadEndpoint?: string;
    chunkAssembleEndpoint?: string;
    chunkAbortEndpoint?: string;

    // Chunking configuration
    chunked?: boolean | 'auto';
    chunkThreshold?: number; // Size threshold in bytes to trigger chunking when 'auto' (default: 5 MB)
    chunkSize?: number;      // Size in bytes per chunk (default: 2 MB)
    concurrency?: number;    // Concurrent file uploads (default: 2)
    chunkConcurrency?: number; // Concurrent chunk uploads per file (default: 3)
    computeChecksums?: boolean;

    // Authentication and headers
    headers?: Record<string, string> | (() => Record<string, string>);
    csrfToken?: string;
    metadata?: Record<string, unknown>;

    // Constraints & Validation
    multiple?: boolean;
    maxFiles?: number;
    maxFileSize?: number;
    minFileSize?: number;
    allowedTypes?: string[];

    // Automation
    autoUpload?: boolean;

    // Theming & Layout
    variant?: UploaderVariant;
    theme?: UploaderTheme;
    themeVariables?: Record<string, string>;
    className?: string;
    style?: Record<string, string>;

    // Modal settings
    modal?: boolean;
    modalTitle?: string;
    isOpen?: boolean;
    closeOnComplete?: boolean;
    closeOnBackdrop?: boolean;

    // Feature Toggles (developer control of what is rendered)
    showDropzone?: boolean;
    showFileList?: boolean;
    showProgress?: boolean;
    showDetails?: boolean;
    showThumbnails?: boolean;
    allowPause?: boolean;
    allowCancel?: boolean;
    allowRemove?: boolean;
    allowRetry?: boolean;
    allowClearCompleted?: boolean;

    // Internationalization / text labels
    labels?: Partial<UploaderLabels>;

    // Event hooks
    onFilesAdded?: (files: File[], queue: FileQueueItem[]) => void;
    onUploadStart?: (item: FileQueueItem) => void;
    onUploadProgress?: (item: FileQueueItem, overallProgress: UploadProgress) => void;
    onFileSuccess?: (item: FileQueueItem, result: UploadResult) => void;
    onFileError?: (item: FileQueueItem, error: Error) => void;
    onComplete?: (results: UploadResult[], queue: FileQueueItem[]) => void;
    onOpen?: () => void;
    onClose?: () => void;

    // Custom render overrides (for headless rendering)
    renderDropzone?: (context: UploaderRenderContext) => HTMLElement | string;
    renderFileItem?: (item: FileQueueItem, context: UploaderRenderContext) => HTMLElement | string;
    renderHeader?: (context: UploaderRenderContext) => HTMLElement | string;
    renderFooter?: (context: UploaderRenderContext) => HTMLElement | string;
}
