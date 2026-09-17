import { ChunkPart } from './types.js';

export const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB

/**
 * Generate a unique session identifier for chunked file assembly.
 */
export function generateFileUuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'jengo_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
}

/**
 * Compute the SHA-256 checksum of a Blob or ArrayBuffer using the Web Crypto API.
 */
export async function calculateSha256(data: Blob | ArrayBuffer): Promise<string> {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
        return '';
    }

    // Browsers cannot safely allocate contiguous ArrayBuffers for multi-gigabyte files.
    // Return empty string for files > 500 MB; the server will compute the final hash via stream.
    if (data instanceof Blob && data.size > 500 * 1024 * 1024) {
        return '';
    }

    try {
        let buffer: ArrayBuffer;
        if (data instanceof Blob) {
            buffer = await data.arrayBuffer();
        } else {
            buffer = data;
        }

        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
        return '';
    }
}

/**
 * Slice a file or blob into discrete chunk parts ready for transmission.
 */
export function sliceFileIntoChunks(file: Blob, chunkSize: number = DEFAULT_CHUNK_SIZE): ChunkPart[] {
    const validChunkSize = Math.max(64 * 1024, chunkSize); // Minimum 64 KB
    const totalSize = file.size;
    const parts: ChunkPart[] = [];

    if (totalSize === 0) {
        parts.push({
            index: 0,
            start: 0,
            end: 0,
            blob: file.slice(0, 0),
            retries: 0,
        });
        return parts;
    }

    let index = 0;
    for (let start = 0; start < totalSize; start += validChunkSize) {
        const end = Math.min(start + validChunkSize, totalSize);
        const chunkBlob = file.slice(start, end);

        parts.push({
            index,
            start,
            end,
            blob: chunkBlob,
            retries: 0,
        });

        index++;
    }

    return parts;
}
