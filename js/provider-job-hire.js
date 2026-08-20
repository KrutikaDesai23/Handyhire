/* =========================================================
   HandyHire - Provider Job Hire (Person Details) JavaScript
   Receives the selected person via ?worker=<slug> or
   sessionStorage and populates the page with the
   matching record from a self-contained provider worker
   catalog so the displayed name, occupation, rating,
   price and details always match the clicked card.

   Source semantics:
     - source=individual  default: opened from a person
       card on a Worker Home page. Back -> provider-home.
     - source=team        opened from a team-member card
       on the Provider Team Page. Back -> provider-team-page
       and the selected member's team-context profession
       is preferred over the standalone profession.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Convert a worker name into a URL-safe slug.
     * Kept in sync with the slug generation in the
     * provider-home*.js controllers and provider-team-page.js.
     * @param {string} name
     * @returns {string}
     */
    function makeSlug(name) {
        return String(name || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Provider worker catalog. Self-contained so this
     * controller does not depend on the customer-side
     * job-hire.js file or its data.
     *
     * Review shape:
     *   { author: string, rating: 1-5, text: string, date: string }
     */
    const WORKER_CATALOG = {
        'ravi-kumar': {
            name: 'Ravi Kumar',
            profession: 'Plumber',
            shortDescription: 'Reliable plumber specialising in leak repair, pipe fitting and bathroom installations.',
            price: '\u20B9299',
            rating: 4.8,
            reviewCount: 142,
            experience: '8 years',
            mobile: '+91 98456 11223',
            email: 'ravi.kumar@handyhire.test',
            location: 'Sector 18, Noida, UP',
            qualification: 'ITI in Plumbing, Certified Pipe Fitter',
            reviews: [
                { author: 'Anika S.', rating: 5, text: 'Came on time, fixed the leak in under an hour. Very polite and professional.', date: '2 weeks ago' },
                { author: 'Manoj P.', rating: 5, text: 'Reasonable price, clean work. Bathroom fittings look perfect.', date: '1 month ago' },
                { author: 'Sneha R.', rating: 4, text: 'Good work, slight delay in arrival but worth the wait.', date: '2 months ago' },
            ],
        },
        'anita-sharma': {
            name: 'Anita Sharma',
            profession: 'Electrician',
            shortDescription: 'Certified electrician with expertise in home wiring, switches and appliance repair.',
            price: '\u20B9349',
            rating: 4.7,
            reviewCount: 98,
            experience: '6 years',
            mobile: '+91 99812 44567',
            email: 'anita.sharma@handyhire.test',
            location: 'Karol Bagh, New Delhi',
            qualification: 'Diploma in Electrical Engineering, Licensed Wireman',
            reviews: [
                { author: 'Rohit K.', rating: 5, text: 'Excellent. Diagnosed the issue quickly and explained the fix clearly.', date: '1 week ago' },
                { author: 'Pooja M.', rating: 5, text: 'Switchboard rewiring done perfectly. Tidied up after the job.', date: '3 weeks ago' },
                { author: 'Vivek J.', rating: 4, text: 'Knowledgeable and courteous. Slightly pricy but worth it.', date: '1 month ago' },
            ],
        },
        'suresh-patel': {
            name: 'Suresh Patel',
            profession: 'Carpenter',
            shortDescription: 'Skilled carpenter for furniture repair, modular kitchen fitting and custom woodwork.',
            price: '\u20B9399',
            rating: 4.6,
            reviewCount: 87,
            experience: '12 years',
            mobile: '+91 90909 77881',
            email: 'suresh.patel@handyhire.test',
            location: 'Satellite, Ahmedabad, GJ',
            qualification: 'Diploma in Furniture Design, Master Carpenter',
            reviews: [
                { author: 'Neha T.',  rating: 5, text: 'Beautiful wardrobe repair. Looks brand new again.', date: '5 days ago' },
                { author: 'Imran A.', rating: 4, text: 'Custom shelving done well. Finished on time.', date: '3 weeks ago' },
                { author: 'Kavita D.', rating: 4, text: 'Polite and skilled. Charges are fair for the quality.', date: '2 months ago' },
            ],
        },
        'priya-singh': {
            name: 'Priya Singh',
            profession: 'Cleaner',
            shortDescription: 'Thorough deep-cleaning specialist for homes, kitchens and post-move cleans.',
            price: '\u20B9249',
            rating: 4.9,
            reviewCount: 211,
            experience: '5 years',
            mobile: '+91 98102 33445',
            email: 'priya.singh@handyhire.test',
            location: 'Bandra West, Mumbai, MH',
            qualification: 'Certified Housekeeping Professional, Eco-Clean Trained',
            reviews: [
                { author: 'Aarti V.', rating: 5, text: 'Best deep clean I have had. Every corner was spotless.', date: '1 week ago' },
                { author: 'Karan B.', rating: 5, text: 'On time, well-equipped and very respectful of belongings.', date: '2 weeks ago' },
                { author: 'Meera N.', rating: 5, text: 'Kitchen looks factory-fresh. Will book again.', date: '1 month ago' },
            ],
        },
        'mohan-das': {
            name: 'Mohan Das',
            profession: 'Painter',
            shortDescription: 'Interior & exterior painter with a flawless finish and zero mess policy.',
            price: '\u20B9459',
            rating: 4.5,
            reviewCount: 64,
            experience: '10 years',
            mobile: '+91 97321 66554',
            email: 'mohan.das@handyhire.test',
            location: 'Salt Lake, Kolkata, WB',
            qualification: 'Certified Painting Contractor, Industrial Painter',
            reviews: [
                { author: 'Suvro G.',  rating: 5, text: 'Wall finish is buttery smooth. Masking was perfect.', date: '2 weeks ago' },
                { author: 'Rina D.',   rating: 4, text: 'Lovely colour match, completed a day late.', date: '1 month ago' },
                { author: 'Aditya S.', rating: 4, text: 'Good prep work, took time but quality is there.', date: '6 weeks ago' },
            ],
        },
        'lata-verma': {
            name: 'Lata Verma',
            profession: 'AC Repair',
            shortDescription: 'Expert in AC installation, servicing, gas refilling and split/window units.',
            price: '\u20B9549',
            rating: 4.8,
            reviewCount: 156,
            experience: '9 years',
            mobile: '+91 90011 22998',
            email: 'lata.verma@handyhire.test',
            location: 'MG Road, Bengaluru, KA',
            qualification: 'HVAC Diploma, Certified Refrigeration Technician',
            reviews: [
                { author: 'Rakesh M.', rating: 5, text: 'Cooling restored in 30 minutes. Gas refill done right.', date: '4 days ago' },
                { author: 'Tanya P.',  rating: 5, text: 'Annual service was thorough. Filters cleaned perfectly.', date: '3 weeks ago' },
                { author: 'Sahil Q.',  rating: 4, text: 'On-time and knowledgeable. Reasonable price.', date: '1 month ago' },
            ],
        },
        'arjun-mehta': {
            name: 'Arjun Mehta',
            profession: 'Handyman',
            shortDescription: 'All-rounder handyman for drilling, mounting, furniture assembly and small fixes.',
            price: '\u20B9199',
            rating: 4.6,
            reviewCount: 73,
            experience: '4 years',
            mobile: '+91 99887 11223',
            email: 'arjun.mehta@handyhire.test',
            location: 'Andheri East, Mumbai, MH',
            qualification: 'Vocational Diploma in General Maintenance',
            reviews: [
                { author: 'Hitesh J.', rating: 5, text: 'Mounted three TVs and a shelf in under an hour. Perfect.', date: '1 week ago' },
                { author: 'Rupal S.',  rating: 4, text: 'Handy and quick. Did a great job with the assembly.', date: '3 weeks ago' },
            ],
        },
        'vikram-joshi': {
            name: 'Vikram Joshi',
            profession: 'AC Repair',
            shortDescription: 'Senior AC technician for installation, ducting and commercial units.',
            price: '\u20B9549',
            rating: 4.7,
            reviewCount: 49,
            experience: '14 years',
            mobile: '+91 98221 33456',
            email: 'vikram.joshi@handyhire.test',
            location: 'Civil Lines, Pune, MH',
            qualification: 'B.Tech Mechanical, HVAC Certified',
            reviews: [
                { author: 'Devika R.', rating: 5, text: 'Commercial AC install done flawlessly.', date: '2 weeks ago' },
                { author: 'Nikhil T.', rating: 4, text: 'Professional and thorough. Highly recommended.', date: '1 month ago' },
            ],
        },
        'neha-iyer': {
            name: 'Neha Iyer',
            profession: 'Pest Control',
            shortDescription: 'Eco-friendly pest control for cockroaches, termites and rodent management.',
            price: '\u20B9279',
            rating: 4.4,
            reviewCount: 58,
            experience: '5 years',
            mobile: '+91 94440 12321',
            email: 'neha.iyer@handyhire.test',
            location: 'T. Nagar, Chennai, TN',
            qualification: 'B.Sc. Zoology, Licensed Pest Control Operator',
            reviews: [
                { author: 'Sandeep K.',  rating: 5, text: 'No cockroaches since the treatment. Kid-safe products.', date: '2 weeks ago' },
                { author: 'Priyanka G.', rating: 4, text: 'Effective and odourless. Friendly technician.', date: '1 month ago' },
            ],
        },

        /* ---------- Team-only members ---------- */
        'rushda-kalghatgi': {
            name: 'Rushda Kalghatgi',
            profession: 'Laborer',
            shortDescription: 'Reliable crew laborer specialising in site preparation, material handling and finishing support.',
            price: '\u20B9159',
            rating: 4.6,
            reviewCount: 41,
            experience: '4 years',
            mobile: '+91 90000 12312',
            email: 'rushda.kalghatgi@handyhire.test',
            location: 'Andheri West, Mumbai, MH',
            qualification: 'ITI in Construction, Safety-Certified Crew Member',
            reviews: [
                { author: 'Sana R.',    rating: 5, text: 'Hardworking and on time. Made the whole day easier.', date: '2 weeks ago' },
                { author: 'Dheeraj K.', rating: 4, text: 'Dependable. Did everything that was asked.', date: '1 month ago' },
            ],
        },
        'asha-verma': {
            name: 'Asha Verma',
            profession: 'Helper',
            shortDescription: 'Team helper assisting with cleaning, materials and on-site coordination.',
            price: '\u20B9149',
            rating: 4.5,
            reviewCount: 27,
            experience: '3 years',
            mobile: '+91 98123 33460',
            email: 'asha.verma@handyhire.test',
            location: 'Powai, Mumbai, MH',
            qualification: 'Housekeeping Certificate, First-Aid Trained',
            reviews: [
                { author: 'Ramesh P.', rating: 5, text: 'Cheerful and efficient. Cabinets sparkling.', date: '1 week ago' },
                { author: 'Vikas J.',  rating: 4, text: 'Hardworking. Took initiative on small tasks.', date: '1 month ago' },
            ],
        },
        'rina-das': {
            name: 'Rina Das',
            profession: 'Helper',
            shortDescription: 'Support crew for cleaning teams - sweeping, mopping and supply restocking.',
            price: '\u20B9149',
            rating: 4.4,
            reviewCount: 19,
            experience: '2 years',
            mobile: '+91 98301 78821',
            email: 'rina.das@handyhire.test',
            location: 'Goregaon East, Mumbai, MH',
            qualification: 'Domestic Help Vocational Course',
            reviews: [
                { author: 'Ravi S.', rating: 5, text: 'Quick and thorough. Floors look new.', date: '3 weeks ago' },
            ],
        },
        'pooja-nair': {
            name: 'Pooja Nair',
            profession: 'Helper',
            shortDescription: 'Multi-role helper supporting both cleaning and painting teams.',
            price: '\u20B9159',
            rating: 4.5,
            reviewCount: 22,
            experience: '3 years',
            mobile: '+91 99005 88231',
            email: 'pooja.nair@handyhire.test',
            location: 'Malad West, Mumbai, MH',
            qualification: 'Vocational Diploma in General Maintenance',
            reviews: [
                { author: 'Irfan M.', rating: 5, text: 'Painted, cleaned and tidied in one visit.', date: '1 week ago' },
                { author: 'Lata D.',  rating: 4, text: 'Helpful and on time.', date: '1 month ago' },
            ],
        },

        /* ---------- Team-context profession overrides ---------- */
        'buildright-crew--anita-sharma': {
            name: 'Anita Sharma',
            profession: 'Carpenter',
            shortDescription: 'Carpenter on the BuildRight Crew — furniture fitout, door frames and on-site carpentry.',
            price: '\u20B9399',
            rating: 4.6,
            reviewCount: 38,
            experience: '7 years',
            mobile: '+91 99812 44567',
            email: 'anita.sharma@handyhire.test',
            location: 'Karol Bagh, New Delhi',
            qualification: 'Diploma in Furniture Design, Master Carpenter',
            reviews: [
                { author: 'Soham P.', rating: 5, text: 'Custom door frame fitted perfectly.', date: '2 weeks ago' },
                { author: 'Rhea K.',  rating: 4, text: 'Clean finish, polite worker.', date: '1 month ago' },
            ],
        },
        'buildright-crew--suresh-patel': {
            name: 'Suresh Patel',
            profession: 'Electrician',
            shortDescription: 'Electrician on the BuildRight Crew — wiring, distribution boards and site power.',
            price: '\u20B9399',
            rating: 4.6,
            reviewCount: 36,
            experience: '12 years',
            mobile: '+91 90909 77881',
            email: 'suresh.patel@handyhire.test',
            location: 'Satellite, Ahmedabad, GJ',
            qualification: 'Diploma in Electrical Engineering, Licensed Wireman',
            reviews: [
                { author: 'Vivek N.', rating: 5, text: 'Distribution board wired cleanly and tested.', date: '2 weeks ago' },
                { author: 'Karan M.', rating: 4, text: 'On time, professional finish.', date: '1 month ago' },
            ],
        },
        'buildright-crew--mohan-das': {
            name: 'Mohan Das',
            profession: 'Mason',
            shortDescription: 'Mason on the BuildRight Crew — brickwork, plastering and surface finishing.',
            price: '\u20B9459',
            rating: 4.6,
            reviewCount: 33,
            experience: '10 years',
            mobile: '+91 97321 66554',
            email: 'mohan.das@handyhire.test',
            location: 'Salt Lake, Kolkata, WB',
            qualification: 'Certified Mason & Plastering Contractor',
            reviews: [
                { author: 'Nitin P.', rating: 5, text: 'Brickwork is straight and clean. Excellent plaster finish.', date: '1 week ago' },
                { author: 'Asha R.',  rating: 4, text: 'Good preparation, finished on schedule.', date: '1 month ago' },
            ],
        },
        'home-renovation-team--ravi-kumar': {
            name: 'Ravi Kumar',
            profession: 'Carpenter',
            shortDescription: 'Carpenter on the Home Renovation Team — built-ins, wardrobes and finish carpentry.',
            price: '\u20B9299',
            rating: 4.8,
            reviewCount: 51,
            experience: '8 years',
            mobile: '+91 98456 11223',
            email: 'ravi.kumar@handyhire.test',
            location: 'Sector 18, Noida, UP',
            qualification: 'ITI in Plumbing (also trained in Carpentry)',
            reviews: [
                { author: 'Tara S.', rating: 5, text: 'Beautiful built-in wardrobe. Very neat joints.', date: '2 weeks ago' },
                { author: 'Manu J.', rating: 5, text: 'Finish carpentry done with great attention to detail.', date: '1 month ago' },
            ],
        },
        'home-renovation-team--priya-singh': {
            name: 'Priya Singh',
            profession: 'Painter',
            shortDescription: 'Painter on the Home Renovation Team — interior repaints and accent walls.',
            price: '\u20B9249',
            rating: 4.9,
            reviewCount: 47,
            experience: '5 years',
            mobile: '+91 98102 33445',
            email: 'priya.singh@handyhire.test',
            location: 'Bandra West, Mumbai, MH',
            qualification: 'Certified Painting Contractor',
            reviews: [
                { author: 'Aditya G.',  rating: 5, text: 'Accent wall turned out beautifully. No mess.', date: '1 week ago' },
                { author: 'Pallavi R.', rating: 5, text: 'Crisp edges and even coats.', date: '1 month ago' },
            ],
        },
        'home-renovation-team--lata-verma': {
            name: 'Lata Verma',
            profession: 'Electrician',
            shortDescription: 'Electrician on the Home Renovation Team — switchboard rewiring and lighting installs.',
            price: '\u20B9549',
            rating: 4.8,
            reviewCount: 42,
            experience: '9 years',
            mobile: '+91 90011 22998',
            email: 'lata.verma@handyhire.test',
            location: 'MG Road, Bengaluru, KA',
            qualification: 'HVAC Diploma, Licensed Electrician',
            reviews: [
                { author: 'Ravi M.',  rating: 5, text: 'Lighting layout suggestion saved us money. Great work.', date: '2 weeks ago' },
                { author: 'Kavya N.', rating: 4, text: 'Neat wiring, tested every switch.', date: '1 month ago' },
            ],
        },
        'fixit-squad--ravi-kumar': {
            name: 'Ravi Kumar',
            profession: 'Plumber',
            shortDescription: 'Plumber on the FixIt Squad — leaks, fittings and emergency repairs.',
            price: '\u20B9299',
            rating: 4.8,
            reviewCount: 142,
            experience: '8 years',
            mobile: '+91 98456 11223',
            email: 'ravi.kumar@handyhire.test',
            location: 'Sector 18, Noida, UP',
            qualification: 'ITI in Plumbing, Certified Pipe Fitter',
            reviews: [
                { author: 'Anika S.', rating: 5, text: 'Came on time, fixed the leak in under an hour.', date: '2 weeks ago' },
                { author: 'Manoj P.', rating: 5, text: 'Reasonable price, clean work.', date: '1 month ago' },
            ],
        },
        'fixit-squad--anita-sharma': {
            name: 'Anita Sharma',
            profession: 'Electrician',
            shortDescription: 'Electrician on the FixIt Squad — quick diagnostics and household repairs.',
            price: '\u20B9349',
            rating: 4.7,
            reviewCount: 98,
            experience: '6 years',
            mobile: '+91 99812 44567',
            email: 'anita.sharma@handyhire.test',
            location: 'Karol Bagh, New Delhi',
            qualification: 'Diploma in Electrical Engineering, Licensed Wireman',
            reviews: [
                { author: 'Rohit K.', rating: 5, text: 'Diagnosed the issue quickly and explained the fix.', date: '1 week ago' },
                { author: 'Vivek J.', rating: 4, text: 'Knowledgeable and courteous.', date: '1 month ago' },
            ],
        },
        'powergrid-unit--anita-sharma': {
            name: 'Anita Sharma',
            profession: 'Electrician',
            shortDescription: 'Electrician on the PowerGrid Unit — mainline wiring, distribution boards and safety audits.',
            price: '\u20B9349',
            rating: 4.7,
            reviewCount: 64,
            experience: '6 years',
            mobile: '+91 99812 44567',
            email: 'anita.sharma@handyhire.test',
            location: 'Karol Bagh, New Delhi',
            qualification: 'Diploma in Electrical Engineering, Licensed Wireman',
            reviews: [
                { author: 'Sahil T.',  rating: 5, text: 'Safety audit was thorough. Honest reports.', date: '2 weeks ago' },
                { author: 'Poonam S.', rating: 4, text: 'Mainline rewire done without disruption.', date: '1 month ago' },
            ],
        },
        'powergrid-unit--arjun-mehta': {
            name: 'Arjun Mehta',
            profession: 'Helper',
            shortDescription: 'Helper on the PowerGrid Unit — assists the lead electrician with cable runs, mounting and cleanup.',
            price: '\u20B9199',
            rating: 4.5,
            reviewCount: 21,
            experience: '4 years',
            mobile: '+91 99887 11223',
            email: 'arjun.mehta@handyhire.test',
            location: 'Andheri East, Mumbai, MH',
            qualification: 'ITI Electrical Helper, Safety Trained',
            reviews: [
                { author: 'Naveen K.', rating: 5, text: 'Always on time and ready to assist the lead.', date: '2 weeks ago' },
                { author: 'Reva P.',   rating: 4, text: 'Handled cable runs neatly.', date: '1 month ago' },
            ],
        },
        'freshpaint-crew--mohan-das': {
            name: 'Mohan Das',
            profession: 'Painter',
            shortDescription: 'Painter on the FreshPaint Crew — interior and exterior finishes.',
            price: '\u20B9459',
            rating: 4.5,
            reviewCount: 64,
            experience: '10 years',
            mobile: '+91 97321 66554',
            email: 'mohan.das@handyhire.test',
            location: 'Salt Lake, Kolkata, WB',
            qualification: 'Certified Painting Contractor, Industrial Painter',
            reviews: [
                { author: 'Suvro G.',  rating: 5, text: 'Wall finish is buttery smooth.', date: '2 weeks ago' },
                { author: 'Aditya S.', rating: 4, text: 'Good prep work, finished on time.', date: '6 weeks ago' },
            ],
        },
        'freshpaint-crew--suresh-patel': {
            name: 'Suresh Patel',
            profession: 'Carpenter',
            shortDescription: 'Carpenter on the FreshPaint Crew — pre-paint repairs, doors and trim.',
            price: '\u20B9399',
            rating: 4.6,
            reviewCount: 31,
            experience: '12 years',
            mobile: '+91 90909 77881',
            email: 'suresh.patel@handyhire.test',
            location: 'Satellite, Ahmedabad, GJ',
            qualification: 'Diploma in Furniture Design, Master Carpenter',
            reviews: [
                { author: 'Irfan Q.',  rating: 5, text: 'Repaired all the door frames before the paint crew arrived.', date: '2 weeks ago' },
                { author: 'Shilpa P.', rating: 4, text: 'Trim work looks excellent.', date: '1 month ago' },
            ],
        },
    };

    /**
     * Build an index from name-derived slug to catalog
     * entry so the page can resolve workers even when
     * a stale or non-canonical slug is provided.
     */
    const BY_SLUG = (function () {
        const map = {};
        Object.keys(WORKER_CATALOG).forEach(function (slug) {
            const entry = WORKER_CATALOG[slug];
            if (entry && entry.name) {
                map[slug] = entry;
                map[makeSlug(entry.name)] = entry;
            }
        });
        return map;
    })();

    /**
     * Read a query-string parameter (e.g. ?worker=…).
     * @param {string} name
     * @returns {string|null}
     */
    function readQueryParam(name) {
        try {
            const params = new URLSearchParams(window.location.search);
            const value = params.get(name);
            return value == null ? null : String(value).trim();
        } catch (e) {
            return null;
        }
    }

    /**
     * Read the selected worker identifier from the URL
     * (?worker=<slug>) first, then fall back to
     * sessionStorage. Returns null when nothing is set.
     * @returns {string|null}
     */
    function readSelectedWorkerSlug() {
        const fromUrl = readQueryParam('worker');
        if (fromUrl) return fromUrl;
        try {
            const fromStorage = sessionStorage.getItem('handyhire.selectedWorkerSlug');
            if (fromStorage) return fromStorage.trim();
        } catch (e) {
            // Ignore storage errors.
        }
        return null;
    }

    /**
     * Read the team-member context stored by
     * provider-team-page.js when the user clicks a
     * member card. Returns null when nothing was set.
     * Provider uses a separate namespace ('provider.')
     * so it doesn't collide with the customer-side
     * 'handyhire.selectedMember' key.
     * @returns {Object|null}
     */
    function readSelectedMember() {
        try {
            const raw = sessionStorage.getItem('handyhire.provider.selectedMember');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (e) {
            return null;
        }
    }

    /** Neutral fallback shown when the slug can't be resolved. */
    const FALLBACK = {
        name: 'Worker not found',
        profession: '--',
        shortDescription: 'Unable to load this professional right now. Please go back and try again.',
        price: '--',
        rating: 0,
        reviewCount: 0,
        experience: '--',
        mobile: '--',
        email: '--',
        location: '--',
        qualification: '--',
        reviews: [],
    };

    /**
     * Resolve the catalog entry for the requested slug.
     * @param {string|null} slug
     * @returns {object}
     */
    function resolveWorker(slug) {
        if (slug && Object.prototype.hasOwnProperty.call(BY_SLUG, slug)) {
            return BY_SLUG[slug];
        }
        return Object.assign({}, FALLBACK);
    }

    /**
     * Build a star-rating string out of full + half stars.
     * @param {number} rating
     * @returns {string}
     */
    function buildStars(rating) {
        const r = Math.max(0, Math.min(5, Number(rating) || 0));
        const full = Math.floor(r);
        const half = (r - full) >= 0.5 ? 1 : 0;
        const empty = 5 - full - half;
        return '\u2605'.repeat(full) + (half ? '\u00BD' : '') + '\u2606'.repeat(empty);
    }

    /**
     * Generate a placeholder avatar data URL from the
     * worker name. Keeps the visual consistent with the
     * Worker Home page cards.
     * @param {string} name
     * @returns {string}
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
     * Services offered per profession - drives the chips
     * rendered into the "Services Offered" section.
     */
    const SERVICES_BY_PROFESSION = {
        'Plumber':      ['Pipe Repair', 'Leak Detection', 'Bathroom Fitting', 'Installation', 'Maintenance'],
        'Electrician':  ['Wiring', 'Switchboard Repair', 'Appliance Installation', 'Safety Audits', 'Lighting Setup'],
        'Carpenter':    ['Furniture Repair', 'Modular Kitchen', 'Custom Woodwork', 'Door Fitting', 'Polishing'],
        'Cleaner':      ['Deep Cleaning', 'Kitchen Cleaning', 'Bathroom Cleaning', 'Post-Move Clean', 'Eco-Friendly Methods'],
        'Painter':      ['Interior Painting', 'Exterior Painting', 'Texture Finish', 'Wall Putty', 'Waterproofing'],
        'AC Repair':    ['AC Installation', 'Gas Refilling', 'Servicing', 'Duct Cleaning', 'Thermostat Repair'],
        'Handyman':     ['Drilling', 'Mounting', 'Furniture Assembly', 'Minor Plumbing', 'Odd Jobs'],
        'Pest Control': ['Termite Control', 'Cockroach Treatment', 'Rodent Control', 'Bed Bug Treatment', 'Eco-Safe Sprays'],
        'Laborer':      ['Site Preparation', 'Material Handling', 'Loading Help', 'Cleanup Support', 'Digging'],
        'Helper':       ['Cleaning Support', 'Supply Restocking', 'Sweeping', 'Mopping', 'Coordination'],
        'Mason':        ['Brickwork', 'Plastering', 'Tile Laying', 'Wall Repair', 'Surface Finishing']
    };

    /**
     * Inline SVG icons for the Quick Info tiles.
     * Kept tiny so they ship inside the controller without
     * any external dependency.
     */
    function infoIcon(name) {
        const icons = {
            occupation:    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3Z"/><path d="M9 12h6"/></svg>',
            experience:    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
            mobile:        '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></svg>',
            email:         '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
            location:      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-7.58 7-13a7 7 0 1 0-14 0c0 5.42 7 13 7 13Z"/><circle cx="12" cy="9" r="2.6"/></svg>',
            qualification: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9 12 4l10 5-10 5L2 9Z"/><path d="M6 11v4c0 2 6 3 6 3s6-1 6-3v-4"/></svg>',
            price:         '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12"/><path d="M6 21h12"/><path d="M8 7c0 2 4 2 4 4s-4 2-4 4"/><path d="m10 8 4 8"/></svg>'
        };
        return icons[name] || '';
    }

    /**
     * Quick Info tile definitions, in display order.
     * Each entry maps to a catalog field, an SVG icon
     * name and a label.
     */
    const QUICK_INFO_FIELDS = [
        { key: 'infoOccupation',    label: 'Occupation',    icon: 'occupation' },
        { key: 'infoExperience',    label: 'Experience',    icon: 'experience' },
        { key: 'infoMobile',        label: 'Mobile Number', icon: 'mobile' },
        { key: 'infoEmail',         label: 'Email',         icon: 'email' },
        { key: 'infoLocation',      label: 'Location',      icon: 'location' },
        { key: 'infoQualification', label: 'Qualification', icon: 'qualification' },
        { key: 'infoPrice',         label: 'Service Price', icon: 'price',     price: true }
    ];

    /**
     * Escape user-supplied text before injecting as HTML.
     * @param {string} str
     * @returns {string}
     */
    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Populate every detail slot on the page with the
     * resolved worker record.
     * @param {object} worker
     */
    function populate(worker) {
        const avatar    = document.getElementById('profileAvatar');
        const nameEl    = document.getElementById('profileName');
        const occEl     = document.getElementById('profileOccupation');
        const bioEl     = document.getElementById('profileBio');
        const heroStars = document.getElementById('heroStars');
        const heroVal   = document.getElementById('heroRatingValue');
        const heroCount = document.getElementById('heroRatingCount');

        const displayName = worker.name || nameEl && nameEl.textContent || '';
        const resolvedName = displayName || 'Professional';

        if (avatar) {
            avatar.style.backgroundImage = buildAvatar(resolvedName);
        }
        if (nameEl) nameEl.textContent = resolvedName;
        if (occEl) occEl.textContent = worker.profession || 'Professional';
        if (bioEl) bioEl.textContent = worker.shortDescription || '';

        if (heroStars) heroStars.textContent = buildStars(worker.rating);
        if (heroVal)   heroVal.textContent = (Number(worker.rating) || 0).toFixed(1);
        if (heroCount) {
            const n = Number(worker.reviewCount) || 0;
            heroCount.textContent = n + (n === 1 ? ' review' : ' reviews');
        }

        document.title = resolvedName + ' | HandyHire';

        try {
            sessionStorage.setItem('handyhire.provider.selectedWorker', resolvedName);
            if (worker.__slug) {
                sessionStorage.setItem('handyhire.selectedWorkerSlug', worker.__slug);
            }
        } catch (e) {
            // Ignore storage errors.
        }
    }

    /**
     * Build the Quick Info tile grid from the worker record.
     * @param {object} worker
     */
    function renderInfoTiles(worker) {
        const grid = document.getElementById('infoGrid');
        if (!grid) return;

        const lookup = {
            infoOccupation:    worker.profession,
            infoExperience:    worker.experience,
            infoMobile:        worker.mobile,
            infoEmail:         worker.email,
            infoLocation:      worker.location,
            infoQualification: worker.qualification,
            infoPrice:         worker.price
        };

        grid.innerHTML = QUICK_INFO_FIELDS.map(function (field) {
            const value = lookup[field.key];
            const display = (value == null || String(value).trim() === '') ? '--' : value;
            const cls = field.price ? ' info-tile is-price' : ' info-tile';

            return (
                '<div class="' + cls.trim() + '">' +
                    '<span class="info-tile-icon" aria-hidden="true">' +
                        infoIcon(field.icon) +
                    '</span>' +
                    '<div class="info-tile-text">' +
                        '<p class="info-tile-label">' + escapeHtml(field.label) + '</p>' +
                        '<p class="info-tile-value">' + escapeHtml(display) + '</p>' +
                    '</div>' +
                '</div>'
            );
        }).join('');
    }

    /**
     * Compose a longer "About Professional" paragraph from
     * the catalog fields so the section feels grounded in
     * real data instead of a hard-coded blurb.
     * @param {object} worker
     * @returns {string}
     */
    function composeAbout(worker) {
        const parts = [];
        const intro = (worker.shortDescription || '').trim();
        if (intro) parts.push(intro);

        const firstName = (worker.name || '').split(' ')[0] || worker.name || 'The professional';
        const experience = worker.experience || 'several years';
        const location = worker.location || 'the surrounding area';

        parts.push(
            firstName + ' brings ' + experience + ' of professional experience to HandyHire customers around ' + location + '. Every job is approached with the same commitment to punctuality, clean work sites, and clear communication from the first quote to the final sign-off.'
        );

        if (worker.qualification) {
            parts.push('Qualification: ' + worker.qualification + '.');
        }

        return parts.filter(Boolean).join(' ');
    }

    /**
     * Render the "Services Offered" pills based on the
     * resolved profession. Falls back to a generic list
     * for professions not present in SERVICES_BY_PROFESSION.
     * @param {object} worker
     */
    function renderServices(worker) {
        const list = document.getElementById('servicesPills');
        if (!list) return;

        const profession = (worker.profession || '').trim();
        const services = SERVICES_BY_PROFESSION[profession] || [
            'Consultation',
            'On-site Visit',
            'Quotation',
            'Service Delivery',
            'After-service Support'
        ];

        list.innerHTML = services.map(function (service) {
            return '<li class="services-pill">' + escapeHtml(service) + '</li>';
        }).join('');
    }

    /**
     * Render / hide the availability strip. Static for now
     * - always "Available today" - but isolated so it can
     * be wired up to real availability data later without
     * touching the rest of the controller.
     */
    function renderAvailability() {
        const strip = document.getElementById('availabilityStrip');
        if (!strip) return;
        strip.hidden = false;
    }

    /**
     * Render the reviews list for the resolved worker.
     * @param {object} worker
     */
    function renderReviews(worker) {
        const list = document.getElementById('reviewsList');
        const empty = document.getElementById('reviewsEmpty');
        const score = document.getElementById('reviewsScore');
        const summaryStars = document.getElementById('reviewsSummaryStars');
        const summaryCount = document.getElementById('reviewsSummaryCount');

        if (score) score.textContent = (Number(worker.rating) || 0).toFixed(1);
        if (summaryStars) summaryStars.textContent = buildStars(worker.rating);

        const reviews = Array.isArray(worker.reviews) ? worker.reviews : [];
        if (summaryCount) {
            const n = Number(worker.reviewCount) || reviews.length;
            summaryCount.textContent = 'Based on ' + n + (n === 1 ? ' review' : ' reviews');
        }

        if (!list) return;

        if (!reviews.length) {
            list.innerHTML = '';
            if (empty) empty.hidden = false;
            return;
        }

        if (empty) empty.hidden = true;

        list.innerHTML = reviews.map(function (review) {
            const stars = buildStars(review.rating);
            const author = String(review.author || 'Customer').replace(/[&<>"]/g, function (c) {
                return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
            });
            const text = String(review.text || '').replace(/[&<>"]/g, function (c) {
                return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
            });
            const date = review.date || '';
            return `
                <li class="review-card">
                    <div class="review-top">
                        <p class="review-author">${author}</p>
                        <span class="review-stars" aria-label="${review.rating} out of 5">${stars}</span>
                    </div>
                    <p class="review-text">${text}</p>
                    <p class="review-date">${date}</p>
                </li>
            `;
        }).join('');
    }

    /**
     * Adjust the Back link (and brand logo) according to
     * how this page was opened:
     *   - source=team         -> Back to Team,
     *                             brand stays provider-home
     *                             (provider-team-page is still a
     *                              back-action rather than primary)
     *   - source=individual   -> Back to Worker Home.
     */
    function initNavigation(context) {
        const back = document.getElementById('backLink');
        if (!back) return;

        if (context && context.source === 'team') {
            const teamName = (context.member && context.member.team) || '';
            back.textContent = teamName ? ('Back to ' + teamName) : 'Back to Team';
            back.setAttribute('href', 'provider-team-page.html');
        } else {
            back.textContent = 'Back to Worker Home';
            try {
                const prev = sessionStorage.getItem('handyhire.provider.previousPage');
                if (prev && prev.trim()) {
                    back.setAttribute('href', prev.trim());
                } else {
                    back.setAttribute('href', 'provider-home.html');
                }
            } catch (e) {
                back.setAttribute('href', 'provider-home.html');
            }
        }
    }

    /**
     * Resolve the final worker record given the URL /
     * sessionStorage inputs. When opened from the team
     * context (source=team) and a team-specific catalog
     * entry exists (e.g. "<team>--<member>"), that entry
     * wins so the displayed profession matches the team.
     * Otherwise the standalone entry is used.
     */
    function resolveFromContext() {
        const source = readQueryParam('source');
        const member = readSelectedMember();
        const urlSlug = readSelectedWorkerSlug();
        const memberSlug = member && member.slug ? member.slug : null;
        const slug = urlSlug || memberSlug;

        let lookupSlug = slug;
        if (source === 'team' && member && member.team && slug) {
            const teamSlug = makeSlug(member.team) + '--' + slug;
            if (Object.prototype.hasOwnProperty.call(WORKER_CATALOG, teamSlug)) {
                lookupSlug = teamSlug;
            }
        }

        const worker = resolveWorker(lookupSlug);
        worker.__slug = lookupSlug || slug || '';
        worker.__context = {
            source: source,
            member: member,
        };
        return {
            worker: worker,
            context: worker.__context,
        };
    }

    /**
     * Initialize the Provider Person Details page.
     */
    function init() {
        const resolved = resolveFromContext();
        const worker = resolved.worker;

        populate(worker);
        renderInfoTiles(worker);
        renderServices(worker);
        renderAvailability();

        const aboutEl = document.getElementById('aboutText');
        if (aboutEl) aboutEl.textContent = composeAbout(worker);

        renderReviews(worker);
        initNavigation(resolved.context);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
