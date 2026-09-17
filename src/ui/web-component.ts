import { JengoUploaderUI } from './uploader-ui.js';
import { UploaderTheme, UploaderUIOptions, UploaderVariant } from './types.js';

const BaseElement: typeof HTMLElement = typeof HTMLElement !== 'undefined'
    ? HTMLElement
    : (class {} as unknown as typeof HTMLElement);

export class JengoUploaderElement extends BaseElement {
    private uploaderInstance: JengoUploaderUI | null = null;

    static get observedAttributes(): string[] {
        return [
            'disk',
            'folder',
            'variant',
            'theme',
            'multiple',
            'modal',
            'auto-upload',
            'chunked',
            'chunk-size',
            'concurrency',
            'max-files',
            'max-file-size',
            'allowed-types',
            'modal-title',
        ];
    }

    connectedCallback(): void {
        this.initializeUploader();
    }

    disconnectedCallback(): void {
        if (this.uploaderInstance) {
            this.uploaderInstance.destroy();
            this.uploaderInstance = null;
        }
    }

    attributeChangedCallback(): void {
        if (this.uploaderInstance) {
            this.uploaderInstance.updateOptions(this.extractOptionsFromAttributes());
        }
    }

    private extractOptionsFromAttributes(): UploaderUIOptions {
        const getAttr = (name: string) => this.getAttribute(name);
        const hasAttr = (name: string) => this.hasAttribute(name);

        const allowedTypesStr = getAttr('allowed-types');
        const allowedTypes = allowedTypesStr ? allowedTypesStr.split(',').map(s => s.trim()) : undefined;

        const isModal = hasAttr('modal') && getAttr('modal') !== 'false';
        const isMultiple = !hasAttr('multiple') || getAttr('multiple') !== 'false';
        const autoUpload = !hasAttr('auto-upload') || getAttr('auto-upload') !== 'false';

        return {
            disk: getAttr('disk') || undefined,
            folder: getAttr('folder') || undefined,
            variant: (getAttr('variant') as UploaderVariant) || 'dropzone',
            theme: (getAttr('theme') as UploaderTheme) || 'light',
            modal: isModal,
            modalTitle: getAttr('modal-title') || undefined,
            multiple: isMultiple,
            autoUpload,
            chunked: getAttr('chunked') === 'true' ? true : getAttr('chunked') === 'false' ? false : 'auto',
            chunkSize: getAttr('chunk-size') ? parseInt(getAttr('chunk-size')!, 10) : undefined,
            concurrency: getAttr('concurrency') ? parseInt(getAttr('concurrency')!, 10) : undefined,
            maxFiles: getAttr('max-files') ? parseInt(getAttr('max-files')!, 10) : undefined,
            maxFileSize: getAttr('max-file-size') ? parseInt(getAttr('max-file-size')!, 10) : undefined,
            allowedTypes,
            onComplete: (results, queue) => {
                this.dispatchEvent(new CustomEvent('jengo:complete', {
                    bubbles: true,
                    composed: true,
                    detail: { results, queue },
                }));
            },
            onFileSuccess: (item, result) => {
                this.dispatchEvent(new CustomEvent('jengo:file-success', {
                    bubbles: true,
                    composed: true,
                    detail: { item, result },
                }));
            },
            onFileError: (item, error) => {
                this.dispatchEvent(new CustomEvent('jengo:file-error', {
                    bubbles: true,
                    composed: true,
                    detail: { item, error },
                }));
            },
            onUploadProgress: (item, overall) => {
                this.dispatchEvent(new CustomEvent('jengo:progress', {
                    bubbles: true,
                    composed: true,
                    detail: { item, overall },
                }));
            },
            onFilesAdded: (files, queue) => {
                this.dispatchEvent(new CustomEvent('jengo:files-added', {
                    bubbles: true,
                    composed: true,
                    detail: { files, queue },
                }));
            },
        };
    }

    private initializeUploader(): void {
        if (this.uploaderInstance) {
            this.uploaderInstance.destroy();
        }

        const options = this.extractOptionsFromAttributes();
        this.uploaderInstance = new JengoUploaderUI(this, options);
    }

    public open(): void {
        this.uploaderInstance?.open();
    }

    public close(): void {
        this.uploaderInstance?.close();
    }

    public upload(): Promise<unknown> {
        return this.uploaderInstance ? this.uploaderInstance.upload() : Promise.resolve([]);
    }

    public get instance(): JengoUploaderUI | null {
        return this.uploaderInstance;
    }
}

/**
 * Register the <jengo-uploader> custom element in the browser.
 */
export function registerJengoUploader(tagName: string = 'jengo-uploader'): void {
    if (typeof window !== 'undefined' && 'customElements' in window) {
        if (!window.customElements.get(tagName)) {
            window.customElements.define(tagName, JengoUploaderElement);
        }
    }
}
