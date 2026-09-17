/**
 * Resolves the CodeIgniter 4 CSRF token from HTML meta tags, cookies, or window globals.
 */
export function resolveCsrfToken(customToken?: string | (() => string | null | undefined)): string | null {
    if (typeof customToken === 'function') {
        const val = customToken();
        if (val) return val;
    } else if (typeof customToken === 'string' && customToken.trim() !== '') {
        return customToken;
    }

    if (typeof document === 'undefined') {
        return null;
    }

    // 1. Check meta tags
    const metaSelectors = [
        'meta[name="csrf-token"]',
        'meta[name="X-CSRF-TOKEN"]',
        'meta[name="csrf_token"]',
        'meta[name="csrf_test_name"]',
    ];

    for (const selector of metaSelectors) {
        const meta = document.querySelector(selector);
        if (meta) {
            const content = meta.getAttribute('content');
            if (content && content.trim() !== '') {
                return content;
            }
        }
    }

    // 2. Check browser cookies (CodeIgniter 4 standard names)
    if (typeof document.cookie === 'string' && document.cookie !== '') {
        const cookieNames = ['csrf_cookie_name', 'csrf_test_name', 'XSRF-TOKEN'];
        const cookies = document.cookie.split(';');

        for (const cookie of cookies) {
            const [rawKey, rawVal] = cookie.trim().split('=');
            if (rawKey && rawVal && cookieNames.includes(rawKey)) {
                return decodeURIComponent(rawVal);
            }
        }
    }

    // 3. Check window globals
    if (typeof window !== 'undefined') {
        const win = window as any;
        if (win.jengoCsrf) return String(win.jengoCsrf);
        if (win.csrfToken) return String(win.csrfToken);
        if (win.CI_CSRF_TOKEN) return String(win.CI_CSRF_TOKEN);
    }

    return null;
}
