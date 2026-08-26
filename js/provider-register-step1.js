(function () {
    'use strict';

    const NEXT_PAGE = 'provider-register-step2.html';
    const PROFILE_KEY = 'handyhire.provider.profile';
    const SERVER_ERROR_KEY = 'handyhire.provider.registrationError';
    const NAME_PATTERN = /^[A-Za-z][A-Za-z .'-]{1,49}$/;

    const form = document.getElementById('providerRegisterStep1Form');
    const fullNameInput = document.getElementById('fullName');
    const ageInput = document.getElementById('age');
    const qualificationInput = document.getElementById('qualification');
    const skillsInput = document.getElementById('skills');

    function setFieldError(input, message) {
        const describedBy = input.getAttribute('aria-describedby') || '';
        const errorEl = describedBy
            .split(' ')
            .map((id) => document.getElementById(id))
            .find((element) => element && element.classList.contains('form-error'));

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

    function validateFullName() {
        const value = fullNameInput.value.trim();

        if (!value) {
            setFieldError(fullNameInput, 'Please enter your full name.');
            return false;
        }

        if (!NAME_PATTERN.test(value)) {
            setFieldError(
                fullNameInput,
                'Use 2-50 letters. Spaces, dot, hyphen and apostrophe are allowed.'
            );
            return false;
        }

        setFieldError(fullNameInput, '');
        return true;
    }

    function validateAge() {
        const value = ageInput.value.trim();
        const age = Number(value);

        if (!value) {
            setFieldError(ageInput, 'Please enter your age.');
            return false;
        }

        if (!Number.isInteger(age)) {
            setFieldError(ageInput, 'Age must be a whole number.');
            return false;
        }

        if (age < 18) {
            setFieldError(ageInput, 'You must be at least 18 years old.');
            return false;
        }

        if (age > 99) {
            setFieldError(ageInput, 'Age cannot be greater than 99.');
            return false;
        }

        setFieldError(ageInput, '');
        return true;
    }

    function validateQualification() {
        if (!qualificationInput.value) {
            setFieldError(
                qualificationInput,
                'Please select your qualification.'
            );
            return false;
        }

        setFieldError(qualificationInput, '');
        return true;
    }

    function validateSkills() {
        if (!skillsInput.value) {
            setFieldError(skillsInput, 'Please select your primary skill.');
            return false;
        }

        setFieldError(skillsInput, '');
        return true;
    }

    function saveFormData() {
        try {
            const existing = sessionStorage.getItem(PROFILE_KEY);
            const profile = existing ? JSON.parse(existing) : {};

            profile.fullName = fullNameInput.value.trim();
            profile.age = ageInput.value.trim();
            profile.qualification = qualificationInput.value;
            profile.skills = skillsInput.value;

            sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        } catch (error) {
            console.error('Could not save Step 1 details.', error);
        }
    }

    function restoreFormData() {
        try {
            const raw = sessionStorage.getItem(PROFILE_KEY);
            if (!raw) return;

            const profile = JSON.parse(raw);

            fullNameInput.value = profile.fullName || '';
            ageInput.value = profile.age || '';
            qualificationInput.value = profile.qualification || '';
            skillsInput.value = profile.skills || '';
        } catch (error) {
            console.error('Could not restore Step 1 details.', error);
        }
    }

    function showBackendError() {
        const fieldMap = {
            full_name: fullNameInput,
            age: ageInput,
            qualification: qualificationInput,
            profession: skillsInput
        };

        try {
            const raw = sessionStorage.getItem(SERVER_ERROR_KEY);
            if (!raw) return;

            const savedError = JSON.parse(raw);
            const input = fieldMap[savedError.field];

            if (!input) return;

            sessionStorage.removeItem(SERVER_ERROR_KEY);

            setFieldError(
                input,
                savedError.message || 'Please check this field.'
            );

            input.focus();
        } catch (error) {
            sessionStorage.removeItem(SERVER_ERROR_KEY);
        }
    }

    function init() {
        if (!form) return;

        restoreFormData();
        showBackendError();

        ageInput.addEventListener('input', function () {
            const cleaned = ageInput.value.replace(/\D/g, '').slice(0, 2);
            ageInput.value = cleaned;

            if (ageInput.classList.contains('input-error')) {
                validateAge();
            }
        });

        fullNameInput.addEventListener('input', function () {
            if (fullNameInput.classList.contains('input-error')) {
                validateFullName();
            }
        });

        qualificationInput.addEventListener('change', function () {
            validateQualification();
        });

        skillsInput.addEventListener('change', function () {
            validateSkills();
        });

        form.addEventListener('submit', function (event) {
            event.preventDefault();

            const validName = validateFullName();
            const validAge = validateAge();
            const validQualification = validateQualification();
            const validSkill = validateSkills();

            if (
                validName &&
                validAge &&
                validQualification &&
                validSkill
            ) {
                saveFormData();
                window.location.href = NEXT_PAGE;
                return;
            }

            const firstInvalid = form.querySelector('.input-error');
            if (firstInvalid) firstInvalid.focus();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();