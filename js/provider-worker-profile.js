/* =========================================================
   HandyHire - Provider Worker Profile JavaScript
   Reads the current provider's profile from sessionStorage
   (populated during provider registration) and populates
   the professional dashboard. Falls back to a safe default
   only when no provider profile exists.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Storage key for the provider's own profile data.
     * Written by the provider registration flow.
     */
    const PROFILE_STORAGE_KEY = 'handyhire.provider.profile';

    /**
     * Safe fallback values shown only when no provider
     * profile has been registered yet.
     */
    const FALLBACK = {
        fullName:     'Provider',
        profession:   'Professional',
        description:  'Professional services on HandyHire.',
        experience:   '--',
        mobile:       '--',
        email:        '--',
        location:     '--',
        qualification:'--',
        rating:       0,
        reviews:      0,
        jobsCompleted:0,
        services:     [],
    };

    /**
     * Skills-to-profession mapping so the profile can display
     * a human-readable profession from the registration skill value.
     */
    const SKILL_LABELS = {
        'plumber':         'Plumber',
        'electrician':     'Electrician',
        'carpenter':       'Carpenter',
        'painter':         'Painter',
        'cleaner':         'Cleaner',
        'ac-repair':       'AC / Appliance Repair',
        'pest-control':    'Pest Control',
        'moving':          'Moving & Packing',
        'gardener':        'Gardener',
        'handyman':        'General Handyman',
    };

    /**
     * Skills-to-services mapping for the My Services pills.
     */
    const SKILL_SERVICES = {
        'plumber':         ['Pipe Repair', 'Leak Fixing', 'Tap Installation', 'Bathroom Fittings', 'Emergency Plumbing'],
        'electrician':     ['Home Wiring', 'Switchboard Repair', 'Appliance Repair', 'Lighting Installation', 'Safety Audit'],
        'carpenter':       ['Furniture Repair', 'Modular Kitchen', 'Custom Woodwork', 'Wardrobe Fitting', 'Door Frames'],
        'painter':         ['Interior Painting', 'Exterior Painting', 'Wall Finishing', 'Color Consultation', 'Texture Work'],
        'cleaner':         ['Deep Cleaning', 'Kitchen Cleaning', 'Post-Move Clean', 'Sofa Cleaning', 'Window Cleaning'],
        'ac-repair':       ['AC Installation', 'Servicing', 'Gas Refilling', 'Split/Window Units', 'Ducting'],
        'pest-control':    ['Cockroach Control', 'Termite Treatment', 'Rodent Management', 'Eco-Friendly Solutions', 'Prevention'],
        'moving':          ['Packing', 'Loading', 'Unloading', 'Transport', 'Unpacking'],
        'gardener':        ['Lawn Mowing', 'Pruning', 'Planting', 'Weeding', 'Garden Cleanup'],
        'handyman':        ['Drilling', 'Mounting', 'Furniture Assembly', 'Small Repairs', 'Installation'],
    };

    /**
     * Read the persisted provider profile from sessionStorage.
     * @returns {object}
     */
    function readProviderProfile() {
        try {
            const raw = sessionStorage.getItem(PROFILE_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    return parsed;
                }
            }
        } catch (e) {
            // Ignore storage errors.
        }
        return null;
    }

    /**
     * Resolve the provider record. Prefers the persisted
     * registration profile over the catalog fallback.
     * @returns {object}
     */
    function resolveProvider() {
        const stored = readProviderProfile();
        if (stored && stored.fullName) {
            const skillKey = stored.skills || '';
            const profession = SKILL_LABELS[skillKey] || stored.profession || 'Professional';
            const services = SKILL_SERVICES[skillKey] || stored.services || ['General Maintenance', 'Consultation', 'On-site Service'];

            return {
                name: stored.fullName,
                profession: profession,
                description: stored.description || ('Professional ' + profession + ' services on HandyHire.'),
                experience: stored.experience || (stored.age ? stored.age + ' years' : '--'),
                mobile: stored.mobileNumber || stored.mobile || '--',
                email: stored.email || '--',
                location: stored.address || stored.location || '--',
                qualification: stored.qualification || '--',
                rating: stored.rating != null ? Number(stored.rating) : 0,
                reviews: stored.reviews != null ? Number(stored.reviews) : 0,
                jobsCompleted: stored.jobsCompleted != null ? Number(stored.jobsCompleted) : 0,
                services: services,
            };
        }

        // No stored profile: return minimal fallback.
        return FALLBACK;
    }

    /**
     * Set the text content of an element only when both
     * the element and the new value are present.
     */
    function setText(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = value;
    }

    /**
     * Generate a placeholder avatar data URL from the
     * provider name.
     * @param {string} name
     * @returns {string} CSS background value
     */
    function buildAvatar(name) {
        const initials = name
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('') || '?';

        const hue = Array.from(name).reduce(
            (sum, ch) => sum + ch.charCodeAt(0),
            0
        ) % 360;

        const svg = `
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>
                <defs>
                    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
                        <stop offset='0%' stop-color='hsl(${hue}, 35%, 70%)'/>
                        <stop offset='100%' stop-color='hsl(${hue}, 40%, 55%)'/>
                    </linearGradient>
                </defs>
                <circle cx='60' cy='60' r='60' fill='url(#g)'/>
                <text x='50%' y='54%' text-anchor='middle'
                      font-family='Inter, sans-serif' font-size='44'
                      font-weight='700' fill='#ffffff' dominant-baseline='middle'>
                    ${initials}
                </text>
            </svg>
        `.trim();

        return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    }

    /**
     * Populate the professional hero section.
     */
    function populateHero(provider) {
        setText('profileHeroName', provider.name);
        setText('profileHeroTagline', provider.description);

        const avatar = document.getElementById('profileHeroAvatar');
        if (avatar) {
            avatar.style.backgroundImage = buildAvatar(provider.name);
        }
    }

    /**
     * Hydrate provider profile from the backend if a token exists.
     */
    async function hydrateFromBackend() {
        if (!window.HandyHireAPI || !window.HandyHireAPI.isLoggedIn()) {
            return;
        }
        try {
            const user = await window.HandyHireAPI.fetchCurrentUser();
            if (!user) return;

            const skillKey = '';
            const profession = SKILL_LABELS[skillKey] || 'Professional';
            const services = SKILL_SERVICES[skillKey] || ['General Maintenance', 'Consultation', 'On-site Service'];

            const provider = {
                name: user.full_name || 'Provider',
                profession: profession,
                description: 'Professional ' + profession + ' services on HandyHire.',
                experience: '--',
                mobile: user.mobile_number || '--',
                email: user.email || '--',
                location: user.address || '--',
                qualification: '--',
                rating: 0,
                reviews: 0,
                jobsCompleted: 0,
                services: services,
            };

            populateHero(provider);
            populateStats(provider);
            populateInfo(provider);
            renderServices(provider);
        } catch (e) {
            // Ignore backend errors - fall back to stored profile.
        }
    }

    /**
     * Populate the stats section with provider data.
     */
    function populateStats(provider) {
        setText('statJobs', provider.jobsCompleted != null ? String(provider.jobsCompleted) : '--');
        setText('statRating', provider.rating != null ? Number(provider.rating).toFixed(1) : '--');
        setText('statReviews', provider.reviews != null ? String(provider.reviews) : '--');
        setText('statExperience', provider.experience || '--');
    }

    /**
     * Populate the professional information cards.
     */
    function populateInfo(provider) {
        setText('infoProfession', provider.profession || '--');
        setText('infoExperience', provider.experience || '--');
        setText('infoQualification', provider.qualification || '--');
        setText('infoLocation', provider.location || '--');
        setText('infoMobile', provider.mobile || '--');
        setText('infoEmail', provider.email || '--');
    }

    /**
     * Render the services pills for the provider.
     */
    function renderServices(provider) {
        const list = document.getElementById('servicesPills');
        if (!list) return;

        const services = Array.isArray(provider.services) && provider.services.length
            ? provider.services
            : ['General Maintenance', 'Consultation', 'On-site Service'];

        list.innerHTML = services.map(function (s) {
            const safe = String(s)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
            return '<li class="service-pill">' + safe + '</li>';
        }).join('');
    }

    /**
     * Wire up the Signout button. Routes to the welcome
     * page (index.html).
     */
    function initSignOut() {
        const btn = document.getElementById('signOutBtn');
        if (!btn) return;

        btn.addEventListener('click', function () {
            if (window.HandyHireAPI) {
                window.HandyHireAPI.clearAuth();
            }
            window.location.href = '../index.html';
        });
    }

    /**
     * Initialize the Provider Worker Profile page.
     */
    function init() {
        const provider = resolveProvider();

        populateHero(provider);
        populateStats(provider);
        populateInfo(provider);
        renderServices(provider);
        initSignOut();
        hydrateFromBackend();
    }

    // Run after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
