import { formatBytes } from './support/speed.js';

export interface FilePreview {
    url: string | null;
    isImage: boolean;
    isVideo: boolean;
    isAudio: boolean;
    isPdf: boolean;
    name: string;
    size: number;
    sizeFormatted: string;
    mime: string;
    width?: number;
    height?: number;
    duration?: number;
    revoke: () => void;
}

export async function createFilePreview(file: File | Blob): Promise<FilePreview> {
    const name = file instanceof File ? file.name : 'blob';
    const mime = file.type || 'application/octet-stream';
    const size = file.size;
    const sizeFormatted = formatBytes(size);

    const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
    const isImage = mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'avif', 'bmp', 'ico'].includes(ext);
    const isVideo = mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext);
    const isAudio = mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext);
    const isPdf = mime === 'application/pdf' || ext === 'pdf';

    let objectUrl: string | null = null;
    const isBrowser = typeof window !== 'undefined' && typeof URL !== 'undefined';

    if (isBrowser && (isImage || isVideo || isAudio || isPdf)) {
        objectUrl = URL.createObjectURL(file);
    }

    const preview: FilePreview = {
        url: objectUrl,
        isImage,
        isVideo,
        isAudio,
        isPdf,
        name,
        size,
        sizeFormatted,
        mime,
        revoke: () => {
            if (objectUrl && isBrowser) {
                URL.revokeObjectURL(objectUrl);
                preview.url = null;
            }
        },
    };

    if (!isBrowser || !objectUrl) {
        return preview;
    }

    if (isImage && typeof Image !== 'undefined') {
        try {
            await new Promise<void>((resolve) => {
                const img = new Image();
                img.onload = () => {
                    preview.width = img.naturalWidth;
                    preview.height = img.naturalHeight;
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = objectUrl!;
            });
        } catch {
            // Ignore dimension extraction failure
        }
    } else if (isVideo && typeof document !== 'undefined') {
        try {
            await new Promise<void>((resolve) => {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = () => {
                    preview.width = video.videoWidth;
                    preview.height = video.videoHeight;
                    preview.duration = video.duration;
                    resolve();
                };
                video.onerror = () => resolve();
                video.src = objectUrl!;
            });
        } catch {
            // Ignore dimension extraction failure
        }
    }

    return preview;
}
