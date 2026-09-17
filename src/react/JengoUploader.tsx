import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { JengoUploaderUI } from '../ui/uploader-ui.js';
import { UploaderUIOptions, FileQueueItem } from '../ui/types.js';
import { UploadProgress, UploadResult } from '../types.js';

export interface JengoUploaderProps extends UploaderUIOptions {
    children?: React.ReactNode;
}

export interface JengoUploaderHandle {
    open: () => void;
    close: () => void;
    openFilePicker: () => void;
    addFiles: (files: File[] | FileList) => Promise<FileQueueItem[]>;
    upload: () => Promise<UploadResult[]>;
    pauseAll: () => void;
    resumeAll: () => void;
    cancelAll: () => void;
    clearCompleted: () => void;
    clearAll: () => void;
    getItems: () => FileQueueItem[];
    getOverallProgress: () => UploadProgress;
    getInstance: () => JengoUploaderUI | null;
}

export const JengoUploader = forwardRef<JengoUploaderHandle, JengoUploaderProps>((props, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const uploaderRef = useRef<JengoUploaderUI | null>(null);

    // Expose imperative handle methods
    useImperativeHandle(ref, () => ({
        open: () => uploaderRef.current?.open(),
        close: () => uploaderRef.current?.close(),
        openFilePicker: () => uploaderRef.current?.openFilePicker(),
        addFiles: (files: File[] | FileList) => uploaderRef.current?.addFiles(files) ?? Promise.resolve([]),
        upload: () => uploaderRef.current?.upload() ?? Promise.resolve([]),
        pauseAll: () => uploaderRef.current?.pauseAll(),
        resumeAll: () => uploaderRef.current?.resumeAll(),
        cancelAll: () => uploaderRef.current?.cancelAll(),
        clearCompleted: () => uploaderRef.current?.clearCompleted(),
        clearAll: () => uploaderRef.current?.clearAll(),
        getItems: () => uploaderRef.current?.getItems() ?? [],
        getOverallProgress: () => uploaderRef.current?.getOverallProgress() ?? {
            percent: 0,
            loaded: 0,
            total: 0,
            speed: '0 B/s',
            speedBytesPerSec: 0,
            remainingSeconds: null,
            chunkIndex: 0,
            totalChunks: 0,
        },
        getInstance: () => uploaderRef.current,
    }));

    useEffect(() => {
        if (!containerRef.current) return;

        const uploader = new JengoUploaderUI(containerRef.current, props);
        uploaderRef.current = uploader;

        return () => {
            uploader.destroy();
            uploaderRef.current = null;
        };
    }, []); // Initialize once on mount

    // Update options reactively when props change
    useEffect(() => {
        if (uploaderRef.current) {
            uploaderRef.current.updateOptions(props);
            if (props.modal && typeof props.isOpen === 'boolean') {
                if (props.isOpen) {
                    uploaderRef.current.open();
                } else {
                    uploaderRef.current.close();
                }
            }
        }
    }, [props]);

    return <div ref={containerRef} className="jengo-uploader-host" />;
});

JengoUploader.displayName = 'JengoUploader';

/**
 * Convenient React Modal Uploader wrapper
 */
export const UploadModal = forwardRef<JengoUploaderHandle, JengoUploaderProps>((props, ref) => {
    return <JengoUploader ref={ref} {...props} modal={true} />;
});

UploadModal.displayName = 'UploadModal';
