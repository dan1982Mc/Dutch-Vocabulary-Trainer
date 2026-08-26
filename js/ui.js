/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   ui.js - shared presentation/navigation layer
========================================================= */

const UI_SCREENS = ["homeScreen", "dashboardScreen", "practiceScreen", "completeScreen"];
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function qs(selector, root = document) { return root.querySelector(selector); }
function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
function setText(element, value) { const node = typeof element === "string" ? document.getElementById(element) : element; if (node) node.textContent = value ?? ""; }
function setHtml(element, html) { const node = typeof element === "string" ? document.getElementById(element) : element; if (node) node.innerHTML = html ?? ""; }
function show(element) { const node = typeof element === "string" ? document.getElementById(element) : element; if (node) { node.hidden = false; node.classList.remove("hidden", "is-hidden"); } }
function hide(element) { const node = typeof element === "string" ? document.getElementById(element) : element; if (node) { node.hidden = true; node.classList.add("hidden"); } }
function toggle(element, visible) { visible ? show(element) : hide(element); }
function setProgress(element, value) { const node = typeof element === "string" ? document.getElementById(element) : element; if (!node) return; const percent = Math.max(0, Math.min(100, Number(value) || 0)); node.style.width = `${percent}%`; node.setAttribute("aria-valuenow", String(percent)); }
function showToast(message, options = {}) { const type = typeof options === "string" ? options : (options.type || "info"); let container = document.getElementById("toast-container"); if (!container) { container = document.createElement("div"); container.id = "toast-container"; container.className = "toast-container"; document.body.appendChild(container); } const toast = document.createElement("div"); toast.className = `toast toast-${type}`; toast.textContent = String(message ?? ""); container.appendChild(toast); setTimeout(() => toast.remove(), Number(options.duration) || 3200); return toast; }
function showError(message) { return showToast(message, "error"); }
function showSuccess(message) { return showToast(message, "success"); }
function openModal(id = "practiceModal") { const modal = document.getElementById(id); if (modal) { modal.classList.remove("hidden"); modal.hidden = false; } }
function closeModal(id = "practiceModal") { const modal = document.getElementById(id); if (modal) { modal.classList.add("hidden"); modal.hidden = true; } }

function navigateTo(view, options = {}) {
    const target = String(view || "home").replace(/Screen$/, "").toLowerCase();
    const map = { home: "homeScreen", dashboard: "dashboardScreen", practice: "practiceScreen", complete: "completeScreen" };
    const screenId = map[target];
    if (!screenId) return false;
    UI_SCREENS.forEach(id => { const screen = document.getElementById(id); if (screen) { const active = id === screenId; screen.classList.toggle("active", active); screen.hidden = !active; } });
    if (typeof AppState !== "undefined") { AppState.previousView = AppState.currentView; AppState.currentView = target; }
    if (typeof setLastScreen === "function") { try { setLastScreen(target); } catch (_) {} }
    if (options.updateHash !== false && location.hash !== `#${target}`) history.pushState({ view: target }, "", `#${target}`);
    window.dispatchEvent(new CustomEvent("dutchntrainer:navigate", { detail: { view: target } }));
    if (target === "dashboard" && typeof renderDashboard === "function") Promise.resolve(renderDashboard()).catch(console.error);
    return true;
}
function getCurrentView(fallback = "home") { const hash = location.hash.replace(/^#/, "").trim(); return hash ? decodeURIComponent(hash) : fallback; }

function renderPracticeQuestion(question) {
    if (!question) return;
    setText("practiceTitle", "Practice");
    setText("practiceSubtitle", `${question.type} · ${question.word?.word || question.word?.dutch || ""}`);
    setText("exerciseBadge", question.type);
    setText("questionPrompt", question.exercise?.prompt || "");
    setText("questionContext", question.exercise?.instruction || question.exercise?.context || "");
    const area = document.getElementById("answerArea");
    if (!area) return;
    const type = question.exercise?.inputType || (question.type === "choose" ? "choice" : "text");
    if (type === "choice" && Array.isArray(question.exercise?.choices)) {
        area.innerHTML = question.exercise.choices.map(choice => `<button type="button" class="choiceOption" data-answer="${escapeHtml(choice)}">${escapeHtml(choice)}</button>`).join("");
        area.querySelectorAll(".choiceOption").forEach(button => button.addEventListener("click", () => { area.querySelectorAll(".choiceOption").forEach(b => b.classList.remove("selected")); button.classList.add("selected"); }));
    } else {
        area.innerHTML = `<input id="practiceAnswerInput" type="text" autocomplete="off" aria-label="Answer">`;
        area.querySelector("input")?.focus();
    }
    setText("feedbackArea", "");
    document.getElementById("checkBtn")?.classList.remove("hidden");
    document.getElementById("nextBtn")?.classList.add("hidden");
    setText("sessionCounter", `${(PracticeState?.currentIndex ?? 0) + 1}/${PracticeState?.questions?.length ?? 0}`);
}
function getPracticeUIAnswer() { const selected = document.querySelector(".choiceOption.selected"); if (selected) return selected.dataset.answer; return document.getElementById("practiceAnswerInput")?.value ?? ""; }
function renderCurrentPracticeFeedback(result) { if (!result) return; setText("feedbackArea", result.feedback?.correct ? "Correct!" : `Correct answer: ${result.feedback?.correctAnswer || ""}`); document.getElementById("checkBtn")?.classList.add("hidden"); document.getElementById("nextBtn")?.classList.remove("hidden"); }

function initializeUI() {
    const bind = (id, handler) => { const element = document.getElementById(id); if (element) element.addEventListener("click", handler); };
    bind("quickPracticeBtn", () => Promise.resolve(typeof startQuickPractice === "function" ? startQuickPractice() : openModal()).catch(error => showError(error.message || error)));
    bind("practiceSetupBtn", () => openModal());
    bind("startPracticeBtn", () => Promise.resolve(typeof startConfiguredPractice === "function" ? startConfiguredPractice() : null).catch(error => showError(error.message || error)));
    bind("dashboardBtn", () => navigateTo("dashboard"));
    bind("packsBtn", () => showToast("Word Packs are managed by the V2 pack/import layer."));
    bind("historyBtn", () => showToast("Practice history is stored in V2 sessions."));
    bind("settingsBtn", () => showToast("Settings are stored by storage.js."));
    bind("closePracticeModal", () => closeModal());
    bind("exitPracticeBtn", () => navigateTo("home"));
    bind("backDashboardBtn", () => navigateTo("dashboard"));
    bind("checkBtn", () => Promise.resolve(typeof startPracticeAnswer === "function" ? startPracticeAnswer(getPracticeUIAnswer()) : null).catch(error => showError(error.message || error)));
    bind("nextBtn", () => Promise.resolve(typeof goToNextPracticeQuestion === "function" ? goToNextPracticeQuestion() : null).catch(error => showError(error.message || error)));
    bind("practiceAgainBtn", () => { navigateTo("practice"); if (typeof startPractice === "function") Promise.resolve(startPractice()).catch(error => showError(error.message || error)); });
    qsa(".backBtn").forEach(button => button.addEventListener("click", () => navigateTo("home")));
    qsa(".countPreset").forEach(button => button.addEventListener("click", () => { const input = document.getElementById("customQuestionCount"); if (input) input.value = button.dataset.value || ""; qsa(".countPreset").forEach(item => item.classList.toggle("active", item === button)); }));
    window.addEventListener("popstate", () => navigateTo(getCurrentView(), { updateHash: false }));
    window.addEventListener("hashchange", () => navigateTo(getCurrentView(), { updateHash: false }));
    window.addEventListener("practice-start", event => { if (event.detail?.question) renderPracticeQuestion(event.detail.question); });
    navigateTo(getCurrentView("home"), { updateHash: false });
    return true;
}
const initUI = initializeUI;
