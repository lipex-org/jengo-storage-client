import {
    FileQueueItem,
    UploaderLabels,
    UploaderRenderContext,
    UploaderUIOptions,
} from './types.js';
import { UploadProgress, UploadResult } from '../types.js';
import { DEFAULT_LABELS, resolveThemeVariables } from './theme.js';
import { injectUploaderStyles } from './styles.js';
import { UploadQueueManager } from './queue.js';
import { formatDuration } from '../support/speed.js';

// Clean inline SVG vectors (Strictly zero emojis)
const ICONS = {
    cloudUpload: `<svg class="jengo-dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>`,
    file: `<svg class="jengo-file-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`,
    pause: `<svg class="jengo-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
    play: `<svg class="jengo-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>`,
    close: `<svg class="jengo-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`,
    trash: `<svg class="jengo-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`,
    retry: `<svg class="jengo-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`,
    check: `<svg class="jengo-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
};

export class DomUploaderRenderer {
    private container: HTMLElement;
    private options: UploaderUIOptions;
    private queue: UploadQueueManager;
    private labels: UploaderLabels;
    private rootEl!: HTMLElement;
    private modalBackdropEl?: HTMLElement;
    private fileInputEl!: HTMLInputElement;
    private unsubscribe?: () => void;
    private isModalOpen = false;

    constructor(container: HTMLElement, options: UploaderUIOptions = {}, queue?: UploadQueueManager) {
        this.container = container;
        this.options = {
            variant: 'dropzone',
            theme: 'light',
            modal: false,
            showDropzone: true,
            showFileList: true,
            showProgress: true,
            showDetails: true,
            showThumbnails: true,
            allowPause: true,
            allowCancel: true,
            allowRemove: true,
            allowRetry: true,
            allowClearCompleted: true,
            closeOnBackdrop: true,
            ...options,
        };
        this.labels = { ...DEFAULT_LABELS, ...this.options.labels };
        this.queue = queue ?? new UploadQueueManager(this.options);

        injectUploaderStyles(this.container.ownerDocument || document);
        this.initDOM();
        this.applyTheme();
        this.bindEvents();

        this.unsubscribe = this.queue.subscribe((items, overall) => {
            this.render(items, overall);
        });

        if (this.options.modal && this.options.isOpen) {
            this.openModal();
        }
    }

    private initDOM(): void {
        const doc = this.container.ownerDocument || document;

        // Hidden input for file selection
        this.fileInputEl = doc.createElement('input');
        this.fileInputEl.type = 'file';
        this.fileInputEl.className = 'jengo-hidden-input';
        this.fileInputEl.multiple = this.options.multiple !== false;
        if (this.options.allowedTypes && this.options.allowedTypes.length > 0) {
            this.fileInputEl.accept = this.options.allowedTypes.join(',');
        }

        if (this.options.modal) {
            this.modalBackdropEl = doc.createElement('div');
            this.modalBackdropEl.className = 'jengo-modal-backdrop';

            const dialog = doc.createElement('div');
            dialog.className = 'jengo-modal-dialog';

            this.rootEl = doc.createElement('div');
            this.rootEl.className = `jengo-uploader jengo-uploader--${this.options.variant || 'dropzone'} ${this.options.className || ''}`;

            dialog.appendChild(this.rootEl);
            this.modalBackdropEl.appendChild(dialog);
            this.container.appendChild(this.modalBackdropEl);
        } else {
            this.rootEl = doc.createElement('div');
            this.rootEl.className = `jengo-uploader jengo-uploader--${this.options.variant || 'dropzone'} ${this.options.className || ''}`;
            this.container.appendChild(this.rootEl);
        }

        this.rootEl.appendChild(this.fileInputEl);
    }

    private applyTheme(): void {
        const themeVars = resolveThemeVariables(this.options.theme, this.options.themeVariables);
        const target = this.modalBackdropEl || this.rootEl;

        target.setAttribute('data-theme', this.options.theme || 'light');
        for (const [k, v] of Object.entries(themeVars)) {
            target.style.setProperty(k, v);
        }

        if (this.options.style) {
            for (const [k, v] of Object.entries(this.options.style)) {
                this.rootEl.style.setProperty(k, v);
            }
        }
    }

    private bindEvents(): void {
        // File input change
        this.fileInputEl.addEventListener('change', (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
                this.queue.addFiles(files);
                this.fileInputEl.value = '';
            }
        });

        // Modal backdrop click
        if (this.modalBackdropEl && this.options.closeOnBackdrop !== false) {
            this.modalBackdropEl.addEventListener('click', (e) => {
                if (e.target === this.modalBackdropEl) {
                    this.closeModal();
                }
            });
        }

        // Global ESC key listener for modal
        if (this.options.modal) {
            const onKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape' && this.isModalOpen) {
                    this.closeModal();
                }
            };
            this.container.ownerDocument?.addEventListener('keydown', onKeyDown);
        }
    }

    public openModal(): void {
        if (!this.modalBackdropEl) return;
        this.isModalOpen = true;
        this.modalBackdropEl.classList.add('jengo-open');
        this.options.onOpen?.();
    }

    public closeModal(): void {
        if (!this.modalBackdropEl) return;
        this.isModalOpen = false;
        this.modalBackdropEl.classList.remove('jengo-open');
        this.options.onClose?.();
    }

    public openFilePicker(): void {
        this.fileInputEl.click();
    }

    public updateOptions(newOptions: Partial<UploaderUIOptions>): void {
        this.options = { ...this.options, ...newOptions };
        this.labels = { ...DEFAULT_LABELS, ...this.options.labels };
        this.queue.updateOptions(this.options);
        this.fileInputEl.multiple = this.options.multiple !== false;
        if (this.options.allowedTypes) {
            this.fileInputEl.accept = this.options.allowedTypes.join(',');
        }
        this.applyTheme();
        this.render(this.queue.getItems(), this.queue.getOverallProgress());
    }

    private getRenderContext(items: FileQueueItem[], overall: UploadProgress): UploaderRenderContext {
        const isUploading = items.some(i => i.status === 'uploading');
        const isCompleted = items.length > 0 && items.every(i => i.status === 'completed');
        const hasErrors = items.some(i => i.status === 'error');

        return {
            items,
            overallProgress: overall,
            isUploading,
            isCompleted,
            hasErrors,
            startUpload: () => this.queue.startUpload(),
            pauseAll: () => this.queue.pauseAll(),
            resumeAll: () => {
                this.queue.resumeAll();
                return this.queue.startUpload();
            },
            cancelAll: () => this.queue.cancelAll(),
            clearCompleted: () => this.queue.clearCompleted(),
            openFilePicker: () => this.openFilePicker(),
            closeModal: this.options.modal ? () => this.closeModal() : undefined,
        };
    }

    private render(items: FileQueueItem[], overall: UploadProgress): void {
        const ctx = this.getRenderContext(items, overall);

        // Preserve file input element
        const fileInput = this.fileInputEl;

        // Clear root except input
        this.rootEl.innerHTML = '';
        this.rootEl.appendChild(fileInput);

        // 1. Render Header (if modal or standard dropzone variant)
        if (this.options.variant !== 'compact' && this.options.variant !== 'button') {
            if (this.options.renderHeader) {
                const customHeader = this.options.renderHeader(ctx);
                this.appendContent(this.rootEl, customHeader);
            } else {
                const header = document.createElement('div');
                header.className = 'jengo-header';

                const title = document.createElement('h3');
                title.className = 'jengo-header-title';
                title.textContent = this.options.modal ? (this.options.modalTitle || this.labels.title) : this.labels.title;
                header.appendChild(title);

                const actions = document.createElement('div');
                actions.className = 'jengo-header-actions';

                if (this.options.modal) {
                    const closeBtn = document.createElement('button');
                    closeBtn.className = 'jengo-btn jengo-btn-ghost';
                    closeBtn.type = 'button';
                    closeBtn.title = this.labels.closeModalButton;
                    closeBtn.innerHTML = ICONS.close;
                    closeBtn.onclick = () => this.closeModal();
                    actions.appendChild(closeBtn);
                }

                header.appendChild(actions);
                this.rootEl.appendChild(header);
            }
        }

        // 2. Render Variant: Button Only
        if (this.options.variant === 'button') {
            const btn = document.createElement('button');
            btn.className = 'jengo-btn jengo-btn-primary';
            btn.type = 'button';
            btn.innerHTML = `${ICONS.cloudUpload} <span>${this.labels.browseButton}</span>`;
            btn.onclick = () => {
                if (this.options.modal) {
                    this.openModal();
                } else {
                    this.openFilePicker();
                }
            };
            this.rootEl.appendChild(btn);
            return;
        }

        // 3. Render Dropzone
        if (this.options.showDropzone !== false) {
            if (this.options.renderDropzone) {
                const customDropzone = this.options.renderDropzone(ctx);
                this.appendContent(this.rootEl, customDropzone);
            } else {
                const dropzone = document.createElement('div');
                dropzone.className = 'jengo-dropzone';
                dropzone.innerHTML = `
                    ${ICONS.cloudUpload}
                    <div class="jengo-dropzone-prompt">
                        <span>${this.labels.dropzonePrompt}</span>
                        <span class="jengo-browse-link">${this.labels.browseButton}</span>
                    </div>
                    <div class="jengo-dropzone-subtext">${this.labels.dropzoneSubtext}</div>
                `;

                dropzone.onclick = () => this.openFilePicker();

                // Drag and drop listeners
                dropzone.ondragover = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.classList.add('jengo-dragover');
                };

                dropzone.ondragleave = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.classList.remove('jengo-dragover');
                };

                dropzone.ondrop = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.classList.remove('jengo-dragover');
                    const files = e.dataTransfer?.files;
                    if (files && files.length > 0) {
                        this.queue.addFiles(files);
                    }
                };

                this.rootEl.appendChild(dropzone);
            }
        }

        // 4. Render File List
        if (this.options.showFileList !== false && items.length > 0) {
            const list = document.createElement('div');
            list.className = 'jengo-file-list';

            for (const item of items) {
                if (this.options.renderFileItem) {
                    const customItem = this.options.renderFileItem(item, ctx);
                    this.appendContent(list, customItem);
                } else {
                    list.appendChild(this.createFileItemElement(item));
                }
            }

            this.rootEl.appendChild(list);
        }

        // 5. Render Footer & Progress Summary
        if (this.options.variant !== 'compact') {
            if (this.options.renderFooter) {
                const customFooter = this.options.renderFooter(ctx);
                this.appendContent(this.rootEl, customFooter);
            } else if (items.length > 0 || !this.options.autoUpload) {
                const footer = this.createFooterElement(ctx);
                this.rootEl.appendChild(footer);
            }
        }
    }

    private createFileItemElement(item: FileQueueItem): HTMLElement {
        const el = document.createElement('div');
        el.className = 'jengo-file-item';

        // Thumbnail / Icon
        if (this.options.showThumbnails !== false) {
            if (item.previewUrl) {
                const img = document.createElement('img');
                img.className = 'jengo-file-item-thumb';
                img.src = item.previewUrl;
                img.alt = item.name;
                el.appendChild(img);
            } else {
                const iconBox = document.createElement('div');
                iconBox.className = 'jengo-file-item-thumb';
                iconBox.innerHTML = ICONS.file;
                el.appendChild(iconBox);
            }
        }

        // Info container
        const info = document.createElement('div');
        info.className = 'jengo-file-item-info';

        const nameRow = document.createElement('div');
        nameRow.className = 'jengo-file-item-name';
        nameRow.textContent = item.name;
        info.appendChild(nameRow);

        const metaRow = document.createElement('div');
        metaRow.className = 'jengo-file-item-meta';

        const sizeSpan = document.createElement('span');
        sizeSpan.textContent = item.formattedSize;
        metaRow.appendChild(sizeSpan);

        const statusBadge = document.createElement('span');
        statusBadge.className = `jengo-badge jengo-badge-${item.status}`;
        statusBadge.textContent = this.getStatusLabel(item.status);
        metaRow.appendChild(statusBadge);

        if (this.options.showDetails !== false && item.status === 'uploading') {
            if (item.progress.speed && item.progress.speed !== '0 B/s') {
                const speedSpan = document.createElement('span');
                speedSpan.textContent = item.progress.speed;
                metaRow.appendChild(speedSpan);
            }
            if (item.progress.remainingSeconds !== null && item.progress.remainingSeconds > 0) {
                const etaSpan = document.createElement('span');
                etaSpan.textContent = `${this.labels.etaLabel}: ${formatDuration(item.progress.remainingSeconds)}`;
                metaRow.appendChild(etaSpan);
            }
        }

        if (item.error) {
            const errSpan = document.createElement('span');
            errSpan.style.color = 'var(--jengo-error, #ef4444)';
            errSpan.textContent = item.error.message;
            metaRow.appendChild(errSpan);
        }

        info.appendChild(metaRow);

        // Progress bar for item
        if (this.options.showProgress !== false && (item.status === 'uploading' || item.status === 'paused' || item.status === 'completed')) {
            const barContainer = document.createElement('div');
            barContainer.className = 'jengo-progress-bar-container';

            const fill = document.createElement('div');
            fill.className = `jengo-progress-bar-fill ${item.status === 'completed' ? 'jengo-completed' : ''}`;
            fill.style.width = `${item.progress.percent}%`;
            barContainer.appendChild(fill);

            info.appendChild(barContainer);
        }

        el.appendChild(info);

        // Action controls per file
        const actions = document.createElement('div');
        actions.className = 'jengo-header-actions';

        if (this.options.allowPause !== false && item.status === 'uploading' && item.uploader && 'pause' in item.uploader) {
            const pauseBtn = document.createElement('button');
            pauseBtn.className = 'jengo-btn jengo-btn-ghost';
            pauseBtn.type = 'button';
            pauseBtn.title = this.labels.pauseButton;
            pauseBtn.innerHTML = ICONS.pause;
            pauseBtn.onclick = () => this.queue.pauseItem(item.id);
            actions.appendChild(pauseBtn);
        }

        if (this.options.allowPause !== false && item.status === 'paused') {
            const resumeBtn = document.createElement('button');
            resumeBtn.className = 'jengo-btn jengo-btn-ghost';
            resumeBtn.type = 'button';
            resumeBtn.title = this.labels.resumeButton;
            resumeBtn.innerHTML = ICONS.play;
            resumeBtn.onclick = () => this.queue.resumeItem(item.id);
            actions.appendChild(resumeBtn);
        }

        if (this.options.allowRetry !== false && (item.status === 'error' || item.status === 'canceled')) {
            const retryBtn = document.createElement('button');
            retryBtn.className = 'jengo-btn jengo-btn-ghost';
            retryBtn.type = 'button';
            retryBtn.title = this.labels.retryButton;
            retryBtn.innerHTML = ICONS.retry;
            retryBtn.onclick = () => this.queue.retryItem(item.id);
            actions.appendChild(retryBtn);
        }

        if (this.options.allowCancel !== false && item.status === 'uploading') {
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'jengo-btn jengo-btn-ghost';
            cancelBtn.type = 'button';
            cancelBtn.title = this.labels.cancelButton;
            cancelBtn.innerHTML = ICONS.close;
            cancelBtn.onclick = () => this.queue.cancelItem(item.id);
            actions.appendChild(cancelBtn);
        }

        if (this.options.allowRemove !== false && item.status !== 'uploading') {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'jengo-btn jengo-btn-ghost';
            removeBtn.type = 'button';
            removeBtn.title = this.labels.removeButton;
            removeBtn.innerHTML = ICONS.trash;
            removeBtn.onclick = () => this.queue.removeItem(item.id);
            actions.appendChild(removeBtn);
        }

        el.appendChild(actions);
        return el;
    }

    private createFooterElement(ctx: UploaderRenderContext): HTMLElement {
        const footer = document.createElement('div');
        footer.className = 'jengo-footer';

        const summary = document.createElement('div');
        summary.className = 'jengo-footer-summary';

        if (this.options.showProgress !== false && ctx.items.length > 0) {
            const statText = `${this.labels.totalProgressLabel}: ${ctx.overallProgress.percent}% (${ctx.overallProgress.chunkIndex}/${ctx.overallProgress.totalChunks})`;
            const stats = document.createElement('div');
            stats.className = 'jengo-footer-stats';
            stats.innerHTML = `
                <span>${statText}</span>
                ${ctx.overallProgress.speed && ctx.overallProgress.speed !== '0 B/s' ? `<span>${ctx.overallProgress.speed}</span>` : ''}
            `;
            summary.appendChild(stats);

            const barContainer = document.createElement('div');
            barContainer.className = 'jengo-progress-bar-container';

            const fill = document.createElement('div');
            fill.className = `jengo-progress-bar-fill ${ctx.isCompleted ? 'jengo-completed' : ''} ${ctx.hasErrors ? 'jengo-error' : ''}`;
            fill.style.width = `${ctx.overallProgress.percent}%`;
            barContainer.appendChild(fill);

            summary.appendChild(barContainer);
        }

        footer.appendChild(summary);

        const actions = document.createElement('div');
        actions.className = 'jengo-footer-actions';

        if (this.options.allowClearCompleted !== false && ctx.items.some(i => i.status === 'completed')) {
            const clearBtn = document.createElement('button');
            clearBtn.className = 'jengo-btn jengo-btn-secondary';
            clearBtn.type = 'button';
            clearBtn.textContent = this.labels.clearCompletedButton;
            clearBtn.onclick = () => this.queue.clearCompleted();
            actions.appendChild(clearBtn);
        }

        if (!this.options.autoUpload && ctx.items.some(i => i.status === 'queued')) {
            const uploadBtn = document.createElement('button');
            uploadBtn.className = 'jengo-btn jengo-btn-primary';
            uploadBtn.type = 'button';
            uploadBtn.textContent = this.labels.uploadButton;
            uploadBtn.onclick = () => this.queue.startUpload();
            actions.appendChild(uploadBtn);
        }

        footer.appendChild(actions);
        return footer;
    }

    private getStatusLabel(status: string): string {
        switch (status) {
            case 'queued': return this.labels.statusQueued;
            case 'uploading': return this.labels.statusUploading;
            case 'paused': return this.labels.statusPaused;
            case 'completed': return this.labels.statusCompleted;
            case 'error': return this.labels.statusError;
            case 'canceled': return this.labels.statusCanceled;
            default: return status;
        }
    }

    private appendContent(parent: HTMLElement, content: HTMLElement | string): void {
        if (typeof content === 'string') {
            const tmp = document.createElement('div');
            tmp.innerHTML = content;
            while (tmp.firstChild) {
                parent.appendChild(tmp.firstChild);
            }
        } else if (content instanceof HTMLElement) {
            parent.appendChild(content);
        }
    }

    public destroy(): void {
        this.unsubscribe?.();
        this.queue.cancelAll();
        if (this.modalBackdropEl) {
            this.modalBackdropEl.remove();
        } else {
            this.rootEl.remove();
        }
    }
}
