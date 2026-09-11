/* =========================================================
   HandyHire - Job Hire (Worker Details) JavaScript
   Receives the selected worker via ?worker=<slug> or
   sessionStorage and populates the page with the
   matching record from a central worker catalog so
   the displayed name, occupation, rating, price and
   reviews always match the clicked card.
   ========================================================= */

(function () {
    'use strict';

    /**
     * Convert a worker name into a URL-safe slug.
     * Kept in sync with the slug generation in the
     * customer home JS files (home*.js).
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
     * Escape user-supplied text before injecting as HTML.
     * @param {string} str
     * @returns {string}
     */
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Central worker catalog. This is the single source
     * of truth for what the customer-side worker details
     * page can display. The worker cards on the home
     * variants carry a slug that matches the `slug`
     * derived from each `name` here.
     *
     * Review objects are:
     *   { author: string, rating: number(1-5), text: string, date: string }
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
                { author: 'Anika S.',    rating: 5, text: 'Came on time, fixed the leak in under an hour. Very polite and professional.', date: '2 weeks ago' },
                { author: 'Manoj P.',    rating: 5, text: 'Reasonable price, clean work. Bathroom fittings look perfect.', date: '1 month ago' },
                { author: 'Sneha R.',    rating: 4, text: 'Good work, slight delay in arrival but worth the wait.', date: '2 months ago' },
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
                { author: 'Rohit K.',    rating: 5, text: 'Excellent. Diagnosed the issue quickly and explained the fix clearly.', date: '1 week ago' },
                { author: 'Pooja M.',    rating: 5, text: 'Switchboard rewiring done perfectly. Tidied up after the job.', date: '3 weeks ago' },
                { author: 'Vivek J.',    rating: 4, text: 'Knowledgeable and courteous. Slightly pricy but worth it.', date: '1 month ago' },
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
                { author: 'Neha T.',     rating: 5, text: 'Beautiful wardrobe repair. Looks brand new again.', date: '5 days ago' },
                { author: 'Imran A.',    rating: 4, text: 'Custom shelving done well. Finished on time.', date: '3 weeks ago' },
                { author: 'Kavita D.',   rating: 4, text: 'Polite and skilled. Charges are fair for the quality.', date: '2 months ago' },
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
                { author: 'Aarti V.',    rating: 5, text: 'Best deep clean I have had. Every corner was spotless.', date: '1 week ago' },
                { author: 'Karan B.',    rating: 5, text: 'On time, well-equipped and very respectful of belongings.', date: '2 weeks ago' },
                { author: 'Meera N.',    rating: 5, text: 'Kitchen looks factory-fresh. Will book again.', date: '1 month ago' },
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
                { author: 'Suvro G.',    rating: 5, text: 'Wall finish is buttery smooth. Masking was perfect.', date: '2 weeks ago' },
                { author: 'Rina D.',     rating: 4, text: 'Lovely colour match, completed a day late.', date: '1 month ago' },
                { author: 'Aditya S.',   rating: 4, text: 'Good prep work, took time but quality is there.', date: '6 weeks ago' },
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
                { author: 'Rakesh M.',   rating: 5, text: 'Cooling restored in 30 minutes. Gas refill done right.', date: '4 days ago' },
                { author: 'Tanya P.',    rating: 5, text: 'Annual service was thorough. Filters cleaned perfectly.', date: '3 weeks ago' },
                { author: 'Sahil Q.',    rating: 4, text: 'On-time and knowledgeable. Reasonable price.', date: '1 month ago' },
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
                { author: 'Hitesh J.',   rating: 5, text: 'Mounted three TVs and a shelf in under an hour. Perfect.', date: '1 week ago' },
                { author: 'Rupal S.',    rating: 4, text: 'Handy and quick. Did a great job with the assembly.', date: '3 weeks ago' },
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
                { author: 'Devika R.',   rating: 5, text: 'Commercial AC install done flawlessly.', date: '2 weeks ago' },
                { author: 'Nikhil T.',   rating: 4, text: 'Professional and thorough. Highly recommended.', date: '1 month ago' },
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

        // -------- Team-member-only entries --------
        // Members that only ever appear inside a team
        // (no standalone catalog record on the customer
        // home cards) get their own entries here.
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
                { author: 'Sana R.',  rating: 5, text: 'Hardworking and on time. Made the whole day easier.', date: '2 weeks ago' },
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
                { author: 'Ravi S.',  rating: 5, text: 'Quick and thorough. Floors look new.', date: '3 weeks ago' },
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
                { author: 'Irfan M.',  rating: 5, text: 'Painted, cleaned and tidied in one visit.', date: '1 week ago' },
                { author: 'Lata D.',   rating: 4, text: 'Helpful and on time.', date: '1 month ago' },
            ],
        },

        // -------- Team-context profession overrides --------
        // A name like "Anita Sharma" already exists as a
        // standalone Electrician on the home cards. When
        // she appears inside a specific team with a
        // different role (e.g. Carpenter in BuildRight),
        // we expose a separate slug <team>--<member>
        // pointing at this entry so the team Page can
        // resolve her correct team-context profession.
        'buildright-crew--anita-sharma': {
            name: 'Anita Sharma',
            profession: 'Carpenter',
            shortDescription: 'Carpenter on the BuildRight Crew â€” furniture fitout, door frames and on-site carpentry.',
            price: '\u20B9399',
            rating: 4.6,
            reviewCount: 38,
            experience: '7 years',
            mobile: '+91 99812 44567',
            email: 'anita.sharma@handyhire.test',
            location: 'Karol Bagh, New Delhi',
            qualification: 'Diploma in Furniture Design, Master Carpenter',
            reviews: [
                { author: 'Soham P.',  rating: 5, text: 'Custom door frame fitted perfectly.', date: '2 weeks ago' },
                { author: 'Rhea K.',   rating: 4, text: 'Clean finish, polite worker.', date: '1 month ago' },
            ],
        },
        'buildright-crew--suresh-patel': {
            name: 'Suresh Patel',
            profession: 'Electrician',
            shortDescription: 'Electrician on the BuildRight Crew â€” wiring, distribution boards and site power.',
            price: '\u20B9399',
            rating: 4.6,
            reviewCount: 36,
            experience: '12 years',
            mobile: '+91 90909 77881',
            email: 'suresh.patel@handyhire.test',
            location: 'Satellite, Ahmedabad, GJ',
            qualification: 'Diploma in Electrical Engineering, Licensed Wireman',
            reviews: [
                { author: 'Vivek N.',  rating: 5, text: 'Distribution board wired cleanly and tested.', date: '2 weeks ago' },
                { author: 'Karan M.',  rating: 4, text: 'On time, professional finish.', date: '1 month ago' },
            ],
        },
        'buildright-crew--mohan-das': {
            name: 'Mohan Das',
            profession: 'Mason',
            shortDescription: 'Mason on the BuildRight Crew â€” brickwork, plastering and surface finishing.',
            price: '\u20B9459',
            rating: 4.6,
            reviewCount: 33,
            experience: '10 years',
            mobile: '+91 97321 66554',
            email: 'mohan.das@handyhire.test',
            location: 'Salt Lake, Kolkata, WB',
            qualification: 'Certified Mason & Plastering Contractor',
            reviews: [
                { author: 'Nitin P.',  rating: 5, text: 'Brickwork is straight and clean. Excellent plaster finish.', date: '1 week ago' },
                { author: 'Asha R.',   rating: 4, text: 'Good preparation, finished on schedule.', date: '1 month ago' },
            ],
        },
        'home-renovation-team--ravi-kumar': {
            name: 'Ravi Kumar',
            profession: 'Carpenter',
            shortDescription: 'Carpenter on the Home Renovation Team â€” built-ins, wardrobes and finish carpentry.',
            price: '\u20B9299',
            rating: 4.8,
            reviewCount: 51,
            experience: '8 years',
            mobile: '+91 98456 11223',
            email: 'ravi.kumar@handyhire.test',
            location: 'Sector 18, Noida, UP',
            qualification: 'ITI in Plumbing (also trained in Carpentry)',
            reviews: [
                { author: 'Tara S.',  rating: 5, text: 'Beautiful built-in wardrobe. Very neat joints.', date: '2 weeks ago' },
                { author: 'Manu J.',  rating: 5, text: 'Finish carpentry done with great attention to detail.', date: '1 month ago' },
            ],
        },
        'home-renovation-team--priya-singh': {
            name: 'Priya Singh',
            profession: 'Painter',
            shortDescription: 'Painter on the Home Renovation Team â€” interior repaints and accent walls.',
            price: '\u20B9249',
            rating: 4.9,
            reviewCount: 47,
            experience: '5 years',
            mobile: '+91 98102 33445',
            email: 'priya.singh@handyhire.test',
            location: 'Bandra West, Mumbai, MH',
            qualification: 'Certified Painting Contractor',
            reviews: [
                { author: 'Aditya G.', rating: 5, text: 'Accent wall turned out beautifully. No mess.', date: '1 week ago' },
                { author: 'Pallavi R.', rating: 5, text: 'Crisp edges and even coats.', date: '1 month ago' },
            ],
        },
        'home-renovation-team--lata-verma': {
            name: 'Lata Verma',
            profession: 'Electrician',
            shortDescription: 'Electrician on the Home Renovation Team â€” switchboard rewiring and lighting installs.',
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
            shortDescription: 'Plumber on the FixIt Squad â€” leaks, fittings and emergency repairs.',
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
            shortDescription: 'Electrician on the FixIt Squad â€” quick diagnostics and household repairs.',
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
        'powergrid-unit--arjun-mehta': {
            name: 'Arjun Mehta',
            profession: 'Helper',
            shortDescription: 'Helper on the PowerGrid Unit â€” assists the lead electrician with cable runs, mounting and cleanup.',
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
        'powergrid-unit--anita-sharma': {
            name: 'Anita Sharma',
            profession: 'Electrician',
            shortDescription: 'Electrician on the PowerGrid Unit â€” mainline wiring, distribution boards and safety audits.',
            price: '\u20B9349',
            rating: 4.7,
            reviewCount: 64,
            experience: '6 years',
            mobile: '+91 99812 44567',
            email: 'anita.sharma@handyhire.test',
            location: 'Karol Bagh, New Delhi',
            qualification: 'Diploma in Electrical Engineering, Licensed Wireman',
            reviews: [
                { author: 'Sahil T.', rating: 5, text: 'Safety audit was thorough. Honest reports.', date: '2 weeks ago' },
                { author: 'Poonam S.', rating: 4, text: 'Mainline rewire done without disruption.', date: '1 month ago' },
            ],
        },
        'freshpaint-crew--mohan-das': {
            name: 'Mohan Das',
            profession: 'Painter',
            shortDescription: 'Painter on the FreshPaint Crew â€” interior and exterior finishes.',
            price: '\u20B9459',
            rating: 4.5,
            reviewCount: 64,
            experience: '10 years',
            mobile: '+91 97321 66554',
            email: 'mohan.das@handyhire.test',
            location: 'Salt Lake, Kolkata, WB',
            qualification: 'Certified Painting Contractor, Industrial Painter',
            reviews: [
                { author: 'Suvro G.', rating: 5, text: 'Wall finish is buttery smooth.', date: '2 weeks ago' },
                { author: 'Aditya S.', rating: 4, text: 'Good prep work, finished on time.', date: '6 weeks ago' },
            ],
        },
        'freshpaint-crew--suresh-patel': {
            name: 'Suresh Patel',
            profession: 'Carpenter',
            shortDescription: 'Carpenter on the FreshPaint Crew â€” pre-paint repairs, doors and trim.',
            price: '\u20B9399',
            rating: 4.6,
            reviewCount: 31,
            experience: '12 years',
            mobile: '+91 90909 77881',
            email: 'suresh.patel@handyhire.test',
            location: 'Satellite, Ahmedabad, GJ',
            qualification: 'Diploma in Furniture Design, Master Carpenter',
            reviews: [
                { author: 'Irfan Q.', rating: 5, text: 'Repaired all the door frames before the paint crew arrived.', date: '2 weeks ago' },
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
     * Fetched services from the backend.
     */
    let allServices = [];

    /**
     * Fetch all services from the backend.
     * @returns {Promise<Array>}
     */
    async function loadServices() {
        if (!(window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function')) {
            return [];
        }
        try {
            const resp = await window.HandyHireAPI.apiFetch('/api/services');
            if (!resp.ok) return [];
            const data = await resp.json();
            allServices = Array.isArray(data) ? data : [];
        } catch (e) {
            allServices = [];
        }
        return allServices;
    }

    /**
     * Quick-info field definitions for the 2-column grid.
     */
    const INFO_ITEMS = [
        { key: 'profession',   label: 'Occupation',   icon: '&#128188;' },
        { key: 'experience',   label: 'Experience',   icon: '&#128188;' },
        { key: 'availability', label: 'Availability', icon: '&#9200;' },
        { key: 'location',     label: 'Location',     icon: '&#127968;' },
        { key: 'qualification',label: 'Qualification',icon: '&#127891;' },
        { key: 'price',        label: 'Service Price',icon: '&#128176;' },
    ];

    /**
     * Read a query-string parameter (e.g. ?source=team).
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
     * Read the real backend worker ID from the URL
     * (?worker_id=<id>) first, then sessionStorage.
     * Returns null when nothing is set.
     * @returns {string|null}
     */
    function readWorkerId() {
        const fromUrl = readQueryParam('worker_id');
        if (fromUrl) return fromUrl;
        try {
            const fromStorage = sessionStorage.getItem('handyhire.selectedWorkerId');
            if (fromStorage) return fromStorage.trim();
        } catch (e) {
            // Ignore storage errors.
        }
        return null;
    }

    /**
     * Read context metadata stored by the Team Page
     * (handyhire.selectedMember) so the details page can
     * show the team-context occupation for the same worker.
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
     * Look up the worker record from the central catalog.
     * Falls back to a friendly placeholder so the page
     * never displays another worker's details.
     * @param {string|null} slug
     * @returns {object}
     */
    function resolveWorker(slug) {
        if (slug && Object.prototype.hasOwnProperty.call(BY_SLUG, slug)) {
            return BY_SLUG[slug];
        }
        return {
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
     * home-page cards.
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
     * Populate every hero detail slot on the page with the
     * resolved worker record.
     * @param {object} worker
     */
    function populate(worker) {
        const avatar = document.getElementById('heroAvatar');
        const nameEl = document.getElementById('heroName');
        const occEl = document.getElementById('heroProfession');
        const bioEl = document.getElementById('heroBio');
        const ratingVal = document.getElementById('heroRatingValue');
        const ratingStars = document.getElementById('heroStars');
        const ratingCount = document.getElementById('heroRatingCount');

        if (avatar && nameEl) {
            if (worker.profile_image) {
                avatar.style.backgroundImage = 'url("' + worker.profile_image + '")';
            } else {
                avatar.style.backgroundImage = buildAvatar(nameEl.textContent || worker.name);
            }
        }
        if (nameEl) nameEl.textContent = worker.name;
        if (occEl) occEl.textContent = worker.profession;
        if (bioEl) bioEl.textContent = worker.shortDescription || '';

        if (ratingVal) ratingVal.textContent = (Number(worker.rating) || 0).toFixed(1);
        if (ratingStars) ratingStars.textContent = buildStars(worker.rating);
        if (ratingCount) {
            const n = Number(worker.reviewCount) || 0;
            ratingCount.textContent = n + (n === 1 ? ' review' : ' reviews');
        }

        // Document title reflects the chosen worker.
        document.title = worker.name + ' | HandyHire';

        // Persist the resolved name + ID + slug so other tabs
        // (booking, activity) can use it consistently.
        try {
            sessionStorage.setItem('handyhire.selectedWorker', worker.name);
            if (worker.__workerId) {
                sessionStorage.setItem('handyhire.selectedWorkerId', worker.__workerId);
            }
            if (worker.__slug) {
                sessionStorage.setItem('handyhire.selectedWorkerSlug', worker.__slug);
            }
        } catch (e) {
            // Ignore storage errors.
        }
    }

    /**
     * Render the availability strip for the resolved worker.
     * @param {object} worker
     */
    function renderAvailability(worker) {
        const text = document.getElementById('availabilityText');
        if (text) {
            text.textContent = worker.availability && worker.availability !== '--'
                ? worker.availability
                : 'Available today';
        }
    }

    /**
     * Render the Quick Info 2-column grid for the resolved worker.
     * @param {object} worker
     */
    function renderInfoGrid(worker) {
        const grid = document.getElementById('infoGrid');
        if (!grid) return;

        grid.innerHTML = INFO_ITEMS.map(function (item) {
            const value = worker[item.key] || '--';
            return '<li class="info-card">' +
                '<span class="info-card-icon" aria-hidden="true">' + item.icon + '</span>' +
                '<div class="info-card-text">' +
                    '<p class="info-card-label">' + escapeHtml(item.label) + '</p>' +
                    '<p class="info-card-value">' + escapeHtml(String(value)) + '</p>' +
                '</div>' +
            '</li>';
        }).join('');
    }

    /**
     * Compose the About Professional paragraph from the
     * resolved worker's catalog data.
     * @param {object} worker
     */
    function composeAbout(worker) {
        const aboutEl = document.getElementById('aboutText');
        if (!aboutEl) return;

        const name = worker.name || 'This professional';
        const experience = worker.experience || '';
        const location = worker.location || '';
        const desc = worker.shortDescription || '';

        let text = desc;
        if (experience) {
            text += ' ' + name + ' brings ' + experience + ' of professional experience.';
        }
        if (location) {
            text += ' Based in ' + location + '.';
        }
        aboutEl.textContent = text.trim() || 'Professional details will appear here.';
    }

    /**
     * Render the Services Offered pills for the resolved
     * worker from the fetched backend services list.
     * @param {object} worker
     */
    function renderServices(worker) {
        const list = document.getElementById('servicesPills');
        if (!list) return;

        if (!allServices.length) {
            list.innerHTML = '<li class="service-pill" style="opacity:0.6;">No services available.</li>';
            return;
        }

        list.innerHTML = allServices.map(function (s) {
            return '<li class="service-pill">' + escapeHtml(s.name || '') + '</li>';
        }).join('');
    }

    /**
     * Render the worker's portfolio (previous work) photos.
     * Photos are read-only for the customer: no upload/delete controls.
     * @param {Array} photos  array of { id, image_url, created_at }
     */
    function renderPortfolio(photos) {
        const grid = document.getElementById('portfolioGrid');
        const empty = document.getElementById('portfolioEmpty');
        if (!grid) return;

        const items = Array.isArray(photos) ? photos : [];
        if (!items.length) {
            grid.innerHTML = '';
            if (empty) empty.hidden = false;
            return;
        }

        if (empty) empty.hidden = true;
        grid.innerHTML = items.map(function (photo) {
            const url = String(photo.image_url || '').replace(/["\\]/g, '');
            return '<li class="portfolio-photo">' +
                '<img src="' + url + '" alt="Previous work photo" loading="lazy" />' +
            '</li>';
        }).join('');
    }

    /**
     * Load a worker's public portfolio from the backend and render it.
     * Fails soft (empty grid) so the details page still works.
     * @param {string|number} workerId
     */
    function loadPortfolio(workerId) {
        if (!workerId) {
            renderPortfolio([]);
            return;
        }
        getApi().apiFetch('/api/workers/' + encodeURIComponent(String(workerId)) + '/work-photos')
            .then(function (response) {
                if (!response.ok) return [];
                return response.json();
            })
            .then(function (photos) {
                renderPortfolio(photos);
            })
            .catch(function () {
                renderPortfolio([]);
            });
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
            const author = review.author || 'Customer';
            const text = review.text || '';
            const date = review.date || '';
            const safeText = String(text).replace(/[&<>"]/g, function (c) {
                return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
            });
            const safeAuthor = String(author).replace(/[&<>"]/g, function (c) {
                return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
            });
            return `
                <li class="review-card">
                    <div class="review-top">
                        <p class="review-author">${safeAuthor}</p>
                        <span class="review-stars" aria-label="${review.rating} out of 5">${stars}</span>
                    </div>
                    <p class="review-text">${safeText}</p>
                    <p class="review-date">${date}</p>
                </li>
            `;
        }).join('');
    }

    /**
     * Wire up the Book Now CTA so it carries the
     * selected worker to the booking page. The button
     * is hidden entirely when this view was opened
     * from the Team Page (source=team) since member
     * inspection is view-only.
     */
    function initBookNow(context) {
        const btn = document.getElementById('bookNowBtn');
        if (!btn) return;

        if (context && context.source === 'team') {
            btn.hidden = true;
            btn.setAttribute('aria-hidden', 'true');
            btn.tabIndex = -1;
            return;
        }

        btn.addEventListener('click', function () {
            try {
                const workerId = sessionStorage.getItem('handyhire.selectedWorkerId');
                const slug = sessionStorage.getItem('handyhire.selectedWorkerSlug');
                if (workerId) {
                    window.location.href = 'booking.html?worker_id=' + encodeURIComponent(workerId);
                    return;
                }
                if (slug) {
                    window.location.href = 'booking.html?worker=' + encodeURIComponent(slug);
                    return;
                }
            } catch (e) {
                // Ignore storage errors and fall back below.
            }
            window.location.href = 'booking.html';
        });
    }

    /**
     * Adjust navigation for view-only Team Page openings
     * AND set up the general back button for the individual
     * flow.
     */
    function initNavigation(context) {
        const backLink = document.getElementById('backLink');
        const backToTeamBtn = document.getElementById('backToTeamBtn');
        const isTeam = context && context.source === 'team';

        if (isTeam) {
            if (backLink) backLink.hidden = true;
            if (backToTeamBtn) backToTeamBtn.hidden = false;
        } else {
            if (backLink) backLink.hidden = false;
            if (backToTeamBtn) backToTeamBtn.hidden = true;
        }

        const brand = document.querySelector('.hire-topbar .brand-mark');
        if (brand) {
            brand.setAttribute('href', isTeam ? 'team-page.html' : 'home.html');
        }

        if (isTeam && backToTeamBtn) {
            const teamName = (context.member && context.member.team) || '';
            const label = teamName
                ? 'Back to ' + teamName
                : 'Back to Team';
            backToTeamBtn.textContent = label;
            backToTeamBtn.setAttribute('aria-label', label);
            backToTeamBtn.addEventListener('click', function (event) {
                event.preventDefault();
                window.location.href = 'team-page.html';
            });
        }
    }

    /**
     * Set the Back button href from sessionStorage so it
     * returns to the exact previous customer home / filter
     * page rather than a hardcoded fallback, and wire up
     * an explicit click handler so navigation always fires.
     */
    function initBackButton() {
        const back = document.getElementById('backLink');
        if (!back || back.hidden) return;
        try {
            const prev = sessionStorage.getItem('handyhire.customer.previousPage');
            if (prev && prev.trim()) {
                back.setAttribute('href', prev.trim());
            }
        } catch (e) {
            // Keep the HTML fallback.
        }
        back.addEventListener('click', function (event) {
            event.preventDefault();
            const href = back.getAttribute('href');
            if (href) {
                window.location.href = href;
            }
        });
    }

    /**
     * Resolve the final worker record given the URL /
     * sessionStorage inputs. When opened from the team
     * context (source=team) and a team-specific catalog
     * entry exists (e.g. "<team>--<slug>"), that entry
     * wins so the displayed profession matches the team.
     * Otherwise the standalone entry is used.
     */
    function resolveFromContext() {
        const source = readQueryParam('source');
        const member = readSelectedMember();
        const urlSlug = readSelectedWorkerSlug();
        const memberSlug = member && member.slug ? member.slug : null;
        const slug = urlSlug || memberSlug;

        // Prefer team-context slug when present.
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
        return { worker: worker, context: worker.__context };
    }

    /**
     * Resolve the API helper (js/api.js) with a safe fallback.
     */
    function getApi() {
        if (window.HandyHireAPI && typeof window.HandyHireAPI.apiFetch === 'function') {
            return window.HandyHireAPI;
        }
        return {
            API_BASE_URL: 'http://127.0.0.1:8000',
            apiFetch: function (path) {
                return fetch('http://127.0.0.1:8000' + path).catch(function () {
                    return {
                        ok: false,
                        status: 0,
                        json: function () {
                            return Promise.resolve({
                                detail: 'Unable to connect to HandyHire server. Please make sure the backend is running.',
                            });
                        },
                    };
                });
            },
        };
    }

    /**
     * Fetch a single worker from the backend by database ID.
     * @param {string|number} workerId
     * @returns {Promise<Object>}
     */
    function fetchWorkerById(workerId) {
        return getApi().apiFetch('/api/workers/' + encodeURIComponent(String(workerId)))
            .then(function (response) {
                if (!response.ok) throw new Error('Worker not found');
                return response.json();
            });
    }

    /**
     * Fetch the worker's reviews from the backend. Fails soft
     * (returns []) so review problems never break the page.
     * @param {string|number} workerId
     * @returns {Promise<Array>}
     */
    function fetchWorkerReviews(workerId) {
        return getApi().apiFetch('/api/reviews/workers/' + encodeURIComponent(String(workerId)))
            .then(function (response) {
                if (!response.ok) return [];
                return response.json();
            })
            .catch(function () { return []; });
    }

    /**
     * Map a backend WorkerResponse + ReviewResponse[] into the
     * exact shape the existing render functions expect.
     * Never fabricates contact info the public API withholds.
     * @param {Object} w   backend WorkerResponse
     * @param {Array} reviews   backend ReviewResponse[]
     * @returns {Object}  UI worker-shaped object
     */
    function mapApiWorkerToUi(w, reviews) {
        const name = w.full_name || w.name || 'Worker';
        const slug = makeSlug(name);
        const price = w.price != null && Number(w.price) > 0
            ? '\u20B9' + Number(w.price)
            : '--';

        return {
            name: name,
            profession: w.profession || '--',
            shortDescription: w.bio || '',
            price: price,
            rating: Number(w.average_rating) || 0,
            reviewCount: Number(w.review_count) || 0,
            experience: w.experience || '--',
            mobile: w.mobile_number || w.mobile || '--',
            email: w.email || '--',
            location: w.location || '--',
            qualification: w.qualification || '--',
            availability: w.availability || null,
            profile_image: w.profile_image || null,
            reviews: (Array.isArray(reviews) ? reviews : []).map(function (r) {
                return {
                    author: r.customer_name || 'Customer',
                    rating: Number(r.rating) || 0,
                    text: r.comment || '',
                    date: formatReviewDate(r.created_at),
                };
            }),
            __slug: slug,
            __workerId: w.id != null ? String(w.id) : null,
        };
    }

    /**
     * Turn an ISO review date into a short readable label. When
     * the value is missing/unparseable, returns ''. Uses only the
     * real backend timestamp - never invents a date.
     * @param {string|null|undefined} iso
     * @returns {string}
     */
    function formatReviewDate(iso) {
        if (!iso) return '';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return months[d.getMonth()] + ' ' + d.getFullYear();
        } catch (e) {
            return iso;
        }
    }

    /**
     * Initialize the Job Hire (worker details) page.
     * Tries the backend by real worker ID first; falls back to
     * the existing slug/catalog resolution only when no ID is
     * available (e.g. team-member deep links) or the fetch fails.
     */
    function init() {
        if (!(window.HandyHireAPI && window.HandyHireAPI.requireRole('customer'))) return;

        // Show a loading state in the services area while we
        // fetch the global services catalog from the backend.
        const servicesList = document.getElementById('servicesPills');
        if (servicesList) {
            servicesList.innerHTML = '<li class="service-pill" style="opacity:0.6;">Loading services...</li>';
        }

        // Preload services so renderServices() can use them
        // regardless of which worker resolution path succeeds.
        Promise.resolve(loadServices()).then(function () {
            const workerId = readWorkerId();

            if (workerId) {
                renderEmptyState('Loading professional...');
                return Promise.all([fetchWorkerById(workerId), fetchWorkerReviews(workerId)])
                    .then(function (results) {
                        const worker = mapApiWorkerToUi(results[0], results[1]);
                        worker.__context = { source: readQueryParam('source'), member: readSelectedMember() };
                        renderAll(worker);
                        loadPortfolio(workerId);
                    })
                    .catch(function () {
                        // Backend unavailable or worker not found: fall back to
                        // slug/catalog resolution for team deep links.
                        const resolved = resolveFromContext();
                        renderAll(resolved.worker);
                        loadPortfolio(workerId);
                    });
            }

            const resolved = resolveFromContext();
            renderAll(resolved.worker);
            if (resolved.worker && resolved.worker.__workerId) {
                loadPortfolio(resolved.worker.__workerId);
            } else {
                renderPortfolio([]);
            }
        });
    }

    /**
     * Show a lightweight loading message in the hero area until
     * the backend responds.
     */
    function renderEmptyState() {
        const nameEl = document.getElementById('heroName');
        const occEl = document.getElementById('heroProfession');
        const bioEl = document.getElementById('heroBio');
        if (nameEl) nameEl.textContent = 'Loading...';
        if (occEl) occEl.textContent = 'Please wait';
        if (bioEl) bioEl.textContent = 'Fetching this professional\u2019s details from the database.';
        const grid = document.getElementById('infoGrid');
        if (grid) grid.innerHTML = '';
        const list = document.getElementById('reviewsList');
        if (list) list.innerHTML = '';
    }

    /**
     * Render every section from a resolved worker object.
     * @param {Object} worker
     */
    function renderAll(worker) {
        populate(worker);
        renderAvailability(worker);
        renderInfoGrid(worker);
        composeAbout(worker);
        renderServices(worker);
        renderReviews(worker);
        initBookNow(worker.__context || null);
        initNavigation(worker.__context || null);
        initBackButton();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
