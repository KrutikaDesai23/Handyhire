/* =========================================================
   HandyHire - Shared API Configuration
   Centralizes backend URL, auth storage, and fetch helpers.
   ========================================================= */

(function () {
    'use strict';

    var currentHost = (window.location && window.location.hostname) ? window.location.hostname : '';
    var isLocalHost = currentHost === '127.0.0.1' || currentHost === 'localhost' || currentHost === '';

    // Production may set window.HANDYHIRE_API_BASE_URL before this script loads.
    // Local development falls back to the FastAPI server on port 8000.
    var configuredApiBase = (window.HANDYHIRE_API_BASE_URL || '').trim();
    var API_BASE_URL = (configuredApiBase || (isLocalHost ? 'http://127.0.0.1:8000' : '')).replace(/\/+$/, '');

    // Compatibility shim for older page scripts that still contain a direct
    // localhost backend URL. Once a production API base is configured, rewrite
    // those string URLs to the deployed backend instead of the visitor's device.
    var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
    if (nativeFetch) {
        window.fetch = function (input, init) {
            if (API_BASE_URL && typeof input === 'string') {
                input = input.replace(
                    /^http:\/\/(127\.0\.0\.1|localhost):8000(?=\/|$)/,
                    API_BASE_URL
                );
            }
            return nativeFetch(input, init);
        };
    }

    var STORAGE_KEYS = {
        TOKEN: 'handyhire.auth.token',
        USER: 'handyhire.auth.user',
    };

    function enrichBookingBody(path, options, isFormData) {
        if (
            path !== '/api/bookings' ||
            isFormData ||
            String(options.method || 'GET').toUpperCase() !== 'POST' ||
            typeof options.body !== 'string'
        ) {
            return;
        }

        try {
            var payload = JSON.parse(options.body);
            if (payload && payload.hours == null) {
                var hoursSelect = document.getElementById('hoursSelect');
                var hours = hoursSelect ? Number(hoursSelect.value) : NaN;
                if (Number.isFinite(hours) && hours >= 1) {
                    payload.hours = Math.floor(hours);
                    options.body = JSON.stringify(payload);
                }
            }
        } catch (e) {
            // Leave non-JSON or malformed bodies untouched; the API will
            // return its normal validation response.
        }
    }

    function apiFetch(path, options) {
        options = options || {};
        var token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        var isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
        var headers = {};

        enrichBookingBody(path, options, isFormData);

        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }
        if (options.headers) {
            Object.keys(options.headers).forEach(function (key) {
                headers[key] = options.headers[key];
            });
        }
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }

        if (!API_BASE_URL) {
            return Promise.resolve({
                ok: false,
                status: 0,
                statusText: 'API Not Configured',
                json: function () {
                    return Promise.resolve({
                        detail: 'HandyHire API URL is not configured for this deployment.',
                    });
                },
            });
        }

        return fetch(API_BASE_URL + path, {
            method: options.method || 'GET',
            headers: headers,
            body: options.body || undefined,
        }).then(function (response) {
            if (response.status === 401) {
                debugAuthState('apiFetch:' + path + ' -> 401 clearAuth');
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
                        detail: 'Unable to connect to HandyHire server. Please try again.',
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

    function debugAuthState(label) {
        try {
            var token = getStoredToken();
            var user = getStoredUser();
            var role = (user && user.role) ? user.role : null;
            var roleHome = roleHomeHref(role);
            console.log('[HandyHire][auth][debug] ' + label + ' | token=' + !!token + ' | user=' + JSON.stringify(user) + ' | role=' + role + ' | roleHome=' + roleHome);
        } catch (e) {}
    }

    function setAuth(token, user) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, token);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }

    function clearAuth() {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
        clearNavigationState();
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

    /* =========================================================
       ROLE ISOLATION (single source of truth = JWT-backed user)
       ========================================================= */

    function getRole() {
        var user = getStoredUser();
        return (user && user.role) ? user.role : null;
    }

    function roleHomeHref(role) {
        if (role === 'worker') return 'provider-home.html';
        if (role === 'customer') return 'home.html';
        return 'login.html';
    }

    function requireRole(expectedRole) {
        var token = getStoredToken();
        if (!token) {
            debugAuthState('requireRole:' + expectedRole + ' -> no-token redirect login.html');
            window.location.href = 'login.html';
            return false;
        }
        var role = getRole();
        if (role !== expectedRole) {
            debugAuthState('requireRole:' + expectedRole + ' -> wrong-role redirect ' + roleHomeHref(role));
            window.location.href = roleHomeHref(role);
            return false;
        }
        debugAuthState('requireRole:' + expectedRole + ' -> PASS');
        return true;
    }

    function clearNavigationState() {
        var KEYS = [
            'handyhire.selectedWorkerId',
            'handyhire.selectedWorkerSlug',
            'handyhire.selectedTeamId',
            'handyhire.selectedTeam',
            'handyhire.provider.selectedMember',
            'handyhire.selectedMember',
            'handyhire.customer.previousPage',
            'handyhire.provider.previousPage',
            'handyhire.bookingMode',
            'handyhire.lastBooking',
            'handyhire.provider.profile',
        ];
        try {
            var sess = (typeof window.sessionStorage !== 'undefined')
                ? window.sessionStorage
                : sessionStorage;
            KEYS.forEach(function (key) {
                sess.removeItem(key);
            });
        } catch (e) {}
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
        getRole: getRole,
        roleHomeHref: roleHomeHref,
        requireRole: requireRole,
        clearNavigationState: clearNavigationState,
        debugAuthState: debugAuthState,
    };
})();
