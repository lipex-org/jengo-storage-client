export const UPLOADER_STYLES = `
/* Jengo Uploader Core Scoped Stylesheet */
.jengo-uploader {
    font-family: var(--jengo-font, system-ui, -apple-system, sans-serif);
    color: var(--jengo-text, #0f172a);
    background-color: var(--jengo-bg, #ffffff);
    border: 1px solid var(--jengo-border, #e2e8f0);
    border-radius: var(--jengo-radius, 0.625rem);
    box-shadow: var(--jengo-shadow, none);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 100%;
    position: relative;
    overflow: hidden;
    line-height: 1.5;
    transition: all 0.2s ease;
}

.jengo-uploader *, .jengo-uploader *::before, .jengo-uploader *::after {
    box-sizing: border-box;
}

/* Glass Theme Blur */
.jengo-uploader[data-theme="glass"] {
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
}

/* Header */
.jengo-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1.25rem;
    border-bottom: 1px solid var(--jengo-border, #e2e8f0);
    background-color: var(--jengo-surface, #f8fafc);
}

.jengo-header-title {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    color: var(--jengo-text, #0f172a);
}

.jengo-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

/* Dropzone */
.jengo-dropzone {
    padding: 2.25rem 1.5rem;
    margin: 1rem 1.25rem;
    border: 2px dashed var(--jengo-border-dashed, #cbd5e1);
    border-radius: var(--jengo-radius, 0.625rem);
    background-color: var(--jengo-surface, #f8fafc);
    text-align: center;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
}

.jengo-dropzone:hover, .jengo-dropzone.jengo-dragover {
    border-color: var(--jengo-primary, #2563eb);
    background-color: var(--jengo-surface-hover, #f1f5f9);
    transform: translateY(-1px);
}

.jengo-dropzone-icon {
    width: 2.75rem;
    height: 2.75rem;
    color: var(--jengo-primary, #2563eb);
    margin-bottom: 0.25rem;
}

.jengo-dropzone-prompt {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--jengo-text, #0f172a);
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
    justify-content: center;
}

.jengo-browse-link {
    color: var(--jengo-primary, #2563eb);
    text-decoration: underline;
    text-underline-offset: 2px;
    font-weight: 600;
    cursor: pointer;
}

.jengo-browse-link:hover {
    color: var(--jengo-primary-hover, #1d4ed8);
}

.jengo-dropzone-subtext {
    font-size: 0.8125rem;
    color: var(--jengo-text-muted, #64748b);
    max-width: 24rem;
}

/* File List */
.jengo-file-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0 1.25rem 1rem 1.25rem;
    max-height: 22rem;
    overflow-y: auto;
    overflow-x: hidden;
}

.jengo-file-item {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.75rem 1rem;
    background-color: var(--jengo-surface, #f8fafc);
    border: 1px solid var(--jengo-border, #e2e8f0);
    border-radius: var(--jengo-radius-sm, 0.375rem);
    position: relative;
    flex-shrink: 0;
    min-height: 4.25rem;
    box-sizing: border-box;
}

.jengo-file-item-thumb {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--jengo-radius-sm, 0.375rem);
    object-fit: cover;
    background-color: var(--jengo-border, #e2e8f0);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    user-select: none;
}

.jengo-thumb-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* Specific Badge Theming */
.jengo-thumb-pdf {
    background-color: #fee2e2;
    color: #b91c1c;
    border: 1px solid #fecaca;
}

.jengo-thumb-video {
    background-color: #ede9fe;
    color: #6d28d9;
    border: 1px solid #ddd6fe;
}

.jengo-thumb-audio {
    background-color: #fef3c7;
    color: #b45309;
    border: 1px solid #fde68a;
}

.jengo-thumb-archive {
    background-color: #fef9c3;
    color: #854d0e;
    border: 1px solid #fef08a;
}

.jengo-thumb-code {
    background-color: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
}

.jengo-thumb-doc {
    background-color: #e0f2fe;
    color: #0369a1;
    border: 1px solid #bae6fd;
}

.jengo-thumb-default {
    background-color: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
}

.jengo-thumb-image {
    background-color: #ede9fe;
    color: #5b21b6;
    border: 1px solid #ddd6fe;
}

[data-theme="dark"] .jengo-thumb-pdf {
    background-color: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.3);
}

[data-theme="dark"] .jengo-thumb-video {
    background-color: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    border-color: rgba(139, 92, 246, 0.3);
}

[data-theme="dark"] .jengo-thumb-audio {
    background-color: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border-color: rgba(245, 158, 11, 0.3);
}

[data-theme="dark"] .jengo-thumb-archive {
    background-color: rgba(234, 179, 8, 0.2);
    color: #facc15;
    border-color: rgba(234, 179, 8, 0.3);
}

[data-theme="dark"] .jengo-thumb-code {
    background-color: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border-color: rgba(16, 185, 129, 0.3);
}

[data-theme="dark"] .jengo-thumb-doc {
    background-color: rgba(14, 165, 233, 0.2);
    color: #38bdf8;
    border-color: rgba(14, 165, 233, 0.3);
}

[data-theme="dark"] .jengo-thumb-image {
    background-color: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    border-color: rgba(139, 92, 246, 0.3);
}

[data-theme="dark"] .jengo-thumb-default {
    background-color: rgba(100, 116, 139, 0.2);
    color: #94a3b8;
    border-color: rgba(100, 116, 139, 0.3);
}

.jengo-file-item-icon {
    width: 1.5rem;
    height: 1.5rem;
    color: var(--jengo-text-muted, #64748b);
}

.jengo-file-item-info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
}

.jengo-file-item-name {
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.5;
    color: var(--jengo-text, #0f172a);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-top: 2px;
    padding-bottom: 2px;
    display: block;
}

.jengo-file-item-meta {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 0.75rem;
    line-height: 1.4;
    color: var(--jengo-text-muted, #64748b);
    flex-wrap: wrap;
}

/* Status Badges */
.jengo-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
}

.jengo-badge-queued {
    background-color: #f1f5f9;
    color: #475569;
}

.jengo-badge-uploading {
    background-color: #dbeafe;
    color: #1d4ed8;
}

.jengo-badge-paused {
    background-color: #fef3c7;
    color: #b45309;
}

.jengo-badge-completed {
    background-color: #d1fae5;
    color: #047857;
}

.jengo-badge-error {
    background-color: #fee2e2;
    color: #b91c1c;
}

.jengo-badge-canceled {
    background-color: #f3f4f6;
    color: #6b7280;
}

/* Progress Bars */
.jengo-progress-bar-container {
    width: 100%;
    height: 0.375rem;
    background-color: var(--jengo-border, #e2e8f0);
    border-radius: 9999px;
    overflow: hidden;
    margin-top: 0.25rem;
}

.jengo-progress-bar-fill {
    height: 100%;
    background-color: var(--jengo-primary, #2563eb);
    border-radius: 9999px;
    transition: width 0.15s ease;
}

.jengo-progress-bar-fill.jengo-completed {
    background-color: var(--jengo-success, #10b981);
}

.jengo-progress-bar-fill.jengo-error {
    background-color: var(--jengo-error, #ef4444);
}

/* Action Buttons */
.jengo-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    font-family: inherit;
    font-size: 0.8125rem;
    font-weight: 500;
    padding: 0.4375rem 0.875rem;
    border-radius: var(--jengo-radius-sm, 0.375rem);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    text-decoration: none;
}

.jengo-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.jengo-btn-primary {
    background-color: var(--jengo-primary, #2563eb);
    color: var(--jengo-primary-text, #ffffff);
}

.jengo-btn-primary:hover:not(:disabled) {
    background-color: var(--jengo-primary-hover, #1d4ed8);
}

.jengo-btn-secondary {
    background-color: transparent;
    color: var(--jengo-text, #0f172a);
    border-color: var(--jengo-border, #e2e8f0);
}

.jengo-btn-secondary:hover:not(:disabled) {
    background-color: var(--jengo-surface-hover, #f1f5f9);
}

.jengo-btn-ghost {
    background-color: transparent;
    color: var(--jengo-text-muted, #64748b);
    padding: 0.3125rem;
}

.jengo-btn-ghost:hover:not(:disabled) {
    color: var(--jengo-text, #0f172a);
    background-color: var(--jengo-surface-hover, #f1f5f9);
}

.jengo-btn-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
}

/* Footer & Overall Summary */
.jengo-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.875rem 1.25rem;
    border-top: 1px solid var(--jengo-border, #e2e8f0);
    background-color: var(--jengo-surface, #f8fafc);
    gap: 1rem;
    flex-wrap: wrap;
}

.jengo-footer-summary {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 10rem;
}

.jengo-footer-stats {
    font-size: 0.75rem;
    color: var(--jengo-text-muted, #64748b);
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.jengo-footer-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

/* Variant: Compact */
.jengo-uploader--compact {
    padding: 0.75rem 1rem;
    gap: 0.5rem;
}

.jengo-uploader--compact .jengo-header,
.jengo-uploader--compact .jengo-footer {
    display: none;
}

.jengo-uploader--compact .jengo-dropzone {
    margin: 0;
    padding: 1rem;
}

.jengo-uploader--compact .jengo-dropzone-icon {
    width: 1.75rem;
    height: 1.75rem;
}

/* Variant: Minimal */
.jengo-uploader--minimal {
    border-radius: var(--jengo-radius-sm, 0.25rem);
    border-width: 1px;
}

.jengo-uploader--minimal .jengo-dropzone {
    border-style: solid;
    border-width: 1px;
    padding: 1.25rem 1rem;
    margin: 0.75rem;
}

.jengo-uploader--minimal .jengo-header {
    padding: 0.625rem 1rem;
}

.jengo-uploader--minimal .jengo-footer {
    padding: 0.625rem 1rem;
}

/* Variant: Button Only */
.jengo-uploader--button {
    border: none;
    box-shadow: none;
    background: transparent;
    display: inline-block;
    width: auto;
}

/* Modal Overlay & Dialog */
.jengo-modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--jengo-backdrop, rgba(0, 0, 0, 0.5));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 1.25rem;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease-out;
}

.jengo-modal-backdrop.jengo-open {
    opacity: 1;
    pointer-events: auto;
}

.jengo-modal-dialog {
    width: 100%;
    max-width: 36rem;
    max-height: 90vh;
    overflow-y: auto;
    background-color: var(--jengo-bg, #ffffff);
    border-radius: var(--jengo-radius, 0.625rem);
    box-shadow: var(--jengo-shadow-modal, 0 25px 50px -12px rgba(0, 0, 0, 0.25));
    transform: translateY(12px) scale(0.98);
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.jengo-modal-backdrop.jengo-open .jengo-modal-dialog {
    transform: translateY(0) scale(1);
}

/* Hidden File Input */
.jengo-hidden-input {
    display: none !important;
}

/* Error Message Box */
.jengo-error-banner {
    margin: 0 1.25rem 0.75rem 1.25rem;
    padding: 0.625rem 0.875rem;
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
    border-radius: var(--jengo-radius-sm, 0.375rem);
    font-size: 0.8125rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
}
`;

export function injectUploaderStyles(targetDocument?: Document): void {
    if (typeof document === 'undefined' && !targetDocument) return;
    const doc = targetDocument ?? (typeof document !== 'undefined' ? document : undefined);
    if (!doc || !doc.getElementById || !doc.head) return;
    const styleId = 'jengo-uploader-styles';
    if (!doc.getElementById(styleId)) {
        const style = doc.createElement('style');
        style.id = styleId;
        style.textContent = UPLOADER_STYLES;
        doc.head.appendChild(style);
    }
}
