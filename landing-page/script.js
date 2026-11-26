(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  var canAnimate = !reduceMotion && hasGsap;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (hasGsap) {
    window.gsap.registerPlugin(window.ScrollTrigger);
  }

  function forceVisible() {
    root.classList.remove("js");
    var nodes = document.querySelectorAll(
      "[data-reveal], [data-stagger] > *, .split-word-inner, .hero-title .hero-line > span, .hero-eyebrow, .hero-lede, .hero-actions, .hero-points, .hero-visual, .hero-foot"
    );
    nodes.forEach(function (node) {
      node.style.opacity = "";
      node.style.transform = "";
      node.style.visibility = "";
    });
  }

  var header = document.getElementById("siteHeader");
  var progressBar = document.getElementById("scrollProgress");
  var navLinks = Array.prototype.slice.call(document.querySelectorAll("[data-nav]"));
  var scrollTicking = false;

  function getSection(id) {
    return document.getElementById(id);
  }

  function updateScrollState() {
    scrollTicking = false;
    var y = window.scrollY || window.pageYOffset || 0;

    if (header) {
      header.classList.toggle("is-scrolled", y > 14);
    }

    if (progressBar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var progress = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      progressBar.style.width = (progress * 100).toFixed(2) + "%";
    }

    var marker = y + window.innerHeight * 0.34;
    var activeId = "home";
    var services = getSection("services");
    var process = getSection("how-it-works");
    var about = getSection("about");

    if (services && marker >= services.offsetTop) activeId = "services";
    if (process && marker >= process.offsetTop) activeId = "how-it-works";
    if (about && marker >= about.offsetTop) activeId = "about";
    if (about && marker >= about.offsetTop + about.offsetHeight) activeId = "";

    navLinks.forEach(function (link) {
      var isActive = link.getAttribute("data-nav") === activeId;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function requestScrollUpdate() {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(updateScrollState);
  }

  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate, { passive: true });
  updateScrollState();

  var toggle = document.getElementById("navToggle");
  var menu = document.getElementById("mobileMenu");
  var menuOpen = false;
  var menuReturnFocus = true;

  function setInert(element, value) {
    if (!element) return;
    if (value) {
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    } else {
      element.removeAttribute("inert");
      element.setAttribute("aria-hidden", "false");
    }
  }

  function openMenu() {
    if (!toggle || !menu) return;
    menuOpen = true;
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    menu.classList.add("is-open");
    body.classList.add("menu-open");
    setInert(menu, false);
    window.setTimeout(function () {
      var first = menu.querySelector(".mobile-link");
      if (first) first.focus({ preventScroll: true });
    }, 180);
  }

  function closeMenu(returnFocus) {
    if (!toggle || !menu) return;
    menuOpen = false;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    menu.classList.remove("is-open");
    body.classList.remove("menu-open");
    setInert(menu, true);
    if (returnFocus !== false) toggle.focus({ preventScroll: true });
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      if (menuOpen) closeMenu(true);
      else openMenu();
    });
  }

  if (menu) {
    setInert(menu, true);
    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        closeMenu(false);
      });
    });
  }

  document.addEventListener("keydown", function (event) {
    if (!menuOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }

    if (event.key !== "Tab" || !menu || !toggle) return;

    var focusables = [toggle].concat(
      Array.prototype.slice.call(menu.querySelectorAll("a, button"))
    ).filter(function (el) {
      return el.getClientRects().length > 0;
    });

    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 1024 && menuOpen) closeMenu(false);
  });

  var toast = document.getElementById("toast");
  var toastText = toast ? toast.querySelector(".toast-text") : null;
  var toastTimer = 0;

  function showToast(message) {
    if (!toast || !toastText) return;
    toastText.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
    }, 4400);
  }

  document.addEventListener("click", function (event) {
    var target = event.target.closest("[data-placeholder]");
    if (!target) return;
    if (target.tagName === "A") event.preventDefault();
    showToast(target.getAttribute("data-placeholder") || "Not available in this demonstration.");
  });

  var availabilitySwitch = document.getElementById("availabilitySwitch");
  var availabilityLabel = document.getElementById("availabilityLabel");

  if (availabilitySwitch) {
    availabilitySwitch.addEventListener("click", function () {
      var next = availabilitySwitch.getAttribute("aria-checked") !== "true";
      availabilitySwitch.setAttribute("aria-checked", String(next));
      if (availabilityLabel) availabilityLabel.textContent = next ? "Available" : "Offline";
    });
  }

  if (finePointer) {
    document.querySelectorAll(".service-card").forEach(function (card) {
      card.addEventListener("pointermove", function (event) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", (event.clientX - rect.left).toFixed(1) + "px");
        card.style.setProperty("--my", (event.clientY - rect.top).toFixed(1) + "px");
      });
    });
  }

  function splitWords(element) {
    var walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          if (node.parentElement && node.parentElement.closest(".split-word")) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    var textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach(function (node) {
      var parts = node.nodeValue.split(/(\s+)/);
      var fragment = document.createDocumentFragment();

      parts.forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          fragment.appendChild(document.createTextNode(part));
          return;
        }
        var outer = document.createElement("span");
        outer.className = "split-word";
        var inner = document.createElement("span");
        inner.className = "split-word-inner";
        inner.textContent = part;
        outer.appendChild(inner);
        fragment.appendChild(outer);
      });

      if (node.parentNode) node.parentNode.replaceChild(fragment, node);
    });
  }

  function setupTextReveals() {
    var headings = Array.prototype.slice.call(document.querySelectorAll("[data-split]"));
    if (!headings.length) return;

    var useObserver = "IntersectionObserver" in window;
    var observer = useObserver
      ? new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting) return;
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            });
          },
          { threshold: 0.12, rootMargin: "0px 0px -9% 0px" }
        )
      : null;

    headings.forEach(function (heading) {
      splitWords(heading);
      var words = heading.querySelectorAll(".split-word-inner");
      words.forEach(function (word, index) {
        word.style.transitionDelay = Math.min(index * 38, 380) + "ms";
      });

      if (observer) observer.observe(heading);
      else heading.classList.add("is-visible");
    });
  }

  function initAnimations() {
    if (!canAnimate) {
      if (!reduceMotion && !hasGsap) forceVisible();
      return;
    }

    var gsap = window.gsap;
    var ScrollTrigger = window.ScrollTrigger;
    ScrollTrigger.config({ ignoreMobileResize: true });
    gsap.defaults({ ease: "power3.out", duration: 1 });

    gsap.set([".hero-eyebrow", ".hero-lede", ".hero-actions", ".hero-points", ".hero-foot"], {
      opacity: 0,
      y: 16
    });
    gsap.set(".hero-visual", { opacity: 0, y: 26, scale: 0.982 });

    var heroTimeline = gsap.timeline({ delay: 0.12 });
    heroTimeline
      .to(".hero-eyebrow", { opacity: 1, y: 0, duration: 0.7 }, 0.02)
      .to(".hero-lede", { opacity: 1, y: 0, duration: 0.86 }, 0.44)
      .to(".hero-actions", { opacity: 1, y: 0, duration: 0.82 }, 0.57)
      .to(".hero-points", { opacity: 1, y: 0, duration: 0.82 }, 0.68)
      .to(".hero-visual", { opacity: 1, y: 0, scale: 1, duration: 1.38, ease: "power3.out" }, 0.3)
      .to(".hero-foot", { opacity: 1, y: 0, duration: 0.8 }, 0.92);

    gsap.to(".hero-scene", {
      y: -24,
      ease: "none",
      scrollTrigger: {
        trigger: "#home",
        start: "top top",
        end: "bottom top",
        scrub: 0.6
      }
    });

    gsap.to(".hero-glow--one", {
      y: 74,
      ease: "none",
      scrollTrigger: {
        trigger: "#home",
        start: "top top",
        end: "bottom top",
        scrub: 0.8
      }
    });

    gsap.to(".hero-glow--two", {
      y: -52,
      ease: "none",
      scrollTrigger: {
        trigger: "#home",
        start: "top top",
        end: "bottom top",
        scrub: 0.8
      }
    });

    document.querySelectorAll("[data-reveal]").forEach(function (element) {
      var variant = element.getAttribute("data-reveal") || "up";
      var from = { opacity: 0, y: 26 };
      if (variant === "scale") from = { opacity: 0, y: 20, scale: 0.965 };
      if (variant === "right") from = { opacity: 0, x: 34, y: 0 };

      gsap.fromTo(
        element,
        from,
        {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          duration: 1.04,
          ease: "power3.out",
          scrollTrigger: {
            trigger: element,
            start: "top 89%",
            once: true
          }
        }
      );
    });

    document.querySelectorAll("[data-stagger]").forEach(function (group) {
      var children = Array.prototype.slice.call(group.children);
      if (!children.length) return;
      gsap.fromTo(
        children,
        { opacity: 0, y: 25 },
        {
          opacity: 1,
          y: 0,
          duration: 0.88,
          stagger: 0.085,
          ease: "power3.out",
          scrollTrigger: {
            trigger: group,
            start: "top 86%",
            once: true
          }
        }
      );
    });

    var rail = document.getElementById("processRail");
    if (rail) {
      var processMedia = gsap.matchMedia();
      processMedia.add("(min-width: 861px)", function () {
        gsap.fromTo(
          rail,
          { scaleX: 0, scaleY: 1 },
          {
            scaleX: 1,
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: ".process-track",
              start: "top 78%",
              end: "bottom 72%",
              scrub: 0.55
            }
          }
        );
      });
      processMedia.add("(max-width: 860px)", function () {
        gsap.fromTo(
          rail,
          { scaleX: 1, scaleY: 0 },
          {
            scaleX: 1,
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: ".process-track",
              start: "top 80%",
              end: "bottom 74%",
              scrub: 0.55
            }
          }
        );
      });
    }

    document.querySelectorAll(".process-step").forEach(function (step) {
      window.ScrollTrigger.create({
        trigger: step,
        start: "top 78%",
        once: true,
        onEnter: function () {
          step.classList.add("is-active");
        }
      });

      var bodyContent = step.querySelector(".process-body");
      if (bodyContent) {
        gsap.fromTo(
          bodyContent,
          { opacity: 0, y: 18 },
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
            scrollTrigger: {
              trigger: step,
              start: "top 82%",
              once: true
            }
          }
        );
      }
    });

    document.querySelectorAll("[data-count]").forEach(function (counter) {
      var target = parseInt(counter.getAttribute("data-count"), 10) || 0;
      var pad = parseInt(counter.getAttribute("data-pad"), 10) || 0;
      var value = { current: 0 };

      function renderValue() {
        counter.textContent = String(Math.round(value.current)).padStart(pad, "0");
      }

      counter.textContent = String(0).padStart(pad, "0");

      window.ScrollTrigger.create({
        trigger: counter,
        start: "top 91%",
        once: true,
        onEnter: function () {
          gsap.to(value, {
            current: target,
            duration: 1.5,
            ease: "power2.out",
            onUpdate: renderValue
          });
        }
      });
    });

    var bookingFill = document.getElementById("bookingFill");
    if (bookingFill) {
      gsap.fromTo(
        bookingFill,
        { scaleX: 0 },
        {
          scaleX: 0.62,
          duration: 1.45,
          ease: "power2.out",
          scrollTrigger: {
            trigger: ".booking-card",
            start: "top 80%",
            once: true
          }
        }
      );
    }

    document.querySelectorAll("[data-parallax]").forEach(function (element) {
      var speed = parseFloat(element.getAttribute("data-parallax")) || 0;
      var trigger = element.closest(".cta-panel") || element;
      gsap.to(element, {
        y: speed * -220,
        ease: "none",
        scrollTrigger: {
          trigger: trigger,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.8
        }
      });
    });

    gsap.to(".blueprint-card", {
      y: -14,
      ease: "none",
      scrollTrigger: {
        trigger: ".blueprint",
        start: "top bottom",
        end: "bottom top",
        scrub: 0.7
      }
    });

    window.addEventListener("load", function () {
      ScrollTrigger.refresh();
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        ScrollTrigger.refresh();
      });
    }
  }

  function initHeroScene() {
    var sceneWrapper = document.getElementById("heroScene");
    var canvas = document.getElementById("heroCanvas");
    var loader = document.getElementById("sceneLoader");

    if (!sceneWrapper || !canvas) return;

    function showFallback() {
      sceneWrapper.classList.add("is-fallback");
      if (loader) loader.classList.add("is-hidden");
      var badge = document.querySelector(".scene-badge");
      if (badge) badge.style.display = "none";
    }

    if (!window.THREE) {
      showFallback();
      return;
    }

    function webglAvailable() {
      try {
        var probe = document.createElement("canvas");
        return Boolean(
          window.WebGLRenderingContext &&
          (probe.getContext("webgl2") || probe.getContext("webgl") || probe.getContext("experimental-webgl"))
        );
      } catch (error) {
        return false;
      }
    }

    if (!webglAvailable()) {
      showFallback();
      return;
    }

    var THREE = window.THREE;
    var renderer;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      });
    } catch (error) {
      showFallback();
      return;
    }

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    var clock = new THREE.Clock();
    var rafId = null;
    var running = false;
    var firstFrame = true;
    var heroVisible = true;
    var pointerX = 0;
    var pointerY = 0;
    var targetX = 0;
    var targetY = 0;
    var baseCamera = { x: 6.6, y: 4.7, z: 8.9 };
    var currentCamera = { x: 6.6, y: 4.7, z: 8.9 };
    var isNarrow = false;
    var fallbackTimer = null;

    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    var maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy() || 1);

    function makeCanvasTexture(size, painter) {
      var textureCanvas = document.createElement("canvas");
      textureCanvas.width = size;
      textureCanvas.height = size;
      var ctx = textureCanvas.getContext("2d");
      painter(ctx, size);
      var texture = new THREE.CanvasTexture(textureCanvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = maxAnisotropy;
      return texture;
    }

    function roundRectPath(ctx, x, y, w, h, radius) {
      var r = Math.min(radius, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    var iconPainters = {
      bolt: function (ctx) {
        ctx.beginPath();
        ctx.moveTo(13, 2);
        ctx.lineTo(4, 14);
        ctx.lineTo(11, 14);
        ctx.lineTo(10, 22);
        ctx.lineTo(20, 10);
        ctx.lineTo(13, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      },
      drop: function (ctx) {
        ctx.beginPath();
        ctx.moveTo(12, 2.5);
        ctx.bezierCurveTo(12, 2.5, 18, 9.2, 18, 14);
        ctx.bezierCurveTo(18, 17.3, 15.3, 20, 12, 20);
        ctx.bezierCurveTo(8.7, 20, 6, 17.3, 6, 14);
        ctx.bezierCurveTo(6, 9.2, 12, 2.5, 12, 2.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(9.7, 14.6, 2.3, Math.PI * 0.85, Math.PI * 1.9);
        ctx.stroke();
      },
      roller: function (ctx) {
        roundRectPath(ctx, 3, 5, 12.5, 7, 1.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(15.5, 7);
        ctx.lineTo(19.4, 7);
        ctx.bezierCurveTo(21, 7, 21, 9.2, 19.4, 9.2);
        ctx.lineTo(15.5, 9.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(9.3, 12);
        ctx.lineTo(9.3, 19);
        ctx.lineTo(6.8, 21);
        ctx.stroke();
      },
      sparkle: function (ctx) {
        ctx.beginPath();
        ctx.moveTo(12, 2.5);
        ctx.lineTo(14.2, 8.6);
        ctx.lineTo(20.5, 11);
        ctx.lineTo(14.2, 13.4);
        ctx.lineTo(12, 19.5);
        ctx.lineTo(9.8, 13.4);
        ctx.lineTo(3.5, 11);
        ctx.lineTo(9.8, 8.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      },
      home: function (ctx) {
        ctx.beginPath();
        ctx.moveTo(3, 10.8);
        ctx.lineTo(12, 3);
        ctx.lineTo(21, 10.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(5.5, 9.6);
        ctx.lineTo(5.5, 21);
        ctx.lineTo(18.5, 21);
        ctx.lineTo(18.5, 9.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(9.5, 21);
        ctx.lineTo(9.5, 15);
        ctx.lineTo(14.5, 15);
        ctx.lineTo(14.5, 21);
        ctx.stroke();
      }
    };

    function makeServiceTexture(iconName) {
      return makeCanvasTexture(256, function (ctx) {
        ctx.clearRect(0, 0, 256, 256);

        ctx.save();
        ctx.shadowColor = "rgba(35, 50, 30, 0.2)";
        ctx.shadowBlur = 22;
        ctx.shadowOffsetY = 10;
        roundRectPath(ctx, 17, 17, 222, 222, 56);
        ctx.fillStyle = "#fffdf8";
        ctx.fill();
        ctx.restore();

        roundRectPath(ctx, 17, 17, 222, 222, 56);
        ctx.strokeStyle = "rgba(43, 59, 39, 0.14)";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(128, 123, 71, 0, Math.PI * 2);
        ctx.fillStyle = "#edf2e7";
        ctx.fill();

        ctx.save();
        ctx.translate(68, 63);
        ctx.scale(5, 5);
        ctx.strokeStyle = "#4f6b45";
        ctx.fillStyle = "rgba(104, 134, 92, 0.17)";
        ctx.lineWidth = 1.55;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        iconPainters[iconName](ctx);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(128, 199, 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(104, 134, 92, 0.42)";
        ctx.fill();
      });
    }

    var dotTexture = makeCanvasTexture(64, function (ctx) {
      var gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(255,255,255,0.95)");
      gradient.addColorStop(0.45, "rgba(255,255,255,0.55)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
    });

    var shadowTexture = makeCanvasTexture(256, function (ctx) {
      var gradient = ctx.createRadialGradient(128, 128, 6, 128, 128, 126);
      gradient.addColorStop(0, "rgba(35,50,30,0.52)");
      gradient.addColorStop(0.55, "rgba(35,50,30,0.2)");
      gradient.addColorStop(1, "rgba(35,50,30,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 256);
    });

    var materials = {
      wall: new THREE.MeshStandardMaterial({ color: 0xf3ede1, roughness: 0.92, metalness: 0 }),
      wallShade: new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 0.94, metalness: 0 }),
      accent: new THREE.MeshStandardMaterial({ color: 0x68865c, roughness: 0.8, metalness: 0.02 }),
      deep: new THREE.MeshStandardMaterial({ color: 0x3f5138, roughness: 0.78, metalness: 0.02 }),
      roof: new THREE.MeshStandardMaterial({ color: 0x2f3e2a, roughness: 0.72, metalness: 0.03 }),
      stone: new THREE.MeshStandardMaterial({ color: 0xded7c8, roughness: 0.98, metalness: 0 }),
      stoneTop: new THREE.MeshStandardMaterial({ color: 0xe9e3d6, roughness: 0.98, metalness: 0 }),
      glass: new THREE.MeshStandardMaterial({
        color: 0x7b8a71,
        roughness: 0.2,
        metalness: 0.28,
        emissive: 0x4d4027,
        emissiveIntensity: 0.42
      }),
      glassRail: new THREE.MeshStandardMaterial({
        color: 0xb8c5ad,
        roughness: 0.22,
        metalness: 0.08,
        transparent: true,
        opacity: 0.42
      }),
      leaf: new THREE.MeshStandardMaterial({ color: 0x5d7a52, roughness: 0.92, metalness: 0 }),
      soil: new THREE.MeshStandardMaterial({ color: 0x4a4437, roughness: 1, metalness: 0 }),
      metal: new THREE.MeshStandardMaterial({ color: 0xcdbf9d, roughness: 0.36, metalness: 0.55 })
    };

    var world = new THREE.Group();
    world.position.y = -0.06;
    scene.add(world);

    var platform = new THREE.Group();
    world.add(platform);

    var platformBase = new THREE.Mesh(new THREE.CylinderGeometry(3.55, 3.72, 0.28, 64), materials.stone);
    platformBase.position.y = -0.14;
    platformBase.receiveShadow = true;
    platform.add(platformBase);

    var platformTop = new THREE.Mesh(new THREE.CylinderGeometry(3.55, 3.55, 0.035, 64), materials.stoneTop);
    platformTop.position.y = 0.017;
    platformTop.receiveShadow = true;
    platform.add(platformTop);

    var platformRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.55, 0.011, 8, 160),
      new THREE.MeshBasicMaterial({ color: 0x68865c, transparent: true, opacity: 0.32 })
    );
    platformRing.rotation.x = Math.PI / 2;
    platformRing.position.y = 0.04;
    platform.add(platformRing);

    var softShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(5.4, 4.6),
      new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        opacity: 0.58,
        depthWrite: false
      })
    );
    softShadow.rotation.x = -Math.PI / 2;
    softShadow.position.y = 0.045;
    platform.add(softShadow);

    var house = new THREE.Group();
    house.position.y = 0.03;
    world.add(house);

    function addBox(w, h, d, x, y, z, material, options) {
      var opts = options || {};
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = opts.castShadow !== false;
      mesh.receiveShadow = opts.receiveShadow !== false;
      if (opts.rotation) {
        mesh.rotation.set(opts.rotation[0], opts.rotation[1], opts.rotation[2]);
      }
      (opts.parent || house).add(mesh);
      return mesh;
    }

    addBox(3.45, 1.52, 2.45, 0, 0.79, 0, materials.wall);
    addBox(3.72, 0.14, 2.72, 0, 1.55, 0, materials.roof);
    addBox(2.12, 1.3, 1.92, -0.56, 2.27, 0.02, materials.wall);
    addBox(2.38, 0.11, 2.16, -0.56, 2.97, 0.02, materials.roof);
    addBox(0.34, 0.95, 0.34, -1.36, 3.42, -0.48, materials.deep);
    addBox(0.44, 0.06, 0.44, -1.36, 3.9, -0.48, materials.roof);

    addBox(0.08, 1.34, 2.1, 1.735, 0.8, 0, materials.wallShade);
    for (var slat = 0; slat < 6; slat += 1) {
      addBox(0.06, 1.22, 0.16, 1.78, 0.8, -0.78 + slat * 0.31, materials.deep, {
        castShadow: false
      });
    }

    addBox(1.95, 1.0, 0.06, -0.36, 0.81, 1.23, materials.deep);
    addBox(1.8, 0.86, 0.035, -0.36, 0.81, 1.27, materials.glass);
    addBox(0.032, 0.86, 0.02, -0.81, 0.81, 1.29, materials.metal);
    addBox(0.032, 0.86, 0.02, -0.36, 0.81, 1.29, materials.metal);
    addBox(0.032, 0.86, 0.02, 0.09, 0.81, 1.29, materials.metal);

    addBox(0.53, 1.3, 0.07, 0.98, 0.68, 1.23, materials.deep);
    addBox(0.39, 1.16, 0.02, 0.98, 0.68, 1.275, materials.wallShade, { castShadow: false });
    var handle = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 12), materials.metal);
    handle.position.set(0.79, 0.7, 1.3);
    handle.castShadow = true;
    house.add(handle);

    addBox(1.46, 0.7, 0.05, -0.56, 2.54, 1.0, materials.deep);
    addBox(1.33, 0.57, 0.03, -0.56, 2.54, 1.035, materials.glass);
    addBox(0.03, 0.57, 0.02, -0.56, 2.54, 1.055, materials.metal);
    addBox(1.33, 0.025, 0.02, -0.56, 2.54, 1.055, materials.metal);

    addBox(1.28, 0.032, 0.05, 0.98, 1.99, 1.32, materials.deep, { castShadow: false });
    for (var panel = 0; panel < 3; panel += 1) {
      addBox(0.36, 0.33, 0.025, 0.63 + panel * 0.38, 1.81, 1.32, materials.glassRail, {
        castShadow: false
      });
    }

    addBox(1.65, 0.08, 0.42, 0, 0.09, 1.47, materials.stoneTop);
    addBox(1.98, 0.07, 0.46, 0, 0.035, 1.83, materials.stone);

    addBox(0.5, 0.3, 0.5, 2.52, 0.2, 0.72, materials.deep);
    addBox(0.42, 0.04, 0.42, 2.52, 0.355, 0.72, materials.soil);

    var topiaryOne = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.88, 16), materials.leaf);
    topiaryOne.position.set(2.52, 0.79, 0.72);
    topiaryOne.castShadow = true;
    house.add(topiaryOne);

    addBox(0.46, 0.26, 0.46, -2.42, 0.18, 0.95, materials.deep);
    var topiaryTwo = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 14), materials.leaf);
    topiaryTwo.position.set(-2.42, 0.66, 0.95);
    topiaryTwo.castShadow = true;
    house.add(topiaryTwo);

    addBox(0.52, 0.05, 0.08, 2.52, 0.05, 1.45, materials.metal, { castShadow: false });

    var ringGroup = new THREE.Group();
    world.add(ringGroup);

    var backRingOne = new THREE.Mesh(
      new THREE.TorusGeometry(3.15, 0.012, 8, 180),
      new THREE.MeshBasicMaterial({ color: 0x68865c, transparent: true, opacity: 0.2, depthWrite: false })
    );
    backRingOne.position.set(0.1, 2.35, -1.95);
    backRingOne.rotation.set(-0.16, -0.24, 0.06);
    ringGroup.add(backRingOne);

    var backRingTwo = new THREE.Mesh(
      new THREE.TorusGeometry(3.95, 0.009, 8, 180),
      new THREE.MeshBasicMaterial({ color: 0x8a9d7c, transparent: true, opacity: 0.12, depthWrite: false })
    );
    backRingTwo.position.set(0, 2.55, -2.6);
    backRingTwo.rotation.set(-0.1, 0.28, -0.04);
    ringGroup.add(backRingTwo);

    var cardGroup = new THREE.Group();
    world.add(cardGroup);

    var cardData = [
      { icon: "bolt", position: [-2.52, 2.6, 1.55], scale: 0.78, phase: 0, speed: 0.62, amp: 0.085 },
      { icon: "drop", position: [2.45, 1.95, 1.75], scale: 0.7, phase: 1.8, speed: 0.7, amp: 0.075 },
      { icon: "roller", position: [-2.3, 3.45, -0.3], scale: 0.56, phase: 3.2, speed: 0.56, amp: 0.09 },
      { icon: "sparkle", position: [2.33, 3.25, 0.28], scale: 0.5, phase: 4.4, speed: 0.66, amp: 0.08 },
      { icon: "home", position: [-1.48, 1.18, 2.22], scale: 0.45, phase: 5.6, speed: 0.74, amp: 0.06 }
    ];

    cardData.forEach(function (item) {
      var material = new THREE.SpriteMaterial({
        map: makeServiceTexture(item.icon),
        transparent: true,
        depthWrite: false,
        depthTest: true
      });
      var sprite = new THREE.Sprite(material);
      sprite.position.set(item.position[0], item.position[1], item.position[2]);
      sprite.scale.set(item.scale, item.scale, 1);
      sprite.userData.base = sprite.position.clone();
      sprite.userData.phase = item.phase;
      sprite.userData.speed = item.speed;
      sprite.userData.amp = item.amp;
      cardGroup.add(sprite);
    });

    var particleCount = window.innerWidth < 720 ? 26 : 44;
    var particlePositions = new Float32Array(particleCount * 3);
    for (var p = 0; p < particleCount; p += 1) {
      var angle = Math.random() * Math.PI * 2;
      var radius = 2.15 + Math.random() * 2.2;
      particlePositions[p * 3] = Math.cos(angle) * radius;
      particlePositions[p * 3 + 1] = 0.9 + Math.random() * 3.3;
      particlePositions[p * 3 + 2] = Math.sin(angle) * radius;
    }

    var particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    var particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        map: dotTexture,
        color: 0x829678,
        size: 0.075,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        alphaTest: 0.01,
        sizeAttenuation: true
      })
    );
    world.add(particles);

    var hemisphere = new THREE.HemisphereLight(0xfff8ec, 0x7f8e75, 1.32);
    scene.add(hemisphere);

    var keyLight = new THREE.DirectionalLight(0xfff1db, 2.35);
    keyLight.position.set(5.6, 8.8, 6.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(window.innerWidth < 720 ? 512 : 1024, window.innerWidth < 720 ? 512 : 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 22;
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 6;
    keyLight.shadow.camera.bottom = -6;
    keyLight.shadow.bias = -0.0007;
    keyLight.shadow.normalBias = 0.02;
    keyLight.shadow.radius = 4;
    scene.add(keyLight);

    var fillLight = new THREE.DirectionalLight(0xd7e4cd, 0.82);
    fillLight.position.set(-6.2, 4.2, -2.6);
    scene.add(fillLight);

    var rimLight = new THREE.DirectionalLight(0xffffff, 0.38);
    rimLight.position.set(0, 3.4, -6);
    scene.add(rimLight);

    var ambient = new THREE.AmbientLight(0xffffff, 0.16);
    scene.add(ambient);

    function resizeScene() {
      var rect = sceneWrapper.getBoundingClientRect();
      var width = Math.max(1, Math.round(rect.width));
      var height = Math.max(1, Math.round(rect.height));
      var dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 720 ? 1.6 : 1.85);

      isNarrow = width < 480 || window.innerWidth < 720;
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = isNarrow ? 36 : 34;

      baseCamera = isNarrow
        ? { x: 7.4, y: 5.2, z: 10.8 }
        : { x: 6.6, y: 4.7, z: 8.9 };

      camera.position.set(baseCamera.x, baseCamera.y, baseCamera.z);
      camera.lookAt(0, 1.52, 0);
      camera.updateProjectionMatrix();

      cardGroup.scale.setScalar(isNarrow ? 0.86 : 1);
      world.position.y = isNarrow ? -0.12 : -0.06;

      if (reduceMotion) renderFrame(true);
    }

    function renderFrame(staticFrame) {
      if (!staticFrame) {
        var time = clock.getElapsedTime();
        pointerX += (targetX - pointerX) * 0.045;
        pointerY += (targetY - pointerY) * 0.045;

        camera.position.x = baseCamera.x + pointerX * 0.45;
        camera.position.y = baseCamera.y - pointerY * 0.28 + Math.sin(time * 0.32) * 0.035;
        camera.position.z = baseCamera.z;
        camera.lookAt(0, 1.52, 0);

        house.rotation.y = pointerX * 0.05;
        house.rotation.x = pointerY * 0.018;
        house.position.y = 0.03 + Math.sin(time * 0.55) * 0.012;
        cardGroup.rotation.y = pointerX * 0.018;

        cardGroup.children.forEach(function (sprite) {
          var data = sprite.userData;
          sprite.position.x = data.base.x + Math.cos(time * 0.42 + data.phase) * 0.035;
          sprite.position.y = data.base.y + Math.sin(time * data.speed + data.phase) * data.amp;
          sprite.position.z = data.base.z + Math.sin(time * 0.35 + data.phase) * 0.02;
        });

        ringGroup.rotation.z = Math.sin(time * 0.12) * 0.04;
        particles.rotation.y = time * 0.018;
        particles.position.y = Math.sin(time * 0.28) * 0.035;
      }

      try {
        renderer.render(scene, camera);
      } catch (error) {
        stopLoop();
        showFallback();
        return;
      }

      if (firstFrame) {
        firstFrame = false;
        if (fallbackTimer) window.clearTimeout(fallbackTimer);
        window.setTimeout(function () {
          sceneWrapper.classList.add("is-ready");
          if (loader) loader.classList.add("is-hidden");
        }, 220);
      }
    }

    function startLoop() {
      if (running || reduceMotion) return;
      running = true;
      clock.start();
      var tick = function () {
        if (!running) return;
        renderFrame(false);
        rafId = window.requestAnimationFrame(tick);
      };
      rafId = window.requestAnimationFrame(tick);
    }

    function stopLoop() {
      running = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    if (finePointer && !reduceMotion) {
      sceneWrapper.addEventListener("pointermove", function (event) {
        var rect = sceneWrapper.getBoundingClientRect();
        targetX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
        targetY = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
      });

      sceneWrapper.addEventListener("pointerleave", function () {
        targetX = 0;
        targetY = 0;
      });
    }

    canvas.addEventListener("webglcontextlost", function (event) {
      event.preventDefault();
      stopLoop();
      showFallback();
    });

    if (window.ResizeObserver) {
      var resizeObserver = new ResizeObserver(function () {
        resizeScene();
        if (reduceMotion) renderFrame(true);
      });
      resizeObserver.observe(sceneWrapper);
    } else {
      window.addEventListener("resize", function () {
        resizeScene();
        if (reduceMotion) renderFrame(true);
      });
    }

    if (window.IntersectionObserver) {
      var sceneObserver = new IntersectionObserver(
        function (entries) {
          heroVisible = entries[0].isIntersecting;
          if (heroVisible && !document.hidden && !reduceMotion) startLoop();
          else stopLoop();
        },
        { rootMargin: "160px" }
      );
      sceneObserver.observe(sceneWrapper);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stopLoop();
      else if (heroVisible && !reduceMotion) startLoop();
    });

    resizeScene();

    if (reduceMotion) {
      renderFrame(true);
    } else {
      startLoop();
      fallbackTimer = window.setTimeout(function () {
        if (firstFrame) showFallback();
      }, 7000);
    }
  }

  try {
    initHeroScene();
  } catch (error) {
    var scene = document.getElementById("heroScene");
    var sceneLoader = document.getElementById("sceneLoader");
    if (scene) scene.classList.add("is-fallback");
    if (sceneLoader) sceneLoader.classList.add("is-hidden");
  }

  try {
    initAnimations();
  } catch (error) {
    forceVisible();
  }

  if (!reduceMotion) {
    try {
      setupTextReveals();
    } catch (error) {
      document.querySelectorAll("[data-split]").forEach(function (heading) {
        heading.classList.add("is-visible");
      });
      forceVisible();
    }
  }

  if (reduceMotion) {
    document.querySelectorAll(".process-step").forEach(function (step) {
      step.classList.add("is-active");
    });
  }
})();
