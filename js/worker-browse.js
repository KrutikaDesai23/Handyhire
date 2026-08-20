/* =========================================================
   HandyHire - Shared Customer Worker Browsing Helpers
   Provides a small shared layer that maps backend worker
   responses (GET /api/workers) onto the existing customer
   card shape, builds filter query strings, and centralises
   the API call used by the customer home variants.

   Load it AFTER js/api.js so window.HandyHireAPI exists.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Escape untrusted text before injecting as HTML.
     * @param {*} str
     * @returns {string}
     */
    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Convert a worker name into a URL-safe slug. Mirrors the
     * existing makeSlug() helpers used by home*.js.
     * @param {string} name
     * @returns {string}
     */
    function makeSlug(name) {
        return String(name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Build a query string from a params object (URL-encoded).
     * @param {Object} [params]
     * @returns {string}  '' when no params, otherwise '?k=v&...'
     */
    function buildQuery(params) {
        params = params || {};
        var keys = Object.keys(params);
        if (!keys.length) return '';
        return '?' + keys.map(function (k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
        }).join('&');
    }

    /**
     * Resolve the API helper. Prefers the real js/api.js one and
     * only degrades to a bare fetch when it is unavailable.
     * @returns {Object}
     */
    function getApi() {
        if (window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function') {
            return window.HandyHireAPI;
        }
        return {
            API_BASE_URL: 'http://127.0.0.1:8000',
            apiFetch: function (path) {
                return fetch('http://127.0.0.1:8000' + path);
            },
        };
    }

    /**
     * Fetch the customer worker listing from the backend.
     * Only uses filters that actually exist in
     * backend/app/routers/workers.py (profession, location,
     * availability, min_price, max_price, search).
     * @param {Object} [filters]
     * @returns {Promise<Array<Object>>}
     */
    function fetchWorkers(filters) {
        var api = getApi();
        return api.apiFetch('/api/workers' + buildQuery(filters))
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Failed to fetch workers');
                }
                return response.json();
            });
    }

    /**
     * Map a single backend WorkerResponse into the shape the
     * customer home cards consume. Never fabricates values that
     * the backend does not provide (missing rating -> 0).
     * @param {Object} worker
     * @returns {Object}
     */
    function toCard(worker) {
        var name = worker.full_name || worker.name || '';
        var price = Number(worker.price);
        return {
            id: worker.id,
            name: name,
            slug: makeSlug(name),
            profession: worker.profession || '',
            priceText: '\u20B9' + (isFinite(price) && price > 0 ? price : 0),
            rating: Number(worker.average_rating) || 0,
            reviewCount: Number(worker.review_count) || 0,
            profileImage: worker.profile_image || null,
            raw: worker,
        };
    }

    window.HandyHireWorkers = {
        escapeHtml: escapeHtml,
        makeSlug: makeSlug,
        buildQuery: buildQuery,
        getApi: getApi,
        fetchWorkers: fetchWorkers,
        toCard: toCard,
    };
})();