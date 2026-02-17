// public/js/utils/api.js

// Wrapper for fetch to handle credentials and errors
export async function apiFetch(url, options = {}) {
    // Ensure credentials are sent with requests
    options.credentials = 'include';

    // Headers
    options.headers = options.headers || {};

    // JSON content type if body is object and not FormData
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }

    try {
        const res = await fetch(url, options);

        if (res.status === 401) {
            // Unauthorized - Redirect to login only if we are in admin area
            if (window.location.pathname.includes('admin') || window.location.pathname.includes('login')) {
                // If already on login, do nothing? Or show error?
                // Only redirect if NOT on login page
                if (!window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('admin.html')) {
                    // logic handled by UI mostly
                }
                // For API calls, just throw 401
            }
            throw new Error('Unauthorized');
        }

        return res;
    } catch (e) {
        throw e;
    }
}
