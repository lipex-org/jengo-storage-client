export * from './types.js';
export * from './support/speed.js';
export * from './support/csrf.js';
export * from './preview.js';
export * from './chunker.js';
export * from './uploader.js';
export * from './direct-cloud.js';
export * from './ui/index.js';

import { ChunkedUploadOptions, StandardUploadOptions, UploadResult } from './types.js';
import { ChunkedUploader, StandardUploader } from './uploader.js';
import { DirectCloudUploadOptions, DirectCloudUploader } from './direct-cloud.js';

/**
 * Convenient shortcut to start a chunked file upload.
 */
export function uploadChunked(file: File | Blob, options?: ChunkedUploadOptions): Promise<UploadResult> {
    const uploader = new ChunkedUploader(file, options);
    return uploader.start();
}

/**
 * Convenient shortcut to start a standard single-request file upload.
 */
export function uploadStandard(file: File | Blob, options?: StandardUploadOptions): Promise<UploadResult> {
    const uploader = new StandardUploader(file, options);
    return uploader.start();
}

/**
 * Convenient shortcut to start a direct-to-cloud file upload.
 */
export function uploadDirectCloud(file: File | Blob, options?: DirectCloudUploadOptions): Promise<UploadResult> {
    const uploader = new DirectCloudUploader(file, options);
    return uploader.start();
}
