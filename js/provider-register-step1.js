/* =========================================================
   HandyHire - Provider Registration Step 1 JavaScript
   Screen: SP R1 - Personal Details
   Handles validation and navigation to step 2.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Destination routes.
     */
    const ROUTES = {
        NEXT: 'provider-register-step2.html',
    };

    /**
     * Regex patterns used for input validation.
     */
    const PATTERNS = {
        // Letters, spaces, dot, hyphen, apostrophe (name characters)
        NAME: /^[A-Za-z][A-Za-z .'-]{1,49}$/,
    };

    /**
     * Reference DOM elements.
     */
    const form = document.getElementById('providerRegisterStep1Form');
    const fullNameInput = document.getElementById('fullName');
    const ageInput = document.getElementById('age');
    const qualificationInput = document.getElementById('qualification');
    const skillsInput = document.getElementById('skills');

    /**
     * Display a validation message under a field and mark it as invalid.
     *
     * @param {HTMLInputElement|HTMLSelectElement} input - Field element.
     * @param {string} message - Message to display (empty to clear).
     */
    function setFieldError(input, message) {
        const errorId = input.getAttribute('aria-describedby');
        const errorEl = errorId ? document.getElementById(errorId) : null;

        if (message) {
            input.classList.add('input-error');
            input.setAttribute('aria-invalid', 'true');
            if (errorEl) errorEl.textContent = message;
        } else {
            input.classList.remove('input-error');
            input.removeAttribute('aria-invalid');
            if (errorEl) errorEl.textContent = '';
        }
    }

    /**
     * Validate the Full Name field.
     * @returns {boolean}
     */
    function validateFullName() {
        const value = fullNameInput.value.trim();
        if (!value) {
            setFieldError(fullNameInput, 'Full name is required.');
            return false;
        }
        if (!PATTERNS.NAME.test(value)) {
            setFieldError(fullNameInput, 'Please enter a valid name (letters only).');
            return false;
        }
        setFieldError(fullNameInput, '');
        return true;
    }

    /**
     * Validate the Age field (18-99).
     * @returns {boolean}
     */
    function validateAge() {
        const raw = ageInput.value.trim();
        if (!raw) {
            setFieldError(ageInput, 'Age is required.');
            return false;
        }
        const age = Number(raw);
        if (!Number.isInteger(age)) {
            setFieldError(ageInput, 'Please enter a valid whole number.');
            return false;
        }
        if (age < 18 || age > 99) {
            setFieldError(ageInput, 'Age must be between 18 and 99.');
            return false;
        }
        setFieldError(ageInput, '');
        return true;
    }

    /**
     * Validate the Qualification dropdown.
     * @returns {boolean}
     */
    function validateQualification() {
        const value = qualificationInput.value;
        if (!value) {
            setFieldError(qualificationInput, 'Please select a qualification.');
            return false;
        }
        setFieldError(qualificationInput, '');
        return true;
    }

    /**
     * Validate the Skills dropdown.
     * @returns {boolean}
     */
    function validateSkills() {
        const value = skillsInput.value;
        if (!value) {
            setFieldError(skillsInput, 'Please select a skill.');
            return false;
        }
        setFieldError(skillsInput, '');
        return true;
    }

    /**
     * Persist the current step's form data into sessionStorage
     * so later steps and the profile page can reconstruct the
     * full provider profile.
     */
    function persistFormData() {
        try {
            const existing = sessionStorage.getItem('handyhire.provider.profile');
            const profile = existing ? JSON.parse(existing) : {};
            profile.fullName = fullNameInput.value.trim();
            profile.age = ageInput.value.trim();
            profile.qualification = qualificationInput.value;
            profile.skills = skillsInput.value;
            sessionStorage.setItem('handyhire.provider.profile', JSON.stringify(profile));
        } catch (e) {
            // Ignore storage errors.
        }
    }

    /**
     * Navigate to step 2.
     */
    function navigateNext() {
        persistFormData();
        window.location.href = ROUTES.NEXT;
    }

    /**
     * Initialize the registration form.
     */
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

        // Strip non-numeric characters and clamp to 2 digits for age
        ageInput.addEventListener('input', function () {
            const cleaned = ageInput.value.replace(/\D/g, '').slice(0, 2);
            if (cleaned !== ageInput.value) ageInput.value = cleaned;
            if (ageInput.classList.contains('input-error')) validateAge();
        });

        // Live validation - clear errors as the user types/changes
        fullNameInput.addEventListener('input', function () {
            if (fullNameInput.classList.contains('input-error')) validateFullName();
        });
        qualificationInput.addEventListener('change', function () {
            if (qualificationInput.classList.contains('input-error')) validateQualification();
        });
        skillsInput.addEventListener('change', function () {
            if (skillsInput.classList.contains('input-error')) validateSkills();
        });

        // Form submission
        form.addEventListener('submit', function (event) {
            event.preventDefault();

            const isNameValid = validateFullName();
            const isAgeValid = validateAge();
            const isQualificationValid = validateQualification();
            const isSkillsValid = validateSkills();

            if (isNameValid && isAgeValid && isQualificationValid && isSkillsValid) {
                // All fields valid - proceed to step 2
                navigateNext();
            } else {
                // Focus the first invalid field for accessibility
                const firstInvalid = form.querySelector('.input-error');
                if (firstInvalid) firstInvalid.focus();
            }
        });
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
