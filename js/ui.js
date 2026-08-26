/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   ui.js - Architecture A

   Shared presentation/navigation layer.
   Classic script: all functions are global.
   No import/export syntax.
========================================================= */

const UI_SCREENS = ["homeScreen", "dashboardScreen", "practiceScreen", "completeScreen"];

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function qs(selector, root = document) { return root.querySelector(selector); }
function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
function text(value, fallback = "") { return value == null ? fallback : String(value); }
function getAppRoot() { return document.getElementById("app") || document.body; }

function setText(element, value) {
    const node = typeof element === "string" ? document.getElementById(element) : element;
    if (node) node.textContent = value ?? "";
}

function setHtml(element, html) {
    const node = typeof element === "string" ? document.getElementById(element) : element;
    if (node) node.innerHTML = html ?? "";
}

function show(element) {
    const node = typeof element === "string" ? document.getElementById(element) : element;
    if (!node) return;
    node.hidden = false;
    node.classList.remove("hidden", "is-hidden");
}

function hide(element) {
    const node = typeof element === "string" ? document.getElementById(element) : element;
    if (!node) return;
    node.hidden = true;
    node.classList.add("hidden");
}

function toggle(element, visible) { visible ? show(element) : hide(element); }
function addClass(element, ...classes) { if (element) element.classList.add(...classes.filter(Boolean)); }
function removeClass(element, ...classes) { if (element) element.classList.remove(...classes.filter(Boolean)); }
function toggleClass(element, name, force) { return element ? element.classList.toggle(name, force) : false; }

function navigateTo(view, options = {}) {
    const target = String(view || "home").replace(/Screen$/, "");
    const map = { home: "homeScreen", dashboard: "dashboardScreen", practice: "practiceScreen", complete: "completeScreen" };
    const screenId = map[target] || target;

    UI_SCREENS.forEach(id => {
        const screen = document.getElementById(id);
        if (!screen) return;
        const active = id === screenId;
        screen.classList.toggle("active", active);
        screen.hidden = !active;
    });

    if (typeof AppState !== "undefined") {
        AppState.previousView = AppState.currentView;
        AppState.currentView = target;
    }
    if (typeof setLastScreen === "function") {
        try { setLastScreen(target); } catch (_) {}
    }

    if (options.updateHash !== false) {
        const hash = `#${encodeURIComponent(target)}`;
        if (options.replace) history.replaceState({ view: target }, "", hash);
        else if (location.hash !== hash) history.pushState({ view: target }, "", hash);
    }

    window.dispatchEvent(new CustomEvent("dutchntrainer:navigate", { detail: { view: target } }));
    if (target === "dashboard" && typeof renderDashboard === "function") {
        renderDashboard().catch(error => console.error("Dashboard refresh failed", error));
    }
}

function getCurrentView(fallback = "home") {
    const hash = location.hash.replace(/^#/, "").trim();
    return hash ? decodeURIComponent(hash) : fallback;
}

function setActiveNav(key) {
    qsa("[data-nav]").forEach(element => {
        const active = element.dataset.nav === key;
        element.classList.toggle("active", active);
        element.classList.toggle("is-active", active);
        element.setAttribute("aria-current", active ? "page" : "false");
    });
    document.body.dataset.currentView = key || "";
}

function showToast(message, options = {}) {
    const type = typeof options === "string" ? options : (options.type || "info");
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "toast-container";
        container.setAttribute("aria-live", "polite");
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.textContent = String(message ?? "");
    container.appendChild(toast);
    window.setTimeout(() => toast.remove(), Number(options.duration) || 3200);
    return toast;
}

function showSuccess(message, options = {}) { return showToast(message, { ...options, type: "success" }); }
function showError(message, options = {}) { return showToast(message, { ...options, type: "error" }); }
function showWarning(message, options = {}) { return showToast(message, { ...options, type: "warning" }); }

function setLoading(element, loading, options = {}) {
    const node = typeof element === "string" ? document.getElementById(element) : element;
    if (!node) return;
    if (loading) {
        if (node.dataset.previousHtml === undefined) node.dataset.previousHtml = node.innerHTML;
        node.innerHTML = loadingHtml(options.text || "Loading…");
        node.setAttribute("aria-busy", "true");
    } else {
        if (node.dataset.previousHtml !== undefined) {
            node.innerHTML = node.dataset.previousHtml;
            delete node.dataset.previousHtml;
        }
        node.removeAttribute("aria-busy");
    }
}

function loadingHtml(message = "Loading…") {
    return `<div class="loading-state"><span class="loading-spinner" aria-hidden="true"></span><span>${escapeHtml(message)}</span></div>`;
}

function emptyStateHtml(options = {}) {
    if (typeof options === "string") options = { title: options };
    return `<div class="empty-state"><h3>${escapeHtml(options.title || "Nothing here yet")}</h3><p>${escapeHtml(options.message || "")}</p></div>`;
}

function errorStateHtml(options = {}) {
    if (typeof options === "string") options = { title: options };
    return `<div class="error-state"><h3>${escapeHtml(options.title || "Something went wrong")}</h3><p>${escapeHtml(options.message || "")}</p></div>`;
}

function setProgress(element, value) {
    const node = typeof element === "string" ? document.getElementById(element) : element;
    if (!node) return;
    const percent = Math.max(0, Math.min(100, Number(value) || 0));
    node.style.width = `${percent}%`;
    node.setAttribute("aria-valuenow", String(percent));
}

function openModal(id = "practiceModal") {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.hidden = false;
}

function closeModal(id = "practiceModal") {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add("hidden");
    modal.hidden = true;
}

function initNavigation() {
    navigateTo(getCurrentView("home"), { updateHash: false });
}

function initializeUI() {
    const bind = (id, handler) => {
        const element = document.getElementById(id);
        if (element) element.addEventListener("click", handler);
    };

    bind("quickPracticeBtn", () => {
        if (typeof startQuickPractice === "function") startQuickPractice();
        else if (typeof startPractice === "function") startPractice();
        else openModal();
    });
    bind("practiceSetupBtn", () => openModal());
    bind("dashboardBtn", () => navigateTo("dashboard"));
    bind("packsBtn", () => showToast("Word Packs are managed by the V2 pack/import layer."));
    bind("historyBtn", () => showToast("Practice history is stored in V2 sessions."));
    bind("settingsBtn", () => showToast("Settings are stored by storage.js."));
    bind("closePracticeModal", () => closeModal());
    bind("exitPracticeBtn", () => navigateTo("home"));
    bind("backDashboardBtn", () => navigateTo("dashboard"));
    bind("practiceAgainBtn", () => {
        if (typeof startPractice === "function") startPractice();
        else openModal();
    });

    qsa(".backBtn").forEach(button => button.addEventListener("click", () => navigateTo("home")));
    qsa(".countPreset").forEach(button => button.addEventListener("click", () => {
        const input = document.getElementById("customQuestionCount");
        if (input) input.value = button.dataset.value || "";
        qsa(".countPreset").forEach(item => item.classList.toggle("active", item === button));
    }));

    window.addEventListener("popstate", () => navigateTo(getCurrentView(), { updateHash: false }));
    window.addEventListener("hashchange", () => navigateTo(getCurrentView(), { updateHash: false }));
    navigateTo(getCurrentView("home"), { updateHash: false });
    return true;
}

const initUI = initializeUI;
