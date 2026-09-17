# @jengo/storage

Universal TypeScript client library for Jengo Storage. Provides chunked multipart uploading, concurrent streaming, pause/resume/abort capabilities, transfer speed & ETA estimators, instant client-side previews, direct-to-cloud S3/R2 transfers, and first-class adapters for React, Vue, and Svelte.

Designed to pair seamlessly with the backend `jengo/storage` package.

---

## Features

- Chunked File Uploads: Automatically slices large files into configurable chunk sizes (e.g. 2 MB, 5 MB) and streams them concurrently.
- Resumability and Concurrency: Configurable concurrency pool (default 3 streams) with automatic retry backoff and pause/resume/abort controls.
- Memory-Safe Backend Assembly: Pairs with `Jengo\Storage\Controllers\ChunkUploadController` for low-memory buffered stream concatenation.
- Web Crypto SHA-256 Integrity: Computes chunk-level and total-file SHA-256 hashes in the browser for end-to-end verification.
- Zero Boilerplate CSRF: Automatically detects and injects CodeIgniter 4 CSRF tokens from meta tags, cookies (`csrf_cookie_name`), or window globals.
- Instant Client Previews: Generates client-side thumbnail previews, dimensions, and metadata before transmission begins.
- Framework Adapters: Zero-friction hooks and stores for React (`useChunkedUpload`, `useUpload`), Vue 3 (`useChunkedUpload`, `useUpload`), and Svelte (`createChunkedUpload`, `createUpload`).
- Direct Cloud Transfers: Presigned PUT/POST support for S3, Cloudflare R2, and Google Cloud Storage.

---

## Installation

```bash
# npm
npm install @jengo/storage

# pnpm
pnpm add @jengo/storage

# yarn
yarn add @jengo/storage
```

---

## Quick Start (Vanilla TypeScript / JavaScript)

### 1. Chunked Upload

```typescript
import { ChunkedUploader } from '@jengo/storage';

const fileInput = document.querySelector<HTMLInputElement>('#fileInput')!;

fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const uploader = new ChunkedUploader(file, {
        chunkSize: 2 * 1024 * 1024, // 2 MB parts
        concurrency: 3,             // 3 parallel streams
        disk: 'public',             // destination disk
        folder: 'uploads/videos',
        computeChecksums: true,
        onProgress: (progress) => {
            console.log(`Progress: ${progress.percent}% | Speed: ${progress.speed} | ETA: ${progress.remainingSeconds}s`);
        },
        onStatusChange: (status) => {
            console.log(`Status changed to: ${status}`);
        },
        onSuccess: (result) => {
            console.log('File uploaded and assembled:', result.url);
        },
        onError: (err) => {
            console.error('Upload failed:', err);
        },
    });

    // Control upload lifecycle
    await uploader.start();

    // To pause or resume:
    // uploader.pause();
    // await uploader.resume();

    // To abort and clean staging on server:
    // await uploader.abort();
});
```

### 2. Instant Client-Side Previews

```typescript
import { createFilePreview } from '@jengo/storage';

const preview = await createFilePreview(file);
console.log(`Name: ${preview.name}, Size: ${preview.sizeFormatted}`);

if (preview.isImage) {
    const imgElement = document.createElement('img');
    imgElement.src = preview.url!;
    console.log(`Dimensions: ${preview.width}x${preview.height}`);
    document.body.appendChild(imgElement);
}

// When done, free the browser object URL
preview.revoke();
```

---

## Framework Adapters

### React

```tsx
import React, { useState } from 'react';
import { useChunkedUpload } from '@jengo/storage/react';

export function VideoUploader() {
    const [file, setFile] = useState<File | null>(null);
    const {
        status,
        progress,
        result,
        error,
        isUploading,
        isPaused,
        start,
        pause,
        resume,
        abort,
    } = useChunkedUpload({
        chunkSize: 2 * 1024 * 1024,
        concurrency: 3,
        disk: 'public',
        folder: 'videos',
    });

    const handleUpload = async () => {
        if (!file) return;
        try {
            await start(file);
        } catch (e) {
            // Handled via error state
        }
    };

    return (
        <div>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button onClick={handleUpload} disabled={!file || isUploading}>
                Upload
            </button>

            {isUploading && (
                <>
                    <button onClick={pause}>Pause</button>
                    <button onClick={abort}>Abort</button>
                </>
            )}

            {isPaused && <button onClick={resume}>Resume</button>}

            {isUploading && (
                <div>
                    <div>{progress.percent}% ({progress.speed})</div>
                    <div>Remaining: {progress.remainingSeconds}s</div>
                    <div style={{ width: `${progress.percent}%`, height: '8px', background: 'blue' }} />
                </div>
            )}

            {result && <div>Uploaded successfully: <a href={result.url}>{result.filename}</a></div>}
            {error && <div>Error: {error.message}</div>}
        </div>
    );
}
```

### Vue 3

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useChunkedUpload } from '@jengo/storage/vue';

const selectedFile = ref<File | null>(null);

const {
    status,
    progress,
    result,
    error,
    isUploading,
    isPaused,
    start,
    pause,
    resume,
    abort,
} = useChunkedUpload({
    disk: 'public',
    folder: 'assets',
});

function onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    selectedFile.value = target.files?.[0] || null;
}

async function upload() {
    if (selectedFile.value) {
        await start(selectedFile.value);
    }
}
</script>

<template>
    <div>
        <input type="file" @change="onFileSelected" />
        <button :disabled="!selectedFile || isUploading" @click="upload">Upload</button>
        <button v-if="isUploading" @click="pause">Pause</button>
        <button v-if="isPaused" @click="resume">Resume</button>
        <button v-if="isUploading || isPaused" @click="abort">Abort</button>

        <div v-if="isUploading || isPaused">
            <p>Progress: {{ progress.percent }}% ({{ progress.speed }})</p>
            <progress :value="progress.percent" max="100"></progress>
        </div>

        <div v-if="result">
            <p>Complete: <a :href="result.url">{{ result.filename }}</a></p>
        </div>
    </div>
</template>
```

### Svelte

```svelte
<script lang="ts">
import { createChunkedUpload } from '@jengo/storage/svelte';

let file: File | null = null;
const uploadStore = createChunkedUpload({
    disk: 'public',
    folder: 'docs',
});

function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    file = input.files?.[0] || null;
}

function handleStart() {
    if (file) {
        uploadStore.start(file);
    }
}
</script>

<input type="file" on:change={onFileChange} />
<button on:click={handleStart} disabled={!file || $uploadStore.isUploading}>Upload</button>

{#if $uploadStore.isUploading}
    <button on:click={uploadStore.pause}>Pause</button>
    <button on:click={uploadStore.abort}>Abort</button>
{/if}

{#if $uploadStore.isPaused}
    <button on:click={uploadStore.resume}>Resume</button>
{/if}

{#if $uploadStore.isUploading || $uploadStore.isPaused}
    <div>
        <p>{$uploadStore.progress.percent}% - {$uploadStore.progress.speed}</p>
        <div style="width: {$uploadStore.progress.percent}%; height: 6px; background: indigo;"></div>
    </div>
{/if}

{#if $uploadStore.result}
    <p>Uploaded: {$uploadStore.result.filename}</p>
{/if}
```

---

## Universal Upload UI Component

`@jengo/storage` includes an all-in-one, highly customizable upload component with full support for Vanilla HTML/JS, React, Vue 3, and Svelte.

### Features
- **Zero-Dependency Styling**: Ships with clean, embedded scoped CSS.
- **Theme Manipulation**: 5 built-in theme presets (`light`, `dark`, `minimal`, `corporate`, `glass`) plus custom CSS variables.
- **Multiple Layout Variants**: `dropzone` (full card with drag-and-drop), `compact` (single row), `minimal` (sleek borders, no shadows), and `button` (trigger button).
- **Modal or Inline**: Render inline anywhere in your UI or as a modal dialog (`modal: true` or `<UploadModal />`).
- **Single & Multiple Uploads**: Toggle `multiple: true` or `multiple: false`. In multi-file mode, files are queued, managed, and uploaded concurrently.
- **Automatic Chunking**: Automatically slices files larger than 5 MB into concurrent chunks; standard files are uploaded via multipart streams.
- **Queue Controls**: Previews, speed meters, ETA, pause/resume, cancel, retry, and remove buttons per item.
- **Granular Developer Control**: Toggle any section (`showDropzone`, `showFileList`, `showProgress`, `showDetails`, `showThumbnails`, `allowPause`, `allowCancel`) or supply custom render hooks (`renderDropzone`, `renderFileItem`, `renderHeader`, `renderFooter`).

---

### 1. Vanilla HTML & Web Component (`<jengo-uploader>`)

```html
<script type="module">
  import { registerJengoUploader } from '@jengo/storage';
  registerJengoUploader();
</script>

<!-- Render inline -->
<jengo-uploader
  disk="public"
  folder="documents"
  theme="corporate"
  variant="dropzone"
  multiple="true"
></jengo-uploader>

<!-- Or as an imperative DOM component -->
<div id="uploaderContainer"></div>
<script type="module">
  import { createUploaderUI } from '@jengo/storage';

  const uploader = createUploaderUI('#uploaderContainer', {
    disk: 'public',
    theme: 'dark',
    multiple: true,
    autoUpload: true,
    onComplete: (results) => console.log('Finished:', results),
  });
</script>
```

---

### 2. React / Next.js (`<JengoUploader />` & `<UploadModal />`)

```tsx
import { useState } from 'react';
import { JengoUploader, UploadModal } from '@jengo/storage/react';

export function DocumentManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div>
      {/* Inline Dropzone with custom theme variables */}
      <JengoUploader
        disk="public"
        folder="projects"
        theme="minimal"
        variant="dropzone"
        multiple={true}
        themeVariables={{
          primary: '#4f46e5',
          radius: '0.5rem',
        }}
        onComplete={(results) => console.log('Uploaded files:', results)}
      />

      {/* Standalone Modal Uploader */}
      <button onClick={() => setIsModalOpen(true)}>Open Upload Modal</button>

      <UploadModal
        isOpen={isModalOpen}
        disk="public"
        theme="glass"
        modalTitle="Attach Media"
        onClose={() => setIsModalOpen(false)}
        onComplete={(results) => {
          console.log('Saved:', results);
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}
```

---

### 3. Vue 3 (`<JengoUploader />` & `<UploadModal />`)

```vue
<script setup>
import { ref } from 'vue';
import { JengoUploader, UploadModal } from '@jengo/storage/vue';

const isModalOpen = ref(false);

function handleComplete(results) {
  console.log('Uploads complete:', results);
}
</script>

<template>
  <!-- Inline Compact variant -->
  <JengoUploader
    disk="public"
    folder="profiles"
    variant="compact"
    theme="dark"
    :multiple="false"
    @complete="handleComplete"
  />

  <!-- Modal Dialog -->
  <button @click="isModalOpen = true">Upload Files</button>
  <UploadModal
    :is-open="isModalOpen"
    disk="public"
    theme="corporate"
    @close="isModalOpen = false"
    @complete="handleComplete"
  />
</template>
```

---

### 4. Svelte (Svelte 4 & 5 Action `use:uploader`)

```svelte
<script>
  import { uploader } from '@jengo/storage/svelte';

  let uploaderOptions = {
    disk: 'public',
    folder: 'gallery',
    theme: 'light',
    variant: 'dropzone',
    multiple: true,
    onComplete: (results) => console.log('Uploaded:', results),
  };
</script>

<!-- Attach directly to any DOM element via Svelte action -->
<div use:uploader={uploaderOptions} />
```

---

### Complete Customization Options

| Option | Type | Default | Description |
|---|---|---|---|
| `disk` | `string` | `'public'` | Target filesystem disk. |
| `folder` | `string` | `'uploads'` | Subfolder on destination disk. |
| `theme` | `'light' \| 'dark' \| 'minimal' \| 'corporate' \| 'glass' \| 'custom'` | `'light'` | Preset theme appearance. |
| `themeVariables` | `Record<string, string>` | `undefined` | Custom CSS variable overrides (e.g. `{ primary: '#0066cc', radius: '4px' }`). |
| `variant` | `'dropzone' \| 'compact' \| 'minimal' \| 'button'` | `'dropzone'` | Layout presentation mode. |
| `modal` | `boolean` | `false` | Whether to render inside a backdrop overlay modal. |
| `modalTitle` | `string` | `'Upload Files'` | Dialog title when in modal mode. |
| `multiple` | `boolean` | `true` | Allow selecting/dropping multiple files vs single file. |
| `autoUpload` | `boolean` | `true` | Immediately start upload on file selection. |
| `chunked` | `boolean \| 'auto'` | `'auto'` | Automatic chunking for files above `chunkThreshold`. |
| `chunkThreshold`| `number` | `5242880` (5 MB) | Threshold in bytes to trigger chunking. |
| `chunkSize` | `number` | `2097152` (2 MB) | Byte size per chunk. |
| `concurrency` | `number` | `2` | Number of simultaneous file uploads. |
| `maxFiles` | `number` | `undefined` | Maximum allowed files in queue. |
| `maxFileSize` | `number` | `undefined` | Maximum allowed file size in bytes. |
| `allowedTypes` | `string[]` | `undefined` | Allowed MIME types or file extensions (e.g. `['image/*', '.pdf']`). |
| `showDropzone` | `boolean` | `true` | Show drag-and-drop zone. |
| `showFileList` | `boolean` | `true` | Show queued/uploaded file items list. |
| `showProgress` | `boolean` | `true` | Show progress indicators. |
| `showDetails` | `boolean` | `true` | Show transfer rate and ETA metrics. |
| `showThumbnails`| `boolean` | `true` | Show client-generated image/file thumbnails. |
| `allowPause` | `boolean` | `true` | Allow pausing active chunked transfers. |
| `allowCancel` | `boolean` | `true` | Allow canceling uploads. |
| `allowRemove` | `boolean` | `true` | Allow removing items from queue. |
| `labels` | `Partial<UploaderLabels>` | `DEFAULT_LABELS` | Internationalization labels. |
| `renderDropzone`| `(ctx) => HTMLElement \| string` | `undefined` | Custom renderer for dropzone. |
| `renderFileItem`| `(item, ctx) => HTMLElement \| string` | `undefined` | Custom renderer for queue items. |
| `renderHeader` | `(ctx) => HTMLElement \| string` | `undefined` | Custom renderer for component header. |
| `renderFooter` | `(ctx) => HTMLElement \| string` | `undefined` | Custom renderer for component footer. |


---

## Direct Cloud Transfers

When uploading directly to Amazon S3, Cloudflare R2, or Google Cloud Storage via presigned URLs:

```typescript
import { DirectCloudUploader } from '@jengo/storage';

const uploader = new DirectCloudUploader(file, {
    ticketEndpoint: '/storage/direct/ticket',   // Endpoint issuing presigned PUT URL
    confirmEndpoint: '/storage/direct/confirm', // Endpoint saving metadata after completion
    onProgress: (prog) => console.log(`${prog.percent}%`),
});

const result = await uploader.start();
```

---

## Backend Integration

The backend endpoints are provided out of the box by `jengo/storage`:

- `POST /storage/chunks/upload`: Receives individual chunk `.part` files.
- `POST /storage/chunks/assemble`: Concatenates staged parts via memory-safe streams and copies to destination disk (`public`, `local`, `s3`).
- `POST /storage/chunks/abort`: Purges staging directory if user cancels.

Cleanup of orphaned chunk sessions is handled automatically via:
```bash
php spark storage:clean --chunks
```

---

## License

MIT License. Copyright Ian Otieno.
