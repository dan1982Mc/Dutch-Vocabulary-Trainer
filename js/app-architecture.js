/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   app-architecture.js

   Architecture-A integration contract.

   This file contains only canonical cross-module adapters.
   It does not implement application logic.

   app.js owns application orchestration.
   dashboard.js owns dashboard calculations/rendering.
   practice.js owns practice sessions.
========================================================= */

/* ---------------------------------------------------------
   PRACTICE CONTRACT
--------------------------------------------------------- */

/* app.js calls startPracticeSession().
   Architecture A practice.js exposes DutchTrainerPractice.start(). */
window.startPracticeSession = async function (options = {}) {
    if (!window.DutchTrainerPractice || typeof window.DutchTrainerPractice.start !== "function") {
        throw new Error("Practice module is not available.");
    }

    const session = await window.DutchTrainerPractice.start(options);

    if (typeof setPracticeSession === "function") {
        setPracticeSession(session);
    }

    return session;
};

/* Explicit canonical alias for older application entry points. */
window.beginPractice = window.startPracticeSession;

/* app.js enters the Practice setup view through this contract. */
window.showPracticeSetup = function () {
    if (typeof openModal === "function") {
        openModal("practiceModal");
    }
};

/* Practice has no separate async initialization phase. */
window.initializePractice = function () {
    return true;
};

window.initPractice = window.initializePractice;

/* ---------------------------------------------------------
   DASHBOARD CONTRACT
--------------------------------------------------------- */

/* app.js refreshes the dashboard after practice/import events. */
window.refreshDashboard = async function () {
    if (typeof renderDashboard !== "function") {
        return null;
    }

    return await renderDashboard();
};

/* ---------------------------------------------------------
   PRACTICE COMPLETION / ANSWER EVENTS
--------------------------------------------------------- */

/* Keep application state synchronized with the practice owner. */
if (window.DutchTrainerPractice && typeof window.DutchTrainerPractice.on === "function") {
    window.DutchTrainerPractice.on("answer", result => {
        if (typeof notifyPracticeAnswer === "function") {
            notifyPracticeAnswer(result);
        }
    });

    window.DutchTrainerPractice.on("complete", session => {
        if (typeof notifyPracticeCompleted === "function") {
            notifyPracticeCompleted(session);
        }
    });
}
