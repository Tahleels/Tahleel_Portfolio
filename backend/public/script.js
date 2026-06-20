// ============================================================
// CONFIG — point this at your deployed backend (see /backend)
// ============================================================
const API_BASE = window.PORTFOLIO_API_BASE || window.location.origin;
const GITHUB_USERNAME = "Tahleels";

// ============================================================
// DATA
// ============================================================
const PROJECTS = [
  {
    title: "AI Workflow Orchestrator",
    desc: "A centralized web platform for scheduling, monitoring, and managing automated bots through a conversational AI interface. Features real-time log viewing and a LangChain-powered chatbot for natural language orchestration.",
    tags: ["ReactJS", "Python Flask", "SQL", "LangChain", "OpenAI API"],
    demo: "https://github.com/Tahleels/Automation-Orchester", 
    repo: "https://github.com/Tahleels/Automation-Orchester"
  },
  {
    title: "Multi-Agent Database Reasoner",
    desc: "A sophisticated agentic system that reasons over databases using multiple interacting agents. Enables complex queries and analysis through cooperative AI agents.",
    tags: ["Python", "AI Agents", "Database", "Reasoning"],
    demo: "https://github.com/Tahleels/Multi-Agent-Database-Reasonings", 
    repo: "https://github.com/Tahleels/Multi-Agent-Database-Reasonings"
  },
  {
    title: "AWS Capstone Projects",
    desc: "A collection of comprehensive AWS architecture implementations, demonstrating proficiency in cloud deployment, serverless computing, and scalable infrastructure design.",
    tags: ["AWS", "Cloud Computing", "Architecture", "Serverless"],
    demo: "https://github.com/Tahleels/aws-capstone-projects", 
    repo: "https://github.com/Tahleels/aws-capstone-projects"
  }
];

const SKILLS = [
  ["Python","Language"], ["Java","Language"], ["C++","Language"], ["SQL","Query"],
  ["FastAPI","Backend"], ["Flask","Backend"], ["React","Frontend"], ["Next.js","Frontend"],
  ["LangChain","Agentic AI"], ["LangGraph","Agentic AI"], ["OpenAI","GenAI"], ["Gemini","GenAI"],
  ["AWS","Cloud"], ["Docker","Infra"], ["Git","Tooling"], ["Linux","Systems"], ["PostgreSQL","Database"]
];

const CERTS = [
  ["Machine Learning", "Coursera / Stanford"],
  ["AWS Certified", "Amazon Web Services"],
  ["IBM AI Engineering", "IBM"],
  ["Cloud Computing", "NPTEL"],
  ["Generative AI", "Google Cloud"]
];

// ============================================================
// PROJECT CARD VISUALS — generated SVG signatures, no images needed
// ============================================================
function projectSVG(i){
  const palette = ["#0A0A0A", "#D6A13A"];
  const seed = i * 37;
  let lines = "";
  for (let r = 0; r < 6; r++){
    const y = 20 + r * 24;
    const dash = (seed + r * 13) % 40;
    lines += `<line x1="0" y1="${y}" x2="400" y2="${y}" stroke="${palette[0]}" stroke-opacity="0.06" stroke-width="1"/>`;
  }
  const cx = 60 + (seed % 280);
  const cy = 60 + ((seed * 3) % 140);
  return `
  <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <rect width="400" height="220" fill="#F8F6F3"/>
    ${lines}
    <circle cx="${cx}" cy="${cy}" r="70" fill="none" stroke="#D6A13A" stroke-width="1.4" opacity="0.55"/>
    <circle cx="${cx}" cy="${cy}" r="2.5" fill="#D6A13A"/>
    <path d="M0 ${200 - (seed % 60)} Q 200 ${40 + (seed % 80)} 400 ${180 - (seed % 50)}" fill="none" stroke="#0A0A0A" stroke-width="1.2" opacity="0.18"/>
    <text x="20" y="200" font-family="IBM Plex Mono, monospace" font-size="13" fill="#0A0A0A" opacity="0.5">0${i + 1}</text>
  </svg>`;
}

// ============================================================
// RENDER: PROJECTS
// ============================================================
const grid = document.getElementById("projectGrid");
PROJECTS.forEach((p, i) => {
  const card = document.createElement("article");
  card.className = "project-card reveal";
  card.innerHTML = `
    <div class="project-visual">${projectSVG(i)}</div>
    <div class="project-body">
      <h3>${p.title}</h3>
      <p>${p.desc}</p>
      <div class="tag-row">${p.tags.map(t => `<span class="tag">${t}</span>`).join("")}</div>
      <div class="project-links">
        <a href="${p.demo}" target="_blank" rel="noopener">Live Demo →</a>
        <a href="${p.repo}" target="_blank" rel="noopener">GitHub →</a>
      </div>
    </div>`;
  grid.appendChild(card);
});

// ============================================================
// RENDER: SKILLS + CERTS
// ============================================================
const skillsGrid = document.getElementById("skillsGrid");
SKILLS.forEach(([name, meta]) => {
  const el = document.createElement("div");
  el.className = "skill-pill reveal";
  el.innerHTML = `<span class="skill-name">${name}</span><span class="skill-meta">${meta}</span>`;
  skillsGrid.appendChild(el);
});

const certsGrid = document.getElementById("certsGrid");
CERTS.forEach(([name, issuer]) => {
  const el = document.createElement("div");
  el.className = "cert-card reveal";
  el.innerHTML = `<h4>${name}</h4><span>${issuer}</span>`;
  certsGrid.appendChild(el);
});

// ============================================================
// SCROLL PROGRESS
// ============================================================
const progressBar = document.getElementById("scrollProgress");
function updateProgress(){
  const h = document.documentElement;
  const scrolled = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
  progressBar.style.width = scrolled + "%";
}
document.addEventListener("scroll", updateProgress, { passive: true });
updateProgress();

// ============================================================
// CUSTOM CURSOR
// ============================================================
const dot = document.getElementById("cursorDot");
const ring = document.getElementById("cursorRing");
let mx = 0, my = 0, rx = 0, ry = 0;
window.addEventListener("mousemove", e => {
  mx = e.clientX; my = e.clientY;
  dot.style.left = mx + "px"; dot.style.top = my + "px";
});
(function tickCursor(){
  rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
  ring.style.left = rx + "px"; ring.style.top = ry + "px";
  requestAnimationFrame(tickCursor);
})();
document.querySelectorAll("a,button,.skill-pill,.project-card").forEach(el => {
  el.addEventListener("mouseenter", () => ring.style.transform = "translate(-50%,-50%) scale(1.6)");
  el.addEventListener("mouseleave", () => ring.style.transform = "translate(-50%,-50%) scale(1)");
});

// ============================================================
// MAGNETIC BUTTONS
// ============================================================
document.querySelectorAll(".magnetic").forEach(btn => {
  btn.addEventListener("mousemove", e => {
    const r = btn.getBoundingClientRect();
    const x = e.clientX - r.left - r.width / 2;
    const y = e.clientY - r.top - r.height / 2;
    btn.style.transform = `translate(${x * 0.18}px, ${y * 0.35}px)`;
  });
  btn.addEventListener("mouseleave", () => btn.style.transform = "translate(0,0)");
});

// ============================================================
// SIDEBAR NAV — active section highlight
// ============================================================
const navLinks = document.querySelectorAll(".nav-link");
const navSectionIds = new Set(Array.from(navLinks).map(l => l.dataset.section));
const sections = document.querySelectorAll(".section");
const visibleRatios = new Map();

const navObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    visibleRatios.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
  });
  // pick the single most-visible section that actually has a nav entry
  let bestId = null, bestRatio = 0;
  visibleRatios.forEach((ratio, id) => {
    if (navSectionIds.has(id) && ratio > bestRatio){ bestRatio = ratio; bestId = id; }
  });
  if (bestId){
    navLinks.forEach(l => l.classList.toggle("active", l.dataset.section === bestId));
  }
}, { threshold: [0, 0.25, 0.5, 0.75, 1] });
sections.forEach(s => navObserver.observe(s));

// ============================================================
// MOBILE SIDEBAR TOGGLE
// ============================================================
const menuToggle = document.getElementById("menuToggle");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("sidebarOverlay");
function closeSidebar(){
  sidebar.classList.remove("open"); menuToggle.classList.remove("open"); overlay.classList.remove("show");
}
menuToggle.addEventListener("click", () => {
  const isOpen = sidebar.classList.toggle("open");
  menuToggle.classList.toggle("open", isOpen);
  overlay.classList.toggle("show", isOpen);
});
overlay.addEventListener("click", closeSidebar);
navLinks.forEach(l => l.addEventListener("click", closeSidebar));

// ============================================================
// GENERIC SCROLL REVEAL
// ============================================================
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting){
      entry.target.classList.add("in-view");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll(".reveal, .timeline-item").forEach(el => revealObserver.observe(el));

// timeline progress line
const timeline = document.querySelector(".timeline");
const timelineProgress = document.querySelector(".timeline-progress");
if (timeline && timelineProgress){
  document.addEventListener("scroll", () => {
    const rect = timeline.getBoundingClientRect();
    const viewH = window.innerHeight;
    const visible = Math.min(Math.max(viewH - rect.top, 0), rect.height);
    const pct = Math.min((visible / rect.height) * 100, 100);
    timelineProgress.style.height = pct + "%";
  }, { passive: true });
}

// ============================================================
// HERO COUNTERS
// ============================================================
const counters = document.querySelectorAll(".meta-num");
const counterObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting){
      const el = entry.target;
      const target = parseInt(el.dataset.count, 10);
      let cur = 0;
      const step = Math.max(target / 40, 1);
      const tick = () => {
        cur += step;
        if (cur >= target){ el.textContent = target; return; }
        el.textContent = Math.floor(cur);
        requestAnimationFrame(tick);
      };
      tick();
      counterObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });
counters.forEach(c => counterObserver.observe(c));

// ============================================================
// GITHUB STATS — tries the secured backend first (real PR /
// contribution data via GitHub GraphQL with a server-side token),
// falls back to the public REST API for repo/star counts only.
// ============================================================
async function loadGithubStats(){
  const note = document.getElementById("ghNote");
  try {
    const res = await fetch(`${API_BASE}/api/github-stats?user=${GITHUB_USERNAME}`);
    if (!res.ok) throw new Error("backend unavailable");
    const data = await res.json();
    renderGithubStats(data);
    note.textContent = "Live data via secured backend.";
  } catch (err) {
    // Fallback: public, unauthenticated REST call (limited data, no PR breakdown)
    try {
      const res = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100`);
      const repos = await res.json();
      const stars = Array.isArray(repos) ? repos.reduce((s, r) => s + (r.stargazers_count || 0), 0) : 0;
      renderGithubStats({
        merged: null, open: null, closed: null,
        repos: Array.isArray(repos) ? repos.length : null,
        stars, calendar: null
      });
      note.textContent = "Showing public repo data — connect the backend in /backend for live PR + contribution stats.";
    } catch (e2) {
      note.textContent = "GitHub data unavailable right now.";
    }
  }
}

function renderGithubStats(data){
  document.getElementById("ghMerged").textContent = data.merged ?? "—";
  document.getElementById("ghOpen").textContent = data.open ?? "—";
  document.getElementById("ghClosed").textContent = data.closed ?? "—";
  document.getElementById("ghRepos").textContent = data.repos ?? "—";
  document.getElementById("ghStars").textContent = data.stars ?? "—";

  const graph = document.getElementById("ghGraph");
  graph.innerHTML = "";
  const weeks = data.calendar && data.calendar.length ? data.calendar : buildPlaceholderCalendar();
  weeks.forEach(week => {
    week.forEach(level => {
      const cell = document.createElement("span");
      cell.className = "gh-cell";
      const colors = ["var(--bg-section)", "#f3dca0", "#e6bd5e", "#D6A13A", "#a87a23"];
      cell.style.background = colors[level] || colors[0];
      graph.appendChild(cell);
    });
  });
}

function buildPlaceholderCalendar(){
  const weeks = [];
  for (let w = 0; w < 52; w++){
    const week = [];
    for (let d = 0; d < 7; d++){
      const v = Math.abs(Math.sin(w * 0.7 + d * 1.3)) * 4;
      week.push(Math.round(v) % 5);
    }
    weeks.push(week);
  }
  return weeks;
}
loadGithubStats();

// ============================================================
// CONTACT FORM — posts to backend /api/contact
// ============================================================
const form = document.getElementById("contactForm");
const status = document.getElementById("formStatus");
const submitBtn = document.getElementById("contactSubmit");

form.addEventListener("submit", async e => {
  e.preventDefault();
  const payload = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    message: form.message.value.trim()
  };
  if (!payload.name || !payload.email || !payload.message){
    status.textContent = "Please fill in every field.";
    status.className = "form-status error";
    return;
  }

  submitBtn.textContent = "Sending…";
  submitBtn.disabled = true;
  status.textContent = "";
  status.className = "form-status";

  try {
    const res = await fetch(`${API_BASE}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Request failed");
    status.textContent = "Message sent — I'll get back to you soon.";
    status.className = "form-status success";
    form.reset();
  } catch (err) {
    status.textContent = "Couldn't reach the server — email me directly at tahleel.shaikh@example.com.";
    status.className = "form-status error";
  } finally {
    submitBtn.textContent = "Send Message";
    submitBtn.disabled = false;
  }
});

// ============================================================
// THEME TOGGLE (LIGHT / DARK)
// ============================================================
const themeToggle = document.getElementById("themeToggle");
const sunIcon = document.querySelector(".sun-icon");
const moonIcon = document.querySelector(".moon-icon");

// Check saved preference or system default
const savedTheme = localStorage.getItem("portfolio-theme");
const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const initialTheme = savedTheme ? savedTheme : (systemPrefersDark ? "dark" : "light");

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("portfolio-theme", theme);
  if (theme === "dark") {
    sunIcon.style.display = "block";
    moonIcon.style.display = "none";
  } else {
    sunIcon.style.display = "none";
    moonIcon.style.display = "block";
  }
}

// Initialize theme
setTheme(initialTheme);

themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  setTheme(currentTheme === "dark" ? "light" : "dark");
});
