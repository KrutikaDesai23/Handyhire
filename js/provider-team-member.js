/* =========================================================
   HandyHire - Team Member JavaScript
   Reads the selected member (and selected team) from
   sessionStorage - written by team-page.js when the user
   taps a member card. Displays the member's details. This
   page is part of the Team Package flow only; there is NO
   booking CTA and NO redirect to job-hire / worker-profile.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Catalog of detailed information for every team
     * member. In production this would come from an API.
     */
    const MEMBER_DETAILS = {
        'Rushda Kalghatgi': {
            age: 32, mobile: '+91 90123 45678',
            email: 'rushda.kalghatgi@handyhire.test',
            address: 'Sector 21, Noida, Uttar Pradesh',
            qualification: '10 years of construction experience',
        },
        'Ravi Kumar': {
            age: 34, mobile: '+91 98765 43210',
            email: 'ravi.kumar@handyhire.test',
            address: 'Sector 18, Noida, Uttar Pradesh',
            qualification: 'ITI in Plumbing, 8 years field experience',
        },
        'Anita Sharma': {
            age: 30, mobile: '+91 91234 56789',
            email: 'anita.sharma@handyhire.test',
            address: 'Sector 12, Noida, Uttar Pradesh',
            qualification: 'Certified Electrician, 6 years experience',
        },
        'Suresh Patel': {
            age: 41, mobile: '+91 99887 76655',
            email: 'suresh.patel@handyhire.test',
            address: 'Sector 9, Noida, Uttar Pradesh',
            qualification: 'Master Carpenter, 15 years experience',
        },
        'Mohan Das': {
            age: 38, mobile: '+91 98712 34567',
            email: 'mohan.das@handyhire.test',
            address: 'Sector 14, Noida, Uttar Pradesh',
            qualification: 'Expert Painter & Mason',
        },
        'Priya Singh': {
            age: 27, mobile: '+91 90909 80808',
            email: 'priya.singh@handyhire.test',
            address: 'Sector 22, Noida, Uttar Pradesh',
            qualification: 'Certified Cleaner, eco-friendly methods',
        },
        'Neha Iyer': {
            age: 29, mobile: '+91 92345 67890',
            email: 'neha.iyer@handyhire.test',
            address: 'Sector 11, Noida, Uttar Pradesh',
            qualification: 'Licensed Pest Control Specialist',
        },
        'Arjun Mehta': {
            age: 36, mobile: '+91 93456 78901',
            email: 'arjun.mehta@handyhire.test',
            address: 'Sector 5, Noida, Uttar Pradesh',
            qualification: 'Handyman, 10 years multi-trade experience',
        },
        'Lata Verma': {
            age: 33, mobile: '+91 94567 89012',
            email: 'lata.verma@handyhire.test',
            address: 'Sector 7, Noida, Uttar Pradesh',
            qualification: 'AC & Refrigeration Specialist',
        },
        'Asha Verma': {
            age: 28, mobile: '+91 95678 90123',
            email: 'asha.verma@handyhire.test',
            address: 'Sector 4, Noida, Uttar Pradesh',
            qualification: 'Cleaning Helper, 4 years experience',
        },
        'Rina Das': {
            age: 26, mobile: '+91 96789 01234',
            email: 'rina.das@handyhire.test',
            address: 'Sector 6, Noida, Uttar Pradesh',
            qualification: 'Cleaning Helper, 3 years experience',
        },
        'Pooja Nair': {
            age: 31, mobile: '+91 97890 12345',
            email: 'pooja.nair@handyhire.test',
            address: 'Sector 8, Noida, Uttar Pradesh',
            qualification: 'Helper / Painter, 7 years experience',
        },
    };

    /**
     * Generate a placeholder avatar data URL.
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
                        <stop offset='100%' stop-color='hsl(${(hue + 40) % 360}, 30%, 55%)'/>
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
     * Read the selected member from sessionStorage.
     * @returns {Object|null}
     */
    function readSelectedMember() {
        try {
            const raw = sessionStorage.getItem('handyhire.selectedMember');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Set the textContent of an element when both are
     * present.
     */
    function setText(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = value;
    }

    /**
     * Populate the page from the stored member record.
     */
    function populatePage() {
        const member = readSelectedMember();
        const name = (member && member.name) || 'Team Member';
        const occupation = (member && member.occupation) || 'Team Member';
        const team = (member && member.team) || 'Selected Team';

        setText('memberNameLarge', name);
        setText('memberInfoOccupation', occupation);
        setText('memberTeamLine', 'Part of: ' + team);

        const details = MEMBER_DETAILS[name] || {};

        setText('memberInfoAge',
            details.age ? details.age + ' years' : '\u2014');
        setText('memberInfoMobile', details.mobile || '\u2014');
        setText('memberInfoEmail',   details.email   || '\u2014');
        setText('memberInfoAddress', details.address || '\u2014');
        setText('memberInfoQualification',
            details.qualification || '\u2014');

        const avatar = document.getElementById('memberAvatarLarge');
        if (avatar) avatar.style.backgroundImage = buildAvatar(name);
    }

    /**
     * Initialize the Team Member page.
     */
    function init() {
        populatePage();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
