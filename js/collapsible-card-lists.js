/* =========================================================
   HandyHire - Shared View All / View Less card lists
   Keeps long Activity and Package feeds compact by default.
   ========================================================= */

(function () {
    'use strict';

    var DEFAULT_LIMIT = 4;

    var configs = [
        {
            selector: '#activityFeed',
            type: 'activity',
            limit: DEFAULT_LIMIT
        },
        {
            selector: '#packageList',
            type: 'packages',
            limit: DEFAULT_LIMIT
        }
    ];

    function injectStyles() {
        if (document.getElementById('hhCollapsibleListStyles')) return;

        var style = document.createElement('style');
        style.id = 'hhCollapsibleListStyles';
        style.textContent = [
            '#activityFeed .booking-card[hidden],#activityFeed .section-group[hidden],#packageList>li[hidden]{display:none!important;}',
            '.hh-list-toggle-wrap{display:flex;justify-content:center;padding:20px 0 4px;}',
            '.hh-list-toggle{min-width:148px;min-height:44px;padding:0 20px;border:1px solid rgba(23,63,43,.16);border-radius:999px;background:#fff;color:#173f2b;font:inherit;font-size:12px;font-weight:800;letter-spacing:.01em;cursor:pointer;box-shadow:0 7px 18px rgba(18,53,35,.07);transition:transform .2s ease,box-shadow .2s ease,background .2s ease,border-color .2s ease;}',
            '.hh-list-toggle:hover{transform:translateY(-2px);background:#f1f7f1;border-color:rgba(23,63,43,.28);box-shadow:0 10px 24px rgba(18,53,35,.11);}',
            '.hh-list-toggle:focus-visible{outline:3px solid rgba(77,133,95,.22);outline-offset:3px;}',
            '.hh-list-toggle[hidden],.hh-list-toggle-wrap[hidden]{display:none!important;}',
            '@media(max-width:760px){.hh-list-toggle-wrap{padding:16px 0 2px}.hh-list-toggle{min-height:42px;min-width:138px;font-size:11px}}'
        ].join('');

        document.head.appendChild(style);
    }

    function getItems(target, type) {
        if (type === 'activity') {
            return Array.prototype.slice.call(
                target.querySelectorAll('.booking-card')
            );
        }

        return Array.prototype.slice.call(target.children).filter(function (child) {
            return child && child.tagName === 'LI';
        });
    }

    function syncActivitySections(target) {
        var sections = target.querySelectorAll('.section-group');

        Array.prototype.forEach.call(sections, function (section) {
            var cards = section.querySelectorAll('.booking-card');
            var hasVisibleCard = Array.prototype.some.call(cards, function (card) {
                return !card.hidden;
            });

            section.hidden = !hasVisibleCard;
        });
    }

    function createController(config) {
        var target = document.querySelector(config.selector);
        if (!target) return;

        var expanded = false;
        var renderScheduled = false;

        var wrapper = document.createElement('div');
        wrapper.className = 'hh-list-toggle-wrap';
        wrapper.hidden = true;

        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'hh-list-toggle';
        button.setAttribute('aria-expanded', 'false');
        wrapper.appendChild(button);

        target.parentNode.insertBefore(wrapper, target.nextSibling);

        function apply(resetExpanded) {
            if (resetExpanded) {
                expanded = false;
            }

            var items = getItems(target, config.type);
            var total = items.length;
            var limit = Number(config.limit) || DEFAULT_LIMIT;
            var shouldCollapse = total > limit;

            items.forEach(function (item, index) {
                item.hidden = shouldCollapse && !expanded && index >= limit;
            });

            if (config.type === 'activity') {
                syncActivitySections(target);
            }

            if (!shouldCollapse) {
                wrapper.hidden = true;
                button.setAttribute('aria-expanded', 'false');
                return;
            }

            wrapper.hidden = false;
            button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            button.textContent = expanded
                ? 'View Less'
                : 'View All (' + total + ')';
        }

        function scheduleApply(resetExpanded) {
            if (renderScheduled) return;
            renderScheduled = true;

            window.requestAnimationFrame(function () {
                renderScheduled = false;
                apply(resetExpanded);
            });
        }

        button.addEventListener('click', function () {
            expanded = !expanded;
            apply(false);

            if (!expanded) {
                var top = target.getBoundingClientRect().top + window.pageYOffset - 120;
                if (window.pageYOffset > top) {
                    window.scrollTo({
                        top: Math.max(0, top),
                        behavior: 'smooth'
                    });
                }
            }
        });

        var observer = new MutationObserver(function (mutations) {
            var hasListChange = mutations.some(function (mutation) {
                return mutation.type === 'childList';
            });

            if (hasListChange) {
                scheduleApply(true);
            }
        });

        observer.observe(target, {
            childList: true,
            subtree: true
        });

        apply(true);
    }

    function init() {
        injectStyles();
        configs.forEach(createController);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
