export function formatBytes(bytes: number, decimals = 2): string {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const clampedIndex = Math.min(i, sizes.length - 1);
    const value = parseFloat((bytes / Math.pow(k, clampedIndex)).toFixed(dm));
    return `${value} ${sizes[clampedIndex]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond <= 0) return '0 B/s';
    return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatDuration(seconds: number | null): string {
    if (seconds === null || !isFinite(seconds) || seconds < 0) {
        return '--';
    }

    const totalSecs = Math.round(seconds);
    if (totalSecs < 1) {
        return '< 1s';
    }

    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}

export class SpeedTracker {
    private startTime: number = 0;
    private lastTime: number = 0;
    private lastLoaded: number = 0;
    private smoothedBps: number = 0;
    private readonly alpha: number = 0.25;

    public reset(): void {
        this.startTime = 0;
        this.lastTime = 0;
        this.lastLoaded = 0;
        this.smoothedBps = 0;
    }

    public update(loaded: number, total: number): {
        speedBytesPerSec: number;
        speedFormatted: string;
        remainingSeconds: number | null;
    } {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

        if (this.startTime === 0) {
            this.startTime = now;
            this.lastTime = now;
            this.lastLoaded = loaded;
            return {
                speedBytesPerSec: 0,
                speedFormatted: '0 B/s',
                remainingSeconds: null,
            };
        }

        const deltaMs = now - this.lastTime;
        if (deltaMs < 100) {
            const remaining = total > loaded && this.smoothedBps > 0
                ? (total - loaded) / this.smoothedBps
                : null;
            return {
                speedBytesPerSec: this.smoothedBps,
                speedFormatted: formatSpeed(this.smoothedBps),
                remainingSeconds: remaining,
            };
        }

        const deltaBytes = Math.max(0, loaded - this.lastLoaded);
        const instantBps = (deltaBytes / deltaMs) * 1000;

        if (this.smoothedBps === 0) {
            this.smoothedBps = instantBps;
        } else {
            this.smoothedBps = this.alpha * instantBps + (1 - this.alpha) * this.smoothedBps;
        }

        this.lastTime = now;
        this.lastLoaded = loaded;

        const remainingBytes = Math.max(0, total - loaded);
        const remainingSeconds = this.smoothedBps > 0
            ? remainingBytes / this.smoothedBps
            : null;

        return {
            speedBytesPerSec: Math.round(this.smoothedBps),
            speedFormatted: formatSpeed(this.smoothedBps),
            remainingSeconds,
        };
    }
}
