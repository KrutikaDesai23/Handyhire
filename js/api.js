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
        var isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
        var headers = {};
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

    /**
     * Resolve the authenticated user's role from the stored
     * identity that was written after JWT verification.
     * @returns {'customer'|'worker'|null}
     */
    function getRole() {
        var user = getStoredUser();
        return (user && user.role) ? user.role : null;
    }

    /**
     * Home page for a given role.
     * @param {string|null} role
     * @returns {string}
     */
    function roleHomeHref(role) {
        if (role === 'worker') return 'provider-home.html';
        if (role === 'customer') return 'home.html';
        return 'login.html';
    }

    /**
     * Central page guard. Redirects based ONLY on the stored
     * authenticated identity (never URL/sessionStorage):
     *   - no token          -> login.html
     *   - wrong role        -> that role's own home page
     *   - unknown identity  -> login.html
     * @param {'customer'|'worker'} expectedRole
     * @returns {boolean} true when the page may render
     */
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

    /**
     * Wipe every role-specific / navigation sessionStorage key so a
     * logout (or account switch) can never inherit the previous
     * user's navigation state.
     */
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
