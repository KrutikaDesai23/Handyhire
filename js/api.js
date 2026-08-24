/* =========================================================
   HandyHire - Shared API Configuration
   Centralizes backend URL, auth storage, and fetch helpers.
   ========================================================= */

(function () {
    'use strict';

    var API_BASE_URL = 'http://127.0.0.1:8000';

    var STORAGE_KEYS = {
        TOKEN: 'handyhire.auth.token',
        USER: 'handyhire.auth.user',
    };

    function apiFetch(path, options) {
        options = options || {};
        var token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        var headers = {
            'Content-Type': 'application/json',
        };
        if (options.headers) {
            Object.keys(options.headers).forEach(function (key) {
                headers[key] = options.headers[key];
            });
        }
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }

        return fetch(API_BASE_URL + path, {
            method: options.method || 'GET',
            headers: headers,
            body: options.body || undefined,
        }).then(function (response) {
            if (response.status === 401) {
                clearAuth();
            }
            return response;
        }).catch(function () {
            // Network-level failure (server down, DNS failure, CORS block, etc.).
            // Return a synthetic Response-like object so callers never see
            // an unhandled "Failed to fetch" rejection and can show a
            // friendly message through their normal error path.
            return {
                ok: false,
                status: 0,
                statusText: 'Network Error',
                json: function () {
                    return Promise.resolve({
                        detail: 'Unable to connect to HandyHire server. Please make sure the backend is running.',
                    });
                },
            };
        });
    }

    function getStoredToken() {
        return localStorage.getItem(STORAGE_KEYS.TOKEN) || null;
    }

    function getStoredUser() {
        try {
            var raw = localStorage.getItem(STORAGE_KEYS.USER);
            if (raw) {
                return JSON.parse(raw);
            }
        } catch (e) {}
        return null;
    }

    function setAuth(token, user) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, token);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }

    function clearAuth() {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
    }

    function fetchCurrentUser() {
        return apiFetch('/api/auth/me').then(function (response) {
            if (!response.ok) {
                clearAuth();
                return null;
            }
            return response.json().then(function (user) {
                localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
                return user;
            });
        });
    }

    function getCurrentUser() {
        return getStoredUser();
    }

    function isLoggedIn() {
        return !!getStoredToken();
    }

    window.HandyHireAPI = {
        API_BASE_URL: API_BASE_URL,
        STORAGE_KEYS: STORAGE_KEYS,
        apiFetch: apiFetch,
        getStoredToken: getStoredToken,
        getStoredUser: getStoredUser,
        setAuth: setAuth,
        clearAuth: clearAuth,
        fetchCurrentUser: fetchCurrentUser,
        getCurrentUser: getCurrentUser,
        isLoggedIn: isLoggedIn,
    };
})();
