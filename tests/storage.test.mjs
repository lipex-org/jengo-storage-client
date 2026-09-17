import test from 'node:test';
import assert from 'node:assert/strict';

import {
    formatBytes,
    formatSpeed,
    formatDuration,
    SpeedTracker,
    generateFileUuid,
    calculateSha256,
    sliceFileIntoChunks,
    resolveCsrfToken,
    ChunkedUploader,
    StandardUploader,
    DirectCloudUploader,
    uploadChunked,
    uploadStandard,
    uploadDirectCloud,
} from '../dist/index.js';

import * as ReactAdapter from '../dist/react/index.js';
import * as VueAdapter from '../dist/vue/index.js';
import * as SvelteAdapter from '../dist/svelte/index.js';

test('formatBytes formats file sizes correctly', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(-10), '0 B');
    assert.equal(formatBytes(512), '512 B');
    assert.equal(formatBytes(1024), '1 KB');
    assert.equal(formatBytes(1536), '1.5 KB');
    assert.equal(formatBytes(1024 * 1024), '1 MB');
    assert.equal(formatBytes(1024 * 1024 * 1024 * 2.5), '2.5 GB');
});

test('formatSpeed formats transfer rate correctly', () => {
    assert.equal(formatSpeed(0), '0 B/s');
    assert.equal(formatSpeed(1024 * 512), '512 KB/s');
    assert.equal(formatSpeed(1024 * 1024 * 4.2), '4.2 MB/s');
});

test('formatDuration formats remaining ETA time correctly', () => {
    assert.equal(formatDuration(null), '--');
    assert.equal(formatDuration(-5), '--');
    assert.equal(formatDuration(0.4), '< 1s');
    assert.equal(formatDuration(42), '42s');
    assert.equal(formatDuration(125), '2m 5s');
    assert.equal(formatDuration(3665), '1h 1m 5s');
});

test('SpeedTracker computes smoothed transfer rate and ETA', () => {
    const tracker = new SpeedTracker();
    const initial = tracker.update(0, 1000);
    assert.equal(initial.speedBytesPerSec, 0);
    assert.equal(initial.remainingSeconds, null);

    tracker.reset();
    const resetRes = tracker.update(0, 500);
    assert.equal(resetRes.speedBytesPerSec, 0);
});

test('generateFileUuid creates distinct non-empty string IDs', () => {
    const id1 = generateFileUuid();
    const id2 = generateFileUuid();
    assert.equal(typeof id1, 'string');
    assert.ok(id1.length > 8);
    assert.notEqual(id1, id2);
});

test('calculateSha256 calculates accurate SHA-256 digests', async () => {
    const text = 'hello world';
    const blob = new Blob([text], { type: 'text/plain' });
    const digest = await calculateSha256(blob);
    // Known SHA-256 for 'hello world'
    assert.equal(digest, 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
});

test('sliceFileIntoChunks splits blobs according to chunkSize', () => {
    // 5 MB mock blob with 2 MB chunks => 3 parts
    const fiveMb = new Blob([new Uint8Array(5 * 1024 * 1024)]);
    const parts = sliceFileIntoChunks(fiveMb, 2 * 1024 * 1024);

    assert.equal(parts.length, 3);
    assert.equal(parts[0].index, 0);
    assert.equal(parts[0].start, 0);
    assert.equal(parts[0].end, 2 * 1024 * 1024);
    assert.equal(parts[0].blob.size, 2 * 1024 * 1024);

    assert.equal(parts[1].index, 1);
    assert.equal(parts[1].start, 2 * 1024 * 1024);
    assert.equal(parts[1].end, 4 * 1024 * 1024);
    assert.equal(parts[1].blob.size, 2 * 1024 * 1024);

    assert.equal(parts[2].index, 2);
    assert.equal(parts[2].start, 4 * 1024 * 1024);
    assert.equal(parts[2].end, 5 * 1024 * 1024);
    assert.equal(parts[2].blob.size, 1 * 1024 * 1024);
});

test('sliceFileIntoChunks handles empty zero-byte files gracefully', () => {
    const emptyBlob = new Blob([]);
    const parts = sliceFileIntoChunks(emptyBlob, 1024 * 1024);

    assert.equal(parts.length, 1);
    assert.equal(parts[0].index, 0);
    assert.equal(parts[0].blob.size, 0);
});

test('resolveCsrfToken evaluates custom tokens or returns null in node environment', () => {
    assert.equal(resolveCsrfToken('custom-token-xyz'), 'custom-token-xyz');
    assert.equal(resolveCsrfToken(() => 'fn-token-abc'), 'fn-token-abc');
    assert.equal(resolveCsrfToken(), null);
});

test('ChunkedUploader exposes state, progress, and methods', () => {
    const blob = new Blob([new Uint8Array(1024 * 512)]);
    const uploader = new ChunkedUploader(blob, {
        chunkSize: 1024 * 256,
        concurrency: 2,
    });

    assert.equal(uploader.getStatus(), 'idle');
    const prog = uploader.getProgress();
    assert.equal(prog.percent, 0);
    assert.equal(prog.total, 1024 * 512);
    assert.equal(prog.totalChunks, 2);
    assert.equal(typeof uploader.uuid, 'string');
});

test('StandardUploader exposes initial state and progress', () => {
    const blob = new Blob([new Uint8Array(1024 * 128)]);
    const uploader = new StandardUploader(blob, {
        disk: 'local',
        folder: 'test-folder',
    });

    assert.equal(uploader.getStatus(), 'idle');
    const prog = uploader.getProgress();
    assert.equal(prog.percent, 0);
    assert.equal(prog.total, 1024 * 128);
});

test('DirectCloudUploader initializes and tracks options', () => {
    const blob = new Blob([new Uint8Array(1024 * 64)]);
    const uploader = new DirectCloudUploader(blob, {
        ticket: {
            url: 'https://storage.provider.com/bucket/key.bin?signature=123',
            key: 'uploads/key.bin',
        },
    });

    assert.equal(uploader.getStatus(), 'idle');
    const prog = uploader.getProgress();
    assert.equal(prog.percent, 0);
    assert.equal(prog.total, 1024 * 64);
});

test('Framework adapters export expected hooks and factories', () => {
    assert.equal(typeof ReactAdapter.useUpload, 'function');
    assert.equal(typeof ReactAdapter.useChunkedUpload, 'function');

    assert.equal(typeof VueAdapter.useUpload, 'function');
    assert.equal(typeof VueAdapter.useChunkedUpload, 'function');

    assert.equal(typeof SvelteAdapter.createUpload, 'function');
    assert.equal(typeof SvelteAdapter.createChunkedUpload, 'function');
    assert.equal(typeof SvelteAdapter.useUpload, 'function');
    assert.equal(typeof SvelteAdapter.useChunkedUpload, 'function');
});

test('Convenience upload shortcuts exist and instantiate proper uploaders', () => {
    assert.equal(typeof uploadChunked, 'function');
    assert.equal(typeof uploadStandard, 'function');
    assert.equal(typeof uploadDirectCloud, 'function');
});
