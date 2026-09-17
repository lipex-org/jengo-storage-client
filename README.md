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
