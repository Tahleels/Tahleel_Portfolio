/* ============================================================
   TAHLEEL SHAIKH — PORTFOLIO RUNTIME

   Performance contract:
     - exactly ONE scroll listener for the whole page; all scroll
       work is coalesced into a single requestAnimationFrame
     - zero forced layout in the scroll path (page metrics are
       cached and only recomputed on a debounced resize)
     - hover effects use event delegation, not N listeners
     - bulk DOM (365 graph cells) is built in a DocumentFragment
       and attached once
     - the particle simulation is idle-initialised and suspends
       when off-screen or when the tab is hidden
============================================================ */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var API_BASE = window.PORTFOLIO_API_BASE || "";
  var GITHUB_USER = "Tahleels";

  /* ----------------------------------------------------------
     rAF scheduler — many producers, one frame
  ---------------------------------------------------------- */
  var frameTasks = [];
  var frameQueued = false;

  function onFrame(fn) { frameTasks.push(fn); }

  function requestFrame() {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(function () {
      frameQueued = false;
      for (var i = 0; i < frameTasks.length; i++) frameTasks[i]();
    });
  }

  /* Cached page metrics. Reading scrollHeight in a scroll handler
     forces a synchronous layout on every tick; we read it once. */
  var metrics = { scrollRange: 1 };
  function measure() {
    var d = document.documentElement;
    metrics.scrollRange = Math.max(d.scrollHeight - d.clientHeight, 1);
  }

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 150);
  }, { passive: true });

  window.addEventListener("scroll", requestFrame, { passive: true });

  /* ----------------------------------------------------------
     Scroll progress bar
  ---------------------------------------------------------- */
  var progress = document.getElementById("scrollProgress");
  if (progress) {
    onFrame(function () {
      var pct = (window.scrollY / metrics.scrollRange) * 100;
      progress.style.width = (pct > 100 ? 100 : pct) + "%";
    });
  }

  /* ----------------------------------------------------------
     Custom cursor — dot tracks exactly, ring lerps behind.
     Hover scaling uses delegation: one listener, not one per link.
  ---------------------------------------------------------- */
  var dot = document.getElementById("cursorDot");
  var ring = document.getElementById("cursorRing");
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (dot && ring && finePointer && !REDUCED) {
    var mx = 0, my = 0, rx = 0, ry = 0, ringScale = 1;

    var cursorLive = false;
    window.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      if (!cursorLive) {
        cursorLive = true;
        document.body.classList.add("cursor-live");
      }
    }, { passive: true });

    var HOVERABLE = "a, button, .project-card, .contact-card, .meta-rows li";
    document.addEventListener("mouseover", function (e) {
      if (e.target.closest && e.target.closest(HOVERABLE)) ringScale = 1.6;
    }, { passive: true });
    document.addEventListener("mouseout", function (e) {
      if (e.target.closest && e.target.closest(HOVERABLE)) ringScale = 1;
    }, { passive: true });

    (function tick() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      dot.style.transform = "translate(" + mx + "px," + my + "px) translate(-50%,-50%)";
      ring.style.transform = "translate(" + rx + "px," + ry + "px) translate(-50%,-50%) scale(" + ringScale + ")";
      requestAnimationFrame(tick);
    })();
  }

  /* ----------------------------------------------------------
     Magnetic buttons
  ---------------------------------------------------------- */
  if (finePointer && !REDUCED) {
    document.querySelectorAll(".magnetic").forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var x = e.clientX - r.left - r.width / 2;
        var y = e.clientY - r.top - r.height / 2;
        el.style.transform = "translate(" + x * 0.18 + "px," + y * 0.32 + "px)";
      });
      el.addEventListener("mouseleave", function () {
        el.style.transform = "";
      });
    });
  }

  /* ----------------------------------------------------------
     Reveal on scroll — unobserve after firing so the observer
     list shrinks to nothing instead of growing work per scroll
  ---------------------------------------------------------- */
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in-view");
      revealIO.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

  document.querySelectorAll(".reveal").forEach(function (el) { revealIO.observe(el); });

  /* ----------------------------------------------------------
     Sidebar nav — highlight the most-visible section
  ---------------------------------------------------------- */
  var navLinks = document.querySelectorAll(".nav-link");
  var ratios = new Map();

  var navIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      ratios.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
    });
    var bestId = null, best = 0;
    ratios.forEach(function (r, id) { if (r > best) { best = r; bestId = id; } });
    if (!bestId) return;
    navLinks.forEach(function (l) {
      l.classList.toggle("is-active", l.dataset.section === bestId);
    });
  }, { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] });

  document.querySelectorAll(".section").forEach(function (s) { navIO.observe(s); });

  /* ----------------------------------------------------------
     Count-up animation for the GitHub stat cards
  ---------------------------------------------------------- */
  function countUp(el, target) {
    if (REDUCED || target === 0) { el.textContent = String(target); return; }
    var start = performance.now();
    var DURATION = 900;
    (function step(now) {
      var t = Math.min((now - start) / DURATION, 1);
      var eased = 1 - Math.pow(1 - t, 3);          // ease-out cubic
      el.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }

  /* Fire the count only once the card is actually on screen. */
  function countWhenVisible(el, value) {
    if (typeof value !== "number") { el.textContent = "—"; return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        countUp(el, value);
        io.disconnect();
      });
    }, { threshold: 0.4 });
    io.observe(el);
  }

  /* ----------------------------------------------------------
     GitHub stats
  ---------------------------------------------------------- */
  var ghNote = document.getElementById("ghNote");

  function fetchJSON(url, ms) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms || 8000);
    return fetch(url, { signal: ctrl.signal })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .finally(function () { clearTimeout(timer); });
  }

  function renderCounts(d) {
    countWhenVisible(document.getElementById("ghMerged"), d.merged);
    countWhenVisible(document.getElementById("ghOpen"), d.open);
    countWhenVisible(document.getElementById("ghClosed"), d.closed);
  }

  /* 365+ cells: build detached, attach once. One reflow, not 365. */
  function renderGraph(weeks, months) {
    var graph = document.getElementById("ghGraph");
    var monthRow = document.getElementById("ghMonths");
    if (!graph) return;

    var LEVELS = [null, "#F3DCA0", "#E6BD5E", "#D6A13A", "#A87A23"];
    var frag = document.createDocumentFragment();

    weeks.forEach(function (week) {
      for (var d = 0; d < 7; d++) {
        var cell = document.createElement("span");
        cell.className = "gh-cell";
        var lvl = week[d] || 0;
        if (lvl > 0) cell.style.background = LEVELS[lvl];
        frag.appendChild(cell);
      }
    });

    graph.replaceChildren(frag);

    if (monthRow && months && months.length) {
      var mFrag = document.createDocumentFragment();
      months.forEach(function (label) {
        var s = document.createElement("span");
        s.textContent = label || "";
        mFrag.appendChild(s);
      });
      monthRow.replaceChildren(mFrag);
    }
  }

  /* An empty grid reads as broken, so collapse the plot area and
     leave the card carrying just its label and an explanation. */
  function hideGraphPlot() {
    var scroller = document.querySelector(".gh-graph-scroll");
    if (scroller) scroller.hidden = true;
  }

  function loadGithub() {
    fetchJSON(API_BASE + "/api/github-stats?user=" + GITHUB_USER)
      .then(function (d) {
        renderCounts(d);
        if (d.weeks && d.weeks.length) {
          renderGraph(d.weeks, d.months);
          ghNote.textContent = d.stale
            ? "Showing the last good snapshot — GitHub is slow right now."
            : "Live from the GitHub API.";
        } else {
          hideGraphPlot();
          ghNote.textContent = "Contribution calendar needs a GITHUB_TOKEN on the server.";
        }
      })
      .catch(function () {
        /* Fallback: GitHub's public search API needs no token. It gives
           real PR counts (not the calendar, which is token-only). */
        var base = "https://api.github.com/search/issues?per_page=1&q=";
        var qs = [
          "author:" + GITHUB_USER + "+type:pr+is:merged",
          "author:" + GITHUB_USER + "+type:pr+is:open",
          "author:" + GITHUB_USER + "+type:pr+is:closed+is:unmerged"
        ];
        Promise.all(qs.map(function (q) { return fetchJSON(base + q, 6000); }))
          .then(function (res) {
            renderCounts({
              merged: res[0].total_count,
              open: res[1].total_count,
              closed: res[2].total_count
            });
            hideGraphPlot();
            ghNote.textContent = "Live from GitHub's public API — contribution calendar needs the server token.";
          })
          .catch(function () {
            hideGraphPlot();
            ghNote.textContent = "GitHub data is unavailable right now.";
          });
      });
  }

  /* ----------------------------------------------------------
     Copy-to-clipboard on the contact email
  ---------------------------------------------------------- */
  var copyBtn = document.getElementById("copyEmail");
  if (copyBtn && navigator.clipboard) {
    copyBtn.addEventListener("click", function () {
      navigator.clipboard.writeText(copyBtn.dataset.copy).then(function () {
        copyBtn.classList.add("is-copied");
        copyBtn.setAttribute("aria-label", "Email address copied");
        setTimeout(function () {
          copyBtn.classList.remove("is-copied");
          copyBtn.setAttribute("aria-label", "Copy email address");
        }, 1600);
      });
    });
  }

  /* ----------------------------------------------------------
     Contact form -> POST /api/contact -> SMTP

     Validated here for a fast, friendly response, and again on the
     server, which is the boundary that actually matters: this check
     is a convenience, not a control.
  ---------------------------------------------------------- */
  var form = document.getElementById("contactForm");
  if (form) {
    var cfStatus = document.getElementById("cfStatus");
    var cfSubmit = document.getElementById("cfSubmit");
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function say(msg, kind) {
      cfStatus.textContent = msg;
      cfStatus.className = "cf-status" + (kind ? " is-" + kind : "");
    }

    function markInvalid(el, bad) {
      if (bad) el.setAttribute("aria-invalid", "true");
      else el.removeAttribute("aria-invalid");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var message = form.message.value.trim();

      markInvalid(form.name, !name);
      markInvalid(form.email, !EMAIL_RE.test(email));
      markInvalid(form.message, message.length < 5);

      if (!name) return say("Your name, please.", "err");
      if (!EMAIL_RE.test(email)) return say("That email address doesn't look right.", "err");
      if (message.length < 5) return say("Tell me a little more than that.", "err");

      cfSubmit.disabled = true;
      var label = cfSubmit.textContent;
      cfSubmit.textContent = "sending…";
      say("");

      fetch(API_BASE + "/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name,
          email: email,
          message: message,
          website: form.website.value      // honeypot
        })
      })
        .then(function (r) {
          return r.json().then(function (body) { return { ok: r.ok, status: r.status, body: body }; });
        })
        .then(function (res) {
          if (res.ok) {
            form.reset();
            say("Sent — I'll get back to you soon.", "ok");
            return;
          }
          if (res.status === 429) {
            say("That's a few too many messages. Try again in a bit.", "err");
            return;
          }
          /* Surface the server's own reason when it gave one, so a
             misconfigured mailbox reads as a real problem rather
             than a generic failure. */
          say(res.body && res.body.error
            ? res.body.error
            : "Couldn't send that. Email me directly at tahleelshaikh404@gmail.com.", "err");
        })
        .catch(function () {
          say("Network problem. Email me directly at tahleelshaikh404@gmail.com.", "err");
        })
        .finally(function () {
          cfSubmit.disabled = false;
          cfSubmit.textContent = label;
        });
    });

    /* clear the error state as soon as the visitor starts fixing it */
    ["name", "email", "message"].forEach(function (f) {
      form[f].addEventListener("input", function () { markInvalid(form[f], false); });
    });
  }

  /* ----------------------------------------------------------
     Theme toggle (the paint-blocking restore lives in <head>)
  ---------------------------------------------------------- */
  var themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("portfolio-theme", next); } catch (e) {}
    });
  }

  /* ----------------------------------------------------------
     Particle field — spring-to-origin + cursor repulsion.
     Suspends when the hero scrolls away or the tab is hidden.
  ---------------------------------------------------------- */
  function initParticles() {
    if (REDUCED) return;
    var canvas = document.getElementById("particleCanvas");
    var hero = document.getElementById("home");
    if (!canvas || !hero) return;

    var ctx = canvas.getContext("2d", { alpha: true });
    var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var mouse = { x: -9999, y: -9999 };
    var running = false, visible = true, onScreen = true;

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    var COUNT = Math.min(60, Math.floor(window.innerWidth / 14));
    var particles = [];
    for (var i = 0; i < COUNT; i++) {
      var x = Math.random() * W, y = Math.random() * H;
      particles.push({
        x: x, y: y, ox: x, oy: y, vx: 0, vy: 0,
        r: 1.5 + Math.random() * 2,
        alpha: 0.15 + Math.random() * 0.25
      });
    }

    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    }, { passive: true });

    window.addEventListener("mousemove", function (e) {
      mouse.x = e.clientX; mouse.y = e.clientY;
    }, { passive: true });
    window.addEventListener("touchmove", function (e) {
      var t = e.touches[0];
      if (t) { mouse.x = t.clientX; mouse.y = t.clientY; }
    }, { passive: true });

    var REPEL = 120, SPRING = 0.04, DAMP = 0.88, FORCE = 5;
    var gold = getComputedStyle(document.documentElement)
      .getPropertyValue("--gold").trim() || "#D6A13A";

    function frame() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.vx += (p.ox - p.x) * SPRING;
        p.vy += (p.oy - p.y) * SPRING;

        var dx = p.x - mouse.x, dy = p.y - mouse.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < REPEL) {
          var f = ((REPEL - dist) / REPEL) * FORCE;
          p.vx += (dx / dist) * f;
          p.vy += (dy / dist) * f;
        }

        p.vx *= DAMP; p.vy *= DAMP;
        p.x += p.vx; p.y += p.vy;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = gold;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }

    function sync() {
      var should = visible && onScreen;
      if (should === running) return;
      running = should;
      if (running) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    }

    document.addEventListener("visibilitychange", function () {
      visible = !document.hidden;
      sync();
    });

    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      sync();
    }, { threshold: 0.01 }).observe(hero);

    sync();
  }

  /* ----------------------------------------------------------
     Boot
  ---------------------------------------------------------- */
  measure();
  requestFrame();
  loadGithub();

  var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 200); };
  idle(initParticles);

  /* The graph card grows the page; re-measure once it lands. */
  window.addEventListener("load", measure);
})();
