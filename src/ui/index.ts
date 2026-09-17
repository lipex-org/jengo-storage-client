export * from './types.js';
export * from './theme.js';
export * from './styles.js';
export * from './queue.js';
export * from './dom-renderer.js';
export * from './uploader-ui.js';
export * from './web-component.js';

import { registerJengoUploader } from './web-component.js';

// Auto-register custom element if window and customElements are defined
if (typeof window !== 'undefined' && 'customElements' in window) {
    registerJengoUploader();
}
