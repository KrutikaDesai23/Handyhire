(function () {
    'use strict';

    const BACK_PAGE = 'provider-register-step2.html';
    const SUCCESS_PAGE = 'provider-home.html';

    const PROFILE_KEY = 'handyhire.provider.profile';
    const SERVER_ERROR_KEY =
        'handyhire.provider.registrationError';

    const FIELD_ROUTES = {
        full_name: 'provider-register-step1.html',
        age: 'provider-register-step1.html',
        qualification: 'provider-register-step1.html',
        profession: 'provider-register-step1.html',
        mobile_number: 'provider-register-step2.html',
        email: 'provider-register-step2.html',
        password: 'provider-register-step2.html',
        price: 'provider-register-step2.html',
        location: 'provider-register-step2.html'
    };

    const FIELD_MESSAGES = {
        full_name:
            'Enter a valid full name using 2-50 letters.',

        age:
            'Age must be between 18 and 99.',

        qualification:
            'Please select your qualification.',

        profession:
            'Please select your primary skill.',

        mobile_number:
            'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.',

        email:
            'Enter a valid email address.',

        password:
            'Password must contain at least 6 characters.',

        price:
            'Enter a valid price greater than ₹0.',

        location:
            'Please select your address.'
    };

    const FILE_RULES = {
        uploadPhoto: {
            label: 'photo',
            maxSize: 2 * 1024 * 1024,
            types: [
                'image/jpeg',
                'image/png',
                'image/webp'
            ],
            extensions: [
                'jpg',
                'jpeg',
                'png',
                'webp'
            ],
            optional: false
        },

        photoIdentity: {
            label: 'identity document',
            maxSize: 5 * 1024 * 1024,
            types: [
                'image/jpeg',
                'image/png',
                'image/webp',
                'application/pdf'
            ],
            extensions: [
                'jpg',
                'jpeg',
                'png',
                'webp',
                'pdf'
            ],
            optional: false
        },

        additionalDocuments: {
            label: 'additional document',
            maxSize: 5 * 1024 * 1024,
            types: [
                'image/jpeg',
                'image/png',
                'image/webp',
                'application/pdf'
            ],
            extensions: [
                'jpg',
                'jpeg',
                'png',
                'webp',
                'pdf'
            ],
            optional: true
        }
    };

    const SKILL_LABELS = {
        plumber: 'Plumber',
        electrician: 'Electrician',
        carpenter: 'Carpenter',
        painter: 'Painter',
        cleaner: 'Cleaner',
        'ac-repair': 'AC / Appliance Repair',
        'pest-control': 'Pest Control',
        moving: 'Moving & Packing',
        gardener: 'Gardener',
        handyman: 'General Handyman'
    };

    const ID_NUMBER_PATTERN =
        /^[A-Za-z0-9]{6,20}$/;

    const form =
        document.getElementById(
            'providerRegisterStep3Form'
        );

    const backBtn =
        document.getElementById('backBtn');

    const submitBtn = form
        ? form.querySelector('.submit-btn')
        : null;

    const uploadPhotoInput =
        document.getElementById('uploadPhoto');

    const photoIdentityInput =
        document.getElementById('photoIdentity');

    const identityNumberInput =
        document.getElementById('identityNumber');

    const additionalDocsInput =
        document.getElementById(
            'additionalDocuments'
        );

    function formatFileSize(bytes) {
        return (
            bytes / (1024 * 1024)
        ).toFixed(1) + ' MB';
    }

    function getExtension(filename) {
        const position =
            filename.lastIndexOf('.');

        return position === -1
            ? ''
            : filename
                .slice(position + 1)
                .toLowerCase();
    }

    function getFileErrorElement(input) {
        const describedBy =
            input.getAttribute(
                'aria-describedby'
            ) || '';

        return describedBy
            .split(' ')
            .map((id) =>
                document.getElementById(id)
            )
            .find(
                (element) =>
                    element &&
                    element.classList.contains(
                        'form-error'
                    )
            );
    }

    function setFileError(input, message) {
        const wrapper =
            input.closest('.file-wrapper');

        const errorEl =
            getFileErrorElement(input);

        if (message) {
            if (wrapper) {
                wrapper.classList.add(
                    'has-error'
                );
            }

            input.setAttribute(
                'aria-invalid',
                'true'
            );

            if (errorEl) {
                errorEl.textContent = message;
            }

            return;
        }

        if (wrapper) {
            wrapper.classList.remove(
                'has-error'
            );
        }

        input.removeAttribute(
            'aria-invalid'
        );

        if (errorEl) {
            errorEl.textContent = '';
        }
    }

    function validateFile(input, rules) {
        if (
            !input.files ||
            input.files.length === 0
        ) {
            if (rules.optional) {
                setFileError(input, '');
                return true;
            }

            setFileError(
                input,
                `Please upload your ${rules.label}.`
            );

            return false;
        }

        const file = input.files[0];

        const extension =
            getExtension(file.name);

        const validExtension =
            rules.extensions.includes(
                extension
            );

        const validType =
            !file.type ||
            rules.types.includes(file.type);

        if (!validExtension || !validType) {
            setFileError(
                input,
                `Invalid ${rules.label} format. Allowed formats: ${rules.extensions
                    .join(', ')
                    .toUpperCase()}.`
            );

            return false;
        }

        if (file.size > rules.maxSize) {
            setFileError(
                input,
                `${file.name} is ${formatFileSize(
                    file.size
                )}. Maximum allowed size is ${formatFileSize(
                    rules.maxSize
                )}.`
            );

            return false;
        }

        setFileError(input, '');
        return true;
    }

    function updateFileLabel(input) {
        const label =
            document.getElementById(
                input.id + 'Label'
            );

        if (!label) return;

        const text =
            label.querySelector(
                '.file-text'
            );

        if (!text) return;

        if (
            input.files &&
            input.files.length > 0
        ) {
            label.classList.add(
                'file-selected'
            );

            text.textContent =
                input.files[0].name;

            return;
        }

        label.classList.remove(
            'file-selected'
        );

        text.textContent =
            'Choose file';
    }

    function validateIdentityNumber() {
        const value =
            identityNumberInput.value.trim();

        const errorEl =
            document.getElementById(
                'identityNumberError'
            );

        if (!value) {
            identityNumberInput.classList.add(
                'input-error'
            );

            identityNumberInput.setAttribute(
                'aria-invalid',
                'true'
            );

            errorEl.textContent =
                'Please enter your identity number.';

            return false;
        }

        if (
            !ID_NUMBER_PATTERN.test(value)
        ) {
            identityNumberInput.classList.add(
                'input-error'
            );

            identityNumberInput.setAttribute(
                'aria-invalid',
                'true'
            );

            errorEl.textContent =
                'Identity number must contain 6-20 letters or numbers without spaces.';

            return false;
        }

        identityNumberInput.classList.remove(
            'input-error'
        );

        identityNumberInput.removeAttribute(
            'aria-invalid'
        );

        errorEl.textContent = '';

        return true;
    }

    function createFieldError(
        field,
        message
    ) {
        const error = new Error(
            message ||
            FIELD_MESSAGES[field] ||
            'Please check the information you entered.'
        );

        error.field = field;

        return error;
    }

    function validateSavedDetails(profile) {
        if (
            !profile.fullName ||
            !/^[A-Za-z][A-Za-z .'-]{1,49}$/.test(
                profile.fullName.trim()
            )
        ) {
            return createFieldError(
                'full_name'
            );
        }

        const age = Number(profile.age);

        if (
            !Number.isInteger(age) ||
            age < 18 ||
            age > 99
        ) {
            return createFieldError('age');
        }

        if (!profile.qualification) {
            return createFieldError(
                'qualification'
            );
        }

        if (!profile.skills) {
            return createFieldError(
                'profession'
            );
        }

        if (
            !/^[6-9]\d{9}$/.test(
                (
                    profile.mobileNumber || ''
                ).trim()
            )
        ) {
            return createFieldError(
                'mobile_number'
            );
        }

        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(
                (
                    profile.email || ''
                ).trim()
            )
        ) {
            return createFieldError(
                'email'
            );
        }

        if (
            !profile.password ||
            profile.password.length < 6
        ) {
            return createFieldError(
                'password'
            );
        }

        const price =
            Number(profile.price);

        if (
            !Number.isInteger(price) ||
            price <= 0
        ) {
            return createFieldError(
                'price'
            );
        }

        if (!profile.address) {
            return createFieldError(
                'location'
            );
        }

        return null;
    }

    function buildBackendError(
        data,
        statusCode
    ) {
        const detail =
            data && data.detail;

        if (
            Array.isArray(detail) &&
            detail.length > 0
        ) {
            const issue = detail[0];

            const location =
                Array.isArray(issue.loc)
                    ? issue.loc
                    : [];

            const field =
                location.length
                    ? location[
                        location.length - 1
                    ]
                    : null;

            return createFieldError(
                field,
                FIELD_MESSAGES[field] ||
                issue.msg
            );
        }

        if (
            detail &&
            typeof detail === 'object'
        ) {
            return createFieldError(
                detail.field,
                detail.message ||
                detail.msg
            );
        }

        if (
            typeof detail === 'string'
        ) {
            const message =
                detail.toLowerCase();

            if (
                message.includes('email') &&
                message.includes('registered')
            ) {
                return createFieldError(
                    'email',
                    'This email is already registered. Sign in or use another email.'
                );
            }

            if (
                message.includes('mobile') &&
                message.includes('registered')
            ) {
                return createFieldError(
                    'mobile_number',
                    'This mobile number is already registered. Sign in or use another number.'
                );
            }

            return new Error(detail);
        }

        if (statusCode === 422) {
            return new Error(
                'Some registration details are invalid. Please check all fields.'
            );
        }

        return new Error(
            'Registration failed. Please try again.'
        );
    }

    function redirectToIncorrectField(
        error
    ) {
        const page =
            error &&
            FIELD_ROUTES[error.field];

        if (!page) return false;

        sessionStorage.setItem(
            SERVER_ERROR_KEY,
            JSON.stringify({
                field: error.field,
                message: error.message
            })
        );

        window.location.href = page;

        return true;
    }

    async function registerWorker() {
        const raw =
            sessionStorage.getItem(
                PROFILE_KEY
            );

        const profile =
            raw ? JSON.parse(raw) : {};

        const savedDetailsError =
            validateSavedDetails(profile);

        if (savedDetailsError) {
            throw savedDetailsError;
        }

        const skill =
            (
                profile.skills || ''
            ).toLowerCase();

        const profession =
            SKILL_LABELS[skill] ||
            skill ||
            'Professional';

        const payload = {
            full_name:
                profile.fullName.trim(),

            email:
                profile.email
                    .trim()
                    .toLowerCase(),

            mobile_number:
                profile.mobileNumber.trim(),

            password:
                profile.password,

            profession:
                profession,

            bio:
                '',

            experience:
                profile.experience || null,

            qualification:
                profile.qualification,

            location:
                profile.address,

            price:
                Number(profile.price),

            availability:
                profile.bookingPreference ||
                null,

            profile_image:
                null
        };

        const api =
            window.HandyHireAPI;

        if (
            !api ||
            typeof api.apiFetch !==
                'function'
        ) {
            throw new Error(
                'Unable to connect to HandyHire. Make sure the backend is running on port 8000.'
            );
        }

        const response =
            await api.apiFetch(
                '/api/auth/register/worker',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );

        if (!response.ok) {
            let data = null;

            try {
                data =
                    await response.json();
            } catch (error) {
                data = null;
            }

            throw buildBackendError(
                data,
                response.status
            );
        }

        const tokenData =
            await response.json();

        api.setAuth(
            tokenData.access_token,
            {
                id:
                    tokenData.user_id,

                full_name:
                    tokenData.full_name,

                role:
                    tokenData.role
            }
        );

        return tokenData;
    }

    async function uploadPhotoAfterRegistration() {
        const file =
            uploadPhotoInput.files &&
            uploadPhotoInput.files[0];

        if (!file) {
            return Promise.resolve();
        }

        const formData = new FormData();
        formData.append('file', file);

        const token =
            localStorage.getItem(
                'handyhire.auth.token'
            );

        return fetch(
            'http://127.0.0.1:8000/api/worker/profile-image',
            {
                method: 'POST',
                headers: token
                    ? {
                        'Authorization':
                            'Bearer ' + token
                    }
                    : {},
                body: formData,
            }
        ).then(function (response) {
            if (response.ok) {
                return response.json();
            }

            return response.json().then(function (err) {
                throw new Error(
                    (err && err.detail) ||
                    'Photo upload failed. You can update it later from your profile.'
                );
            }).catch(function () {
                throw new Error(
                    'Photo upload failed. You can update it later from your profile.'
                );
            });
        }).catch(function (err) {
            throw err;
        });
    }

    async function submitRegistration() {
        const formError =
            document.getElementById(
                'providerRegisterFormError'
            );

        try {
            formError.textContent = '';

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent =
                    'Submitting...';
            }

            await registerWorker();

            if (uploadPhotoInput.files && uploadPhotoInput.files[0]) {
                formError.textContent = 'Uploading photo...';

                try {
                    await uploadPhotoAfterRegistration();
                } catch (photoError) {
                    formError.textContent =
                        (photoError && photoError.message) ||
                        'Photo upload failed. You can update it later from your profile.';
                }
            }

            window.location.href =
                SUCCESS_PAGE;
        } catch (error) {
            if (
                redirectToIncorrectField(
                    error
                )
            ) {
                return;
            }

            formError.textContent =
                error.message ||
                'Registration failed. Please try again.';
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent =
                    'Submit';
            }
        }
    }

    function init() {
        if (!form) return;

        uploadPhotoInput.addEventListener(
            'change',
            function () {
                updateFileLabel(
                    uploadPhotoInput
                );

                validateFile(
                    uploadPhotoInput,
                    FILE_RULES.uploadPhoto
                );
            }
        );

        photoIdentityInput.addEventListener(
            'change',
            function () {
                updateFileLabel(
                    photoIdentityInput
                );

                validateFile(
                    photoIdentityInput,
                    FILE_RULES.photoIdentity
                );
            }
        );

        additionalDocsInput.addEventListener(
            'change',
            function () {
                updateFileLabel(
                    additionalDocsInput
                );

                validateFile(
                    additionalDocsInput,
                    FILE_RULES
                        .additionalDocuments
                );
            }
        );

        identityNumberInput.addEventListener(
            'input',
            function () {
                if (
                    identityNumberInput
                        .classList
                        .contains(
                            'input-error'
                        )
                ) {
                    validateIdentityNumber();
                }
            }
        );

        if (backBtn) {
            backBtn.addEventListener(
                'click',
                function () {
                    window.location.href =
                        BACK_PAGE;
                }
            );
        }

        form.addEventListener(
            'submit',
            async function (event) {
                event.preventDefault();

                const validPhoto =
                    validateFile(
                        uploadPhotoInput,
                        FILE_RULES.uploadPhoto
                    );

                const validIdentityDocument =
                    validateFile(
                        photoIdentityInput,
                        FILE_RULES
                            .photoIdentity
                    );

                const validIdentityNumber =
                    validateIdentityNumber();

                const validAdditionalDocument =
                    validateFile(
                        additionalDocsInput,
                        FILE_RULES
                            .additionalDocuments
                    );

                if (
                    validPhoto &&
                    validIdentityDocument &&
                    validIdentityNumber &&
                    validAdditionalDocument
                ) {
                    await submitRegistration();
                    return;
                }

                const firstInvalidFile =
                    form.querySelector(
                        '.file-wrapper.has-error .file-input'
                    );

                if (firstInvalidFile) {
                    firstInvalidFile.focus();
                    return;
                }

                const firstInvalidInput =
                    form.querySelector(
                        '.input-error'
                    );

                if (firstInvalidInput) {
                    firstInvalidInput.focus();
                }
            }
        );
    }

    if (
        document.readyState ===
        'loading'
    ) {
        document.addEventListener(
            'DOMContentLoaded',
            init
        );
    } else {
        init();
    }
})();