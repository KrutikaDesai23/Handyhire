(function () {
    "use strict";

    var allWorkers = [];
    var currentFilter = "all";
    var currentSearch = "";
    var currentSort = "";
    var availabilitySaving = false;
    var lastKnownAvailability = "";

    var DISPLAY_LIMIT = 4;
    var displayList = [];
    var isExpanded = false;

    function requireAuth() {
        var api = window.HandyHireAPI;

        if (!api) {
            window.location.href = "login.html";
            return false;
        }

        if (
            typeof api.isLoggedIn === "function" &&
            !api.isLoggedIn()
        ) {
            window.location.href = "login.html";
            return false;
        }

        return true;
    }

    function showMessage(message) {
        var grid = document.getElementById("serviceGrid");

        if (!grid) {
            return;
        }

        grid.innerHTML = "";

        var paragraph = document.createElement("p");
        paragraph.className = "empty-state";
        paragraph.textContent = message;
        paragraph.style.gridColumn = "1 / -1";
        paragraph.style.textAlign = "center";
        paragraph.style.padding = "32px 0";

        grid.appendChild(paragraph);
    }

    function getInitials(name) {
        return String(name || "Worker")
            .trim()
            .split(" ")
            .filter(Boolean)
            .map(function (part) {
                return part.charAt(0).toUpperCase();
            })
            .slice(0, 2)
            .join("");
    }

    function normalizeAvailability(value) {
        var availability = String(value || "")
            .toLowerCase()
            .trim()
            .replace(/_/g, "-")
            .replace(/\s+/g, "-");

        if (availability === "prebooking") {
            return "pre-booking";
        }

        if (availability === "onspot") {
            return "on-spot";
        }

        return availability;
    }

    function normalizeWorker(record) {
        var item = record || {};
        var profile =
            item["worker_profile"] ||
            item["profile"] ||
            {};

        var user =
            item["user"] ||
            profile["user"] ||
            {};

        return {
            id:
                item["id"] ||
                item["worker_id"] ||
                profile["worker_id"] ||
                user["id"] ||
                "",

            fullName:
                item["full_name"] ||
                profile["full_name"] ||
                user["full_name"] ||
                user["name"] ||
                "Worker",

            profession:
                item["profession"] ||
                profile["profession"] ||
                item["service"] ||
                "Professional",

            location:
                item["location"] ||
                profile["location"] ||
                "Location not specified",

            price:
                item["price"] != null
                    ? item["price"]
                    : profile["price"],

            availability:
                item["availability"] ||
                profile["availability"] ||
                item["booking_type"] ||
                item["service_type"] ||
                "",

            rating:
                item["average_rating"] != null
                    ? item["average_rating"]
                    : (
                        profile["average_rating"] != null
                            ? profile["average_rating"]
                            : item["rating"]
                    ),

            profileImage:
                item["profile_image"] ||
                profile["profile_image"] ||
                user["profile_image"] ||
                ""
        };
    }

    function createParagraph(className, text) {
        var paragraph = document.createElement("p");
        paragraph.className = className;
        paragraph.textContent = text;
        return paragraph;
    }

    function createWorkerCard(worker) {
        var card = document.createElement("article");
        card.className = "worker-card";
        card.dataset.workerId = worker.id;
                card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute(
            "aria-label",
            "View " + worker.fullName + "'s profile"
        );
        card.style.cursor = "pointer";

        card.addEventListener("click", function () {
            openWorkerProfile(worker);
        });

        card.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openWorkerProfile(worker);
            }
        });

        var avatar = document.createElement("div");
        avatar.className = "worker-avatar";

        if (worker.profileImage) {
            avatar.style.backgroundImage =
                "url(\"" + worker.profileImage + "\")";
        } else {
            avatar.textContent = getInitials(worker.fullName);
        }

        var name = document.createElement("h3");
        name.className = "worker-name";
        name.textContent = worker.fullName;

        var profession = createParagraph(
            "worker-profession",
            worker.profession
        );

        var location = createParagraph(
            "worker-profession",
            "📍 " + worker.location
        );

        var availabilityValue =
            normalizeAvailability(worker.availability);

        var availability = null;

        if (availabilityValue) {
            var availabilityLabel = availabilityValue;

            if (availabilityValue === "pre-booking") {
                availabilityLabel = "Pre-booking";
            }

            if (availabilityValue === "on-spot") {
                availabilityLabel = "On-spot";
            }

            if (availabilityValue === "both") {
                availabilityLabel =
                    "Pre-booking + On-spot";
            }

            availability = createParagraph(
                "worker-profession",
                availabilityLabel
            );

            availability.style.fontWeight = "600";
        }

        var meta = document.createElement("div");
        meta.className = "worker-meta";

        var rating = document.createElement("span");
        rating.className = "worker-rating";

        var ratingNumber = Number(worker.rating);

        rating.textContent =
            Number.isFinite(ratingNumber)
                ? "★ " + ratingNumber.toFixed(1)
                : "★ New";

        var price = document.createElement("span");
        price.className = "worker-price";
        price.textContent =
            "₹" + Number(worker.price || 0);

        meta.appendChild(rating);
        meta.appendChild(price);

        card.appendChild(avatar);
        card.appendChild(name);
        card.appendChild(profession);
        card.appendChild(location);

        if (availability) {
            card.appendChild(availability);
        }

        card.appendChild(meta);

        return card;
    }
        function openWorkerProfile(worker) {
        if (!worker || !worker.id) {
            return;
        }

        try {
            sessionStorage.setItem(
                "handyhire.selectedWorkerId",
                String(worker.id)
            );

            sessionStorage.setItem(
                "handyhire.provider.previousPage",
                window.location.href
            );
        } catch (error) {
            // Navigation still works without sessionStorage.
        }

        window.location.href =
            "provider-job-hire.html?worker_id=" +
            encodeURIComponent(
                String(worker.id)
            );
    }

    function renderWorkers(workers) {
        var grid = document.getElementById("serviceGrid");

        if (!grid) {
            return;
        }

        displayList = Array.isArray(workers) ? workers : [];
        renderDisplay(grid);
    }

    function getViewAllButton(grid) {
        var section = grid.closest(".service-section");
        if (!section) return null;

        var btn = section.querySelector("[data-view-all]");
        if (btn) return btn;

        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "view-all-btn";
        btn.dataset["viewAll"] = "true";
        btn.addEventListener("click", function () {
            isExpanded = !isExpanded;
            renderDisplay(grid);
        });

        grid.parentNode.insertBefore(btn, grid.nextSibling);
        return btn;
    }

    function renderDisplay(grid) {
        if (!grid) return;

        var btn = getViewAllButton(grid);

        if (!displayList.length) {
            var message = "No workers found.";

            if (currentFilter === "pre-booking") {
                message = "No pre-booking workers available.";
            }

            if (currentFilter === "on-spot") {
                message = "No on-spot workers available.";
            }

            if (currentFilter === "near-me") {
                message = "No workers found near your location.";
            }

            showMessage(message);
            if (btn) btn.hidden = true;
            return;
        }

        var list = isExpanded ? displayList : displayList.slice(0, DISPLAY_LIMIT);

        grid.innerHTML = "";

        list.forEach(function (worker) {
            grid.appendChild(createWorkerCard(worker));
        });

        if (btn) {
            btn.hidden = displayList.length <= DISPLAY_LIMIT;
            btn.textContent = isExpanded ? "Show Less" : "View All";
        }
    }

    function getCurrentLocation() {
        try {
            var storedProfile =
                sessionStorage.getItem(
                    "handyhire.provider.profile"
                );

            if (!storedProfile) {
                return "";
            }

            var profile =
                JSON.parse(storedProfile);

            return String(
                profile["location"] ||
                profile["address"] ||
                ""
            )
                .toLowerCase()
                .trim();
        } catch (error) {
            return "";
        }
    }

    function applyFilter(filter) {
        currentFilter = filter || "all";
        isExpanded = false;

        var filteredWorkers =
            allWorkers.slice();

        if (
            currentFilter === "pre-booking" ||
            currentFilter === "on-spot"
        ) {
            filteredWorkers =
                allWorkers.filter(function (worker) {
                    var availability =
                        normalizeAvailability(
                            worker.availability
                        );

                    return (
                        availability === currentFilter ||
                        availability === "both"
                    );
                });
        }

        if (currentFilter === "near-me") {
            var currentLocation =
                getCurrentLocation();

            if (!currentLocation) {
                renderWorkers([]);
                return;
            }

            filteredWorkers =
                allWorkers.filter(function (worker) {
                    var workerLocation =
                        String(worker.location || "")
                            .toLowerCase()
                            .trim();

                    return (
                        workerLocation === currentLocation ||
                        workerLocation.includes(
                            currentLocation
                        ) ||
                        currentLocation.includes(
                            workerLocation
                        )
                    );
                });
        }

        if (currentFilter === "budget") {
            filteredWorkers.sort(
                function (first, second) {
                    return (
                        Number(first.price || 0) -
                        Number(second.price || 0)
                    );
                }
            );
        }

        if (currentSearch) {
            var query =
                currentSearch
                    .toLowerCase()
                    .trim();

            filteredWorkers =
                filteredWorkers.filter(
                    function (worker) {
                        return (
                            String(
                                worker.fullName ||
                                ""
                            )
                                .toLowerCase()
                                .includes(query) ||
                            String(
                                worker.profession ||
                                ""
                            )
                                .toLowerCase()
                                .includes(query) ||
                            String(
                                worker.location ||
                                ""
                            )
                                .toLowerCase()
                                .includes(query) ||
                            String(
                                worker.availability ||
                                ""
                            )
                                .toLowerCase()
                                .includes(query)
                        );
                    }
                );
        }

        if (currentSort) {
            filteredWorkers.sort(
                function (first, second) {
                    if (currentSort === "rating") {
                        return (
                            Number(second.averageRating || 0) -
                            Number(first.averageRating || 0)
                        );
                    }
                    if (currentSort === "price_asc") {
                        return (
                            Number(first.price || 0) -
                            Number(second.price || 0)
                        );
                    }
                    if (currentSort === "price_desc") {
                        return (
                            Number(second.price || 0) -
                            Number(first.price || 0)
                        );
                    }
                    if (currentSort === "name") {
                        return String(first.fullName || "")
                            .localeCompare(String(second.fullName || ""));
                    }
                    return 0;
                }
            );
        }

        renderWorkers(filteredWorkers);
    }

    function setActiveFilter(filter) {
        var chips =
            document.querySelectorAll(
                ".filter-chips .chip"
            );

        chips.forEach(function (chip) {
            var active =
                chip.dataset.filter === filter;

            chip.classList.toggle(
                "is-active",
                active
            );

            chip.setAttribute(
                "aria-pressed",
                active ? "true" : "false"
            );
        });
    }

    function initializeFilters() {
        var chips =
            document.querySelectorAll(
                ".filter-chips .chip"
            );

        currentFilter = "all";
        setActiveFilter("all");

        chips.forEach(function (chip) {
            chip.addEventListener(
                "click",
                function () {
                    var filter =
                        chip.dataset.filter ||
                        "all";

                    setActiveFilter(filter);
                    applyFilter(filter);
                }
            );
        });
    }

    function initializeSearch() {
        var searchInput =
            document.getElementById(
                "providerWorkerSearch"
            );

        if (!searchInput) {
            return;
        }

        searchInput.addEventListener(
            "input",
            function () {
                currentSearch =
                    searchInput.value;

                applyFilter(
                    currentFilter
                );
            }
        );
    }

    function initializeSort() {
        var sortSelect =
            document.getElementById(
                "providerWorkerSort"
            );

        if (!sortSelect) {
            return;
        }

        sortSelect.addEventListener(
            "change",
            function () {
                currentSort =
                    sortSelect.value;

                applyFilter(
                    currentFilter
                );
            }
        );
    }

    async function loadWorkers() {
        showMessage("Loading workers...");

        try {
            var api = window.HandyHireAPI;

            if (
                !api ||
                typeof api.apiFetch !== "function"
            ) {
                throw new Error(
                    "HandyHire API helper is unavailable."
                );
            }

            var response =
                await api.apiFetch("/api/workers");

            if (response.status === 401) {
                if (
                    typeof api.clearAuth === "function"
                ) {
                    api.clearAuth();
                }

                window.location.href =
                    "login.html";

                return;
            }

            if (!response.ok) {
                showMessage(
                    "Unable to load workers."
                );

                return;
            }

            var data =
                await response.json();

            var records =
                Array.isArray(data)
                    ? data
                    : (
                        data["workers"] ||
                        data["items"] ||
                        data["results"] ||
                        data["data"] ||
                        []
                    );

            var currentUser =
                typeof api.getCurrentUser === "function"
                    ? api.getCurrentUser()
                    : null;

            var currentUserId =
                currentUser
                    ? (
                        currentUser.id ||
                        currentUser.user_id
                    )
                    : null;

            allWorkers =
                Array.isArray(records)
                    ? records
                        .map(normalizeWorker)
                        .filter(function (worker) {
                            if (!currentUserId) {
                                return true;
                            }

                            return (
                                String(worker.id) !==
                                String(currentUserId)
                            );
                        })
                    : [];

            applyFilter("all");
        } catch (error) {
            console.error(
                "Failed to load workers:",
                error
            );

            showMessage(
                "Network error. Please check your backend."
            );
        }
    }

    async function loadAvailability() {
        var api = window.HandyHireAPI;

        if (!api || typeof api.apiFetch !== "function") {
            return;
        }

        try {
            var response = await api.apiFetch("/api/worker/profile");

            if (response.status === 401) {
                return;
            }

            if (!response.ok) {
                return;
            }

            var data = await response.json();
            var value = String(data.availability || "").trim();
            lastKnownAvailability = value;
            applyAvailabilityToggle(value);
        } catch (error) {
            // Non-blocking: leave toggle in default OFF state.
        }
    }

    function applyAvailabilityToggle(value) {
        var toggle = document.getElementById("availabilityToggle");
        var message = document.getElementById("availabilityMessage");

        if (!toggle) {
            return;
        }

        var isAvailable = Boolean(value);
        toggle.setAttribute("aria-checked", isAvailable ? "true" : "false");
        toggle.classList.toggle("is-active", isAvailable);

        if (message) {
            message.textContent = "";
            message.hidden = true;
        }
    }

    function showAvailabilityMessage(text) {
        var message = document.getElementById("availabilityMessage");

        if (!message) {
            return;
        }

        message.textContent = text || "";
        message.hidden = !text;
    }

    async function updateAvailability(nextValue) {
        var api = window.HandyHireAPI;

        if (!api || typeof api.apiFetch !== "function") {
            return;
        }

        if (availabilitySaving) {
            return;
        }

        var toggle = document.getElementById("availabilityToggle");

        if (!toggle) {
            return;
        }

        availabilitySaving = true;
        toggle.disabled = true;
        showAvailabilityMessage("");

        try {
            var response = await api.apiFetch("/api/worker/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    availability: nextValue || null
                })
            });

            if (!response.ok) {
                throw new Error("update-failed");
            }

            lastKnownAvailability = String(nextValue || "").trim();
            applyAvailabilityToggle(lastKnownAvailability);
        } catch (error) {
            applyAvailabilityToggle(lastKnownAvailability);
            showAvailabilityMessage("Unable to update availability.");
        } finally {
            availabilitySaving = false;
            toggle.disabled = false;
        }
    }

    function initAvailabilityToggle() {
        var toggle = document.getElementById("availabilityToggle");

        if (!toggle) {
            return;
        }

        toggle.addEventListener("click", function () {
            if (availabilitySaving) {
                return;
            }

            var isActive = toggle.classList.contains("is-active");
            var nextValue = isActive ? "" : "both";

            toggle.setAttribute("aria-checked", isActive ? "false" : "true");
            toggle.classList.toggle("is-active", !isActive);
            updateAvailability(nextValue);
        });
    }

    function initializePage() {
        if (!requireAuth()) {
            return;
        }

        initializeFilters();
        initializeSearch();
        initializeSort();
        initAvailabilityToggle();
        loadAvailability();
        loadWorkers();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initializePage
        );
    } else {
        initializePage();
    }
})();