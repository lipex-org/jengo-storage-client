import {
    defineComponent,
    h,
    ref,
    onMounted,
    onBeforeUnmount,
    watch,
    type PropType,
} from 'vue';
import { JengoUploaderUI } from '../ui/uploader-ui.js';
import {
    UploaderUIOptions,
    UploaderVariant,
    UploaderTheme,
    UploaderLabels,
    FileQueueItem,
} from '../ui/types.js';
import { UploadResult, UploadProgress } from '../types.js';

export const JengoUploader = defineComponent({
    name: 'JengoUploader',
    props: {
        disk: { type: String, default: undefined },
        folder: { type: String, default: undefined },
        variant: { type: String as PropType<UploaderVariant>, default: 'dropzone' },
        theme: { type: String as PropType<UploaderTheme>, default: 'light' },
        themeVariables: { type: Object as PropType<Record<string, string>>, default: undefined },
        className: { type: String, default: '' },
        style: { type: Object as PropType<Record<string, string>>, default: undefined },
        modal: { type: Boolean, default: false },
        modalTitle: { type: String, default: undefined },
        isOpen: { type: Boolean, default: false },
        closeOnComplete: { type: Boolean, default: false },
        closeOnBackdrop: { type: Boolean, default: true },
        multiple: { type: Boolean, default: true },
        maxFiles: { type: Number, default: undefined },
        maxFileSize: { type: Number, default: undefined },
        minFileSize: { type: Number, default: undefined },
        allowedTypes: { type: Array as PropType<string[]>, default: undefined },
        autoUpload: { type: Boolean, default: true },
        chunked: { type: [Boolean, String] as PropType<boolean | 'auto'>, default: 'auto' },
        chunkThreshold: { type: Number, default: undefined },
        chunkSize: { type: Number, default: undefined },
        concurrency: { type: Number, default: 2 },
        chunkConcurrency: { type: Number, default: 3 },
        computeChecksums: { type: Boolean, default: true },
        headers: { type: [Object, Function] as PropType<Record<string, string> | (() => Record<string, string>)>, default: undefined },
        csrfToken: { type: String, default: undefined },
        metadata: { type: Object as PropType<Record<string, unknown>>, default: undefined },
        showDropzone: { type: Boolean, default: true },
        showFileList: { type: Boolean, default: true },
        showProgress: { type: Boolean, default: true },
        showDetails: { type: Boolean, default: true },
        showThumbnails: { type: Boolean, default: true },
        allowPause: { type: Boolean, default: true },
        allowCancel: { type: Boolean, default: true },
        allowRemove: { type: Boolean, default: true },
        allowRetry: { type: Boolean, default: true },
        allowClearCompleted: { type: Boolean, default: true },
        labels: { type: Object as PropType<Partial<UploaderLabels>>, default: undefined },
    },
    emits: [
        'complete',
        'file-success',
        'file-error',
        'progress',
        'files-added',
        'open',
        'close',
    ],
    setup(props, { emit, expose }) {
        const containerRef = ref<HTMLElement | null>(null);
        let uploaderInstance: JengoUploaderUI | null = null;

        const buildOptions = (): UploaderUIOptions => ({
            ...props,
            onComplete: (results: UploadResult[], queue: FileQueueItem[]) => emit('complete', results, queue),
            onFileSuccess: (item: FileQueueItem, result: UploadResult) => emit('file-success', item, result),
            onFileError: (item: FileQueueItem, error: Error) => emit('file-error', item, error),
            onUploadProgress: (item: FileQueueItem, overall: UploadProgress) => emit('progress', item, overall),
            onFilesAdded: (files: File[], queue: FileQueueItem[]) => emit('files-added', files, queue),
            onOpen: () => emit('open'),
            onClose: () => emit('close'),
        });

        onMounted(() => {
            if (containerRef.value) {
                uploaderInstance = new JengoUploaderUI(containerRef.value, buildOptions());
                if (props.modal && props.isOpen) {
                    uploaderInstance.open();
                }
            }
        });

        onBeforeUnmount(() => {
            if (uploaderInstance) {
                uploaderInstance.destroy();
                uploaderInstance = null;
            }
        });

        watch(() => props, () => {
            if (uploaderInstance) {
                uploaderInstance.updateOptions(buildOptions());
                if (props.modal) {
                    if (props.isOpen) {
                        uploaderInstance.open();
                    } else {
                        uploaderInstance.close();
                    }
                }
            }
        }, { deep: true });

        expose({
            open: () => uploaderInstance?.open(),
            close: () => uploaderInstance?.close(),
            openFilePicker: () => uploaderInstance?.openFilePicker(),
            addFiles: (files: File[] | FileList) => uploaderInstance?.addFiles(files) ?? Promise.resolve([]),
            upload: () => uploaderInstance?.upload() ?? Promise.resolve([]),
            pauseAll: () => uploaderInstance?.pauseAll(),
            resumeAll: () => uploaderInstance?.resumeAll(),
            cancelAll: () => uploaderInstance?.cancelAll(),
            clearCompleted: () => uploaderInstance?.clearCompleted(),
            clearAll: () => uploaderInstance?.clearAll(),
            getItems: () => uploaderInstance?.getItems() ?? [],
            getOverallProgress: () => uploaderInstance?.getOverallProgress(),
            getInstance: () => uploaderInstance,
        });

        return () => h('div', { ref: containerRef, class: 'jengo-uploader-host' });
    },
});

export const UploadModal = defineComponent({
    name: 'UploadModal',
    props: JengoUploader.props,
    emits: JengoUploader.emits,
    setup(props, context) {
        return () => h(JengoUploader, { ...props, modal: true }, context.slots);
    },
});
