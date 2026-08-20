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

        try {
            var response = await fetch(window.HandyHireAPI.API_BASE_URL + '/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password }),
            });

            if (!response.ok) {
                var data = {};
                try { data = await response.json(); } catch (e) {}
                showError(data.detail || 'Invalid email or password.');
                return;
            }

            var tokenData = await response.json();
            window.HandyHireAPI.setAuth(tokenData.access_token, tokenData);

            var user = await window.HandyHireAPI.fetchCurrentUser();
            if (!user) {
                showError('Failed to load user profile. Please try again.');
                return;
            }

            if (user.role === 'worker') {
                window.location.href = 'provider-home.html';
            } else {
                window.location.href = 'home.html';
            }
        } catch (e) {
            showError('Cannot connect to server. Please try again later.');
        }
    }

    function init() {
        if (!form) return;

        if (window.HandyHireAPI && window.HandyHireAPI.isLoggedIn()) {
            const user = window.HandyHireAPI.getCurrentUser();
            if (user && user.role === 'worker') {
                window.location.href = 'provider-home.html';
            } else {
                window.location.href = 'home.html';
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
