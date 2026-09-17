export type UploadStatus =
    | 'idle'
    | 'uploading'
    | 'paused'
    | 'assembling'
    | 'completed'
    | 'error'
    | 'aborted';

export interface UploadProgress {
    percent: number;
    loaded: number;
    total: number;
    speed: string;
    speedBytesPerSec: number;
    remainingSeconds: number | null;
    chunkIndex: number;
    totalChunks: number;
}

export interface UploadResult {
    status: string;
    disk: string;
    path: string;
    filename: string;
    url: string;
    size: number;
    mime: string;
    checksum: string;
    raw?: unknown;
}

export interface ChunkPart {
    index: number;
    start: number;
    end: number;
    blob: Blob;
    checksum?: string;
    retries: number;
}

export interface ChunkedUploadOptions {
    endpoint?: string;
    assembleEndpoint?: string;
    abortEndpoint?: string;
    chunkSize?: number;
    concurrency?: number;
    retries?: number;
    disk?: string;
    folder?: string;
    headers?: Record<string, string> | (() => Record<string, string>);
    csrfToken?: string;
    metadata?: Record<string, unknown>;
    computeChecksums?: boolean;
    onProgress?: (progress: UploadProgress) => void;
    onSuccess?: (result: UploadResult) => void;
    onError?: (error: Error) => void;
    onStatusChange?: (status: UploadStatus) => void;
}

export interface StandardUploadOptions {
    endpoint?: string;
    fieldName?: string;
    disk?: string;
    folder?: string;
    headers?: Record<string, string> | (() => Record<string, string>);
    csrfToken?: string;
    extraData?: Record<string, string | Blob>;
    onProgress?: (progress: UploadProgress) => void;
    onSuccess?: (result: UploadResult) => void;
    onError?: (error: Error) => void;
    onStatusChange?: (status: UploadStatus) => void;
}

export interface PresignedTicket {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    key: string;
    expiresAt?: number;
}

export interface DirectCloudOptions {
    ticketEndpoint?: string;
    confirmEndpoint?: string;
    headers?: Record<string, string> | (() => Record<string, string>);
    onProgress?: (progress: UploadProgress) => void;
    onSuccess?: (result: UploadResult) => void;
    onError?: (error: Error) => void;
    onStatusChange?: (status: UploadStatus) => void;
}
