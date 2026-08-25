/* =========================================================
   HandyHire - Login JavaScript
   Connects the login form to POST /api/auth/login,
   stores the JWT, and routes by role.
   ========================================================= */

(function () {
    'use strict';

    var form = document.getElementById('loginForm');
    var emailInput = document.getElementById('email');
    var passwordInput = document.getElementById('password');
    var errorEl = document.getElementById('loginError');

    if (!errorEl) {
        errorEl = document.createElement('span');
        errorEl.id = 'loginError';
        errorEl.className = 'form-error';
        errorEl.setAttribute('role', 'alert');
        errorEl.setAttribute('aria-live', 'polite');
        form.appendChild(errorEl);
    }

    function showError(message) {
        errorEl.textContent = message;
    }

    function clearError() {
        errorEl.textContent = '';
    }

    async function handleLogin(event) {
        event.preventDefault();
        clearError();

        var email = emailInput.value.trim();
        var password = passwordInput.value;

        if (!email || !password) {
            showError('Please enter both email and password.');
            return;
        }

        const api = window.HandyHireAPI;
        if (!api || !api.apiFetch) {
            showError('Unable to connect to HandyHire server. Please make sure the backend is running.');
            return;
        }

        var submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Signing in\u2026';
        }

        try {
            var response = await api.apiFetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password }),
            });

            if (!response.ok) {
                var data = {};
                try { data = await response.json(); } catch (e) {}
                showError(data.detail || 'Invalid email or password.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Log In';
                }
                return;
            }

            // The login response already contains the authenticated
            // identity (user_id, role, full_name), so no follow-up
            // /api/auth/me request is needed. The JWT remains the
            // sole authentication credential.
            var tokenData = await response.json();
            api.setAuth(tokenData.access_token, {
                id: tokenData.user_id,
                full_name: tokenData.full_name,
                role: tokenData.role,
            });

            if (tokenData.role === 'worker') {
                window.location.href = 'provider-home.html';
            } else {
                window.location.href = 'home.html';
            }
        } catch (e) {
            showError('Unable to connect to HandyHire server. Please make sure the backend is running.');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Log In';
            }
        }
    }

    function init() {
        if (!form) return;

        if (window.HandyHireAPI && window.HandyHireAPI.isLoggedIn()) {
            const user = window.HandyHireAPI.getCurrentUser();
            console.log('[HandyHire][login][debug] init isLoggedIn=true | user=' + JSON.stringify(user));
            const role = (user && user.role) ? user.role : null;
            if (role === 'worker') {
                console.log('[HandyHire][login][debug] init redirect -> provider-home.html');
                window.location.href = 'provider-home.html';
            } else if (role === 'customer') {
                console.log('[HandyHire][login][debug] init redirect -> home.html');
                window.location.href = 'home.html';
            } else {
                console.log('[HandyHire][login][debug] init invalid/missing role -> clearAuth and stay on login.html');
                window.HandyHireAPI.clearAuth();
            }
            return;
        }

        form.addEventListener('submit', handleLogin);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
