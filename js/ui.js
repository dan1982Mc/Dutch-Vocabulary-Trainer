/* ============================================================
   Dutch Trainer v2.0
   js/ui.js

   Shared UI utilities.

   Responsibilities:
   - Navigation
   - View switching
   - Toast notifications
   - Modal dialogs
   - Loading states
   - Empty/error states
   - Progress bars
   - Answer feedback
   - Practice completion UI
   - Selection summary UI
   - Safe HTML helpers
   - Small reusable DOM helpers

   This file intentionally contains presentation logic only.
   Database, mastery, selection and scheduling logic remain in
   their dedicated modules.
   ============================================================ */


/* ============================================================
   CONSTANTS
   ============================================================ */

const NAV_ITEMS = {
    home: "Home",
    practice: "Practice",
    dashboard: "Dashboard",
    vocabulary: "Vocabulary",
    import: "Import"
};

const TOAST_DURATION = 3200;

let toastTimer = null;
let activeModal = null;


/* ============================================================
   HTML SAFETY
   ============================================================ */

/**
 * Escape arbitrary text before inserting it into HTML.
 */
export function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/**
 * Escape an attribute value.
 */
export function escapeAttribute(value) {
    return escapeHtml(value);
}


/**
 * Convert a value to a safe text string.
 */
export function text(value, fallback = "") {
    if (
        value === null ||
        value === undefined
    ) {
        return fallback;
    }

    return String(value);
}


/* ============================================================
   DOM HELPERS
   ============================================================ */

export function qs(
    selector,
    root = document
) {
    return root.querySelector(selector);
}


export function qsa(
    selector,
    root = document
) {
    return Array.from(
        root.querySelectorAll(selector)
    );
}


export function createElement(
    tag,
    className = "",
    content = ""
) {
    const element =
        document.createElement(tag);

    if (className) {
        element.className =
            className;
    }

    if (content !== "") {
        element.innerHTML =
            content;
    }

    return element;
}


export function clearElement(element) {
    if (!element) {
        return;
    }

    element.innerHTML = "";
}


export function show(element) {
    if (!element) {
        return;
    }

    element.hidden = false;

    element.classList.remove(
        "is-hidden"
    );
}


export function hide(element) {
    if (!element) {
        return;
    }

    element.hidden = true;

    element.classList.add(
        "is-hidden"
    );
}


export function toggle(
    element,
    visible
) {
    if (visible) {
        show(element);
    } else {
        hide(element);
    }
}


export function setText(
    element,
    value
) {
    if (!element) {
        return;
    }

    element.textContent =
        value ?? "";
}


export function setHtml(
    element,
    html
) {
    if (!element) {
        return;
    }

    element.innerHTML =
        html ?? "";
}


export function addClass(
    element,
    ...classes
) {
    if (!element) {
        return;
    }

    element.classList.add(
        ...classes.filter(Boolean)
    );
}


export function removeClass(
    element,
    ...classes
) {
    if (!element) {
        return;
    }

    element.classList.remove(
        ...classes.filter(Boolean)
    );
}


export function toggleClass(
    element,
    className,
    force
) {
    if (!element) {
        return false;
    }

    return element.classList.toggle(
        className,
        force
    );
}


/* ============================================================
   APPLICATION ROOT
   ============================================================ */

export function getAppRoot() {
    return (
        document.querySelector(
            "#app"
        ) ||
        document.querySelector(
            "[data-app]"
        ) ||
        document.body
    );
}


/* ============================================================
   NAVIGATION
   ============================================================ */

/**
 * Set active navigation item.
 */
export function setActiveNav(
    key
) {
    qsa(
        "[data-nav]"
    ).forEach(
        element => {
            const active =
                element.dataset.nav ===
                key;

            toggleClass(
                element,
                "active",
                active
            );

            toggleClass(
                element,
                "is-active",
                active
            );

            element.setAttribute(
                "aria-current",
                active
                    ? "page"
                    : "false"
            );
        }
    );

    document.body.dataset.currentView =
        key ?? "";
}


/**
 * Navigate to a view.

   Supports either:

   data-view="practice"

   or

   data-route="practice"
 */
export function navigateTo(
    view,
    {
        updateHash = true,
        replace = false
    } = {}
) {
    if (!view) {
        return;
    }

    setActiveNav(view);

    qsa(
        "[data-view]"
    ).forEach(
        section => {
            const visible =
                section.dataset.view ===
                view;

            toggle(
                section,
                visible
            );
        }
    );

    qsa(
        "[data-page]"
    ).forEach(
        section => {
            const visible =
                section.dataset.page ===
                view;

            toggle(
                section,
                visible
            );
        }
    );

    if (updateHash) {
        const hash =
            `#${encodeURIComponent(view)}`;

        if (replace) {
            history.replaceState(
                { view },
                "",
                hash
            );
        } else {
            history.pushState(
                { view },
                "",
                hash
            );
        }
    }

    window.dispatchEvent(
        new CustomEvent(
            "dutchntrainer:navigate",
            {
                detail: {
                    view
                }
            }
        )
    );
}


/**
 * Read current view from URL.
 */
export function getCurrentView(
    fallback = "home"
) {
    const hash =
        window.location.hash
            .replace(/^#/, "")
            .trim();

    if (!hash) {
        return fallback;
    }

    return decodeURIComponent(
        hash
    );
}


/**
 * Initialize hash navigation.
 */
export function initNavigation({
    defaultView = "home"
} = {}) {
    const initial =
        getCurrentView(
            defaultView
        );

    navigateTo(
        initial,
        {
            updateHash: false
        }
    );

    document.addEventListener(
        "click",
        event => {
            const target =
                event.target.closest(
                    "[data-nav], [data-route]"
                );

            if (!target) {
                return;
            }

            const view =
                target.dataset.nav ??
                target.dataset.route;

            if (!view) {
                return;
            }

            event.preventDefault();

            navigateTo(view);
        }
    );

    window.addEventListener(
        "popstate",
        () => {
            navigateTo(
                getCurrentView(
                    defaultView
                ),
                {
                    updateHash: false
                }
            );
        }
    );

    window.addEventListener(
        "hashchange",
        () => {
            navigateTo(
                getCurrentView(
                    defaultView
                ),
                {
                    updateHash: false
                }
            );
        }
    );
}


/* ============================================================
   TOASTS
   ============================================================ */

function ensureToastContainer() {
    let container =
        document.querySelector(
            "#toast-container"
        );

    if (container) {
        return container;
    }

    container =
        document.createElement(
            "div"
        );

    container.id =
        "toast-container";

    container.className =
        "toast-container";

    container.setAttribute(
        "aria-live",
        "polite"
    );

    container.setAttribute(
        "aria-atomic",
        "true"
    );

    document.body.appendChild(
        container
    );

    return container;
}


export function showToast(
    message,
    {
        type = "info",
        duration = TOAST_DURATION,
        title = ""
    } = {}
) {
    const container =
        ensureToastContainer();

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        `toast toast-${type}`;

    toast.setAttribute(
        "role",
        type === "error"
            ? "alert"
            : "status"
    );

    toast.innerHTML = `
        ${
            title
                ? `
                    <div class="toast-title">
                        ${escapeHtml(title)}
                    </div>
                `
                : ""
        }

        <div class="toast-message">
            ${escapeHtml(message)}
        </div>

        <button
            type="button"
            class="toast-close"
            aria-label="Close notification"
        >
            ×
        </button>
    `;

    container.appendChild(
        toast
    );

    const close =
        () => {
            toast.classList.add(
                "is-closing"
            );

            window.setTimeout(
                () => toast.remove(),
                200
            );
        };

    toast.querySelector(
        ".toast-close"
    )?.addEventListener(
        "click",
        close
    );

    if (duration > 0) {
        window.setTimeout(
            close,
            duration
        );
    }

    return toast;
}


export function showSuccess(
    message,
    options = {}
) {
    return showToast(
        message,
        {
            ...options,
            type: "success"
        }
    );
}


export function showError(
    message,
    options = {}
) {
    return showToast(
        message,
        {
            ...options,
            type: "error"
        }
    );
}


export function showWarning(
    message,
    options = {}
) {
    return showToast(
        message,
        {
            ...options,
            type: "warning"
        }
    );
}


/* ============================================================
   LOADING UI
   ============================================================ */

export function setLoading(
    element,
    loading,
    {
        text = "Loading…"
    } = {}
) {
    if (!element) {
        return;
    }

    if (loading) {
        element.dataset.previousHtml =
            element.innerHTML;

        element.innerHTML = `
            <div class="loading-state">
                <span
                    class="loading-spinner"
                    aria-hidden="true"
                ></span>

                <span>
                    ${escapeHtml(text)}
                </span>
            </div>
        `;

        element.setAttribute(
            "aria-busy",
            "true"
        );

        element.classList.add(
            "is-loading"
        );

    } else {
        if (
            element.dataset.previousHtml !==
            undefined
        ) {
            element.innerHTML =
                element.dataset.previousHtml;

            delete element.dataset
                .previousHtml;
        }

        element.removeAttribute(
            "aria-busy"
        );

        element.classList.remove(
            "is-loading"
        );
    }
}


export function loadingHtml(
    message = "Loading…"
) {
    return `
        <div class="loading-state">
            <span
                class="loading-spinner"
                aria-hidden="true"
            ></span>

            <span>
                ${escapeHtml(message)}
            </span>
        </div>
    `;
}


/* ============================================================
   EMPTY / ERROR STATES
   ============================================================ */

export function emptyStateHtml({
    title = "Nothing here yet",
    message = "",
    actionLabel = "",
    action = ""
} = {}) {
    return `
        <div class="empty-state">

            <div class="empty-state-icon">
                <span aria-hidden="true">○</span>
            </div>

            <h3>
                ${escapeHtml(title)}
            </h3>

            ${
                message
                    ? `
                        <p>
                            ${escapeHtml(message)}
                        </p>
                    `
                    : ""
            }

            ${
                actionLabel
                    ? `
                        <button
                            type="button"
                            class="button button-primary"
                            ${
                                action
                                    ? `data-action="${escapeAttribute(action)}"`
                                    : ""
                            }
                        >
                            ${escapeHtml(actionLabel)}
                        </button>
                    `
                    : ""
            }

        </div>
    `;
}


export function errorStateHtml({
    title = "Something went wrong",
    message = "Please try again.",
    actionLabel = "Try Again",
    action = "retry"
} = {}) {
    return `
        <div class="error-state">

            <div class="error-state-icon">
                !
            </div>

            <h3>
                ${escapeHtml(title)}
            </h3>

            <p>
                ${escapeHtml(message)}
            </p>

            ${
                actionLabel
                    ? `
                        <button
                            type="button"
                            class="button button-primary"
                            data-action="${escapeAttribute(action)}"
                        >
                            ${escapeHtml(actionLabel)}
                        </button>
                    `
                    : ""
            }

        </div>
    `;
}


/* ============================================================
   MODALS
   ============================================================ */

function removeActiveModal() {
    if (!activeModal) {
        return;
    }

    activeModal.remove();
    activeModal = null;

    document.body.classList.remove(
        "modal-open"
    );
}


export function closeModal() {
    removeActiveModal();
}


export function showModal({
    title = "",
    content = "",
    buttons = [],
    closeOnBackdrop = true,
    closeOnEscape = true,
    className = ""
} = {}) {
    removeActiveModal();

    const overlay =
        document.createElement(
            "div"
        );

    overlay.className =
        `modal-overlay ${className}`
            .trim();

    overlay.innerHTML = `
        <div
            class="modal"
            role="dialog"
            aria-modal="true"
            aria-label="${escapeAttribute(title)}"
        >

            <div class="modal-header">

                <h2 class="modal-title">
                    ${escapeHtml(title)}
                </h2>

                <button
                    type="button"
                    class="modal-close"
                    aria-label="Close"
                >
                    ×
                </button>

            </div>

            <div class="modal-body">
                ${content}
            </div>

            ${
                buttons.length
                    ? `
                        <div class="modal-footer">
                            ${buttons.map(
                                button => `
                                    <button
                                        type="button"
                                        class="${
                                            button.className ??
                                            "button button-secondary"
                                        }"
                                        data-modal-button="${
                                            escapeAttribute(
                                                button.id ??
                                                ""
                                            )
                                        }"
                                    >
                                        ${escapeHtml(
                                            button.label ??
                                            "OK"
                                        )}
                                    </button>
                                `
                            ).join("")}
                        </div>
                    `
                    : ""
            }

        </div>
    `;

    document.body.appendChild(
        overlay
    );

    activeModal =
        overlay;

    document.body.classList.add(
        "modal-open"
    );

    overlay.querySelector(
        ".modal-close"
    )?.addEventListener(
        "click",
        closeModal
    );

    if (closeOnBackdrop) {
        overlay.addEventListener(
            "click",
            event => {
                if (
                    event.target ===
                    overlay
                ) {
                    closeModal();
                }
            }
        );
    }

    if (closeOnEscape) {
        const keyHandler =
            event => {
                if (
                    event.key ===
                    "Escape"
                ) {
                    closeModal();

                    document.removeEventListener(
                        "keydown",
                        keyHandler
                    );
                }
            };

        document.addEventListener(
            "keydown",
            keyHandler
        );
    }

    for (const button of buttons) {
        const element =
            overlay.querySelector(
                `[data-modal-button="${CSS.escape(
                    button.id ?? ""
                )}"]`
            );

        element?.addEventListener(
            "click",
            async () => {
                if (
                    typeof button.onClick ===
                    "function"
                ) {
                    await button.onClick();
                }
            }
        );
    }

    return overlay;
}


/**
 * Confirmation modal.
 */
export function confirmModal({
    title = "Are you sure?",
    message = "",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    danger = false
} = {}) {
    return new Promise(
        resolve => {
            let settled = false;

            const finish =
                value => {
                    if (settled) {
                        return;
                    }

                    settled = true;

                    closeModal();

                    resolve(value);
                };

            showModal({
                title,

                content: `
                    <p>
                        ${escapeHtml(message)}
                    </p>
                `,

                buttons: [
                    {
                        id: "cancel",
                        label: cancelLabel,
                        className:
                            "button button-secondary",

                        onClick: () =>
                            finish(false)
                    },

                    {
                        id: "confirm",
                        label: confirmLabel,

                        className:
                            danger
                                ? "button button-danger"
                                : "button button-primary",

                        onClick: () =>
                            finish(true)
                    }
                ]
            });
        }
    );
}


/* ============================================================
   PROGRESS BARS
   ============================================================ */

export function progressHtml(
    value,
    {
        max = 100,
        label = "",
        showValue = true,
        className = ""
    } = {}
) {
    const numericValue =
        Number(value) || 0;

    const numericMax =
        Number(max) || 100;

    const percent =
        Math.max(
            0,
            Math.min(
                100,
                (
                    numericValue /
                    numericMax
                ) * 100
            )
        );

    return `
        <div
            class="progress ${className}"
            data-progress="${Math.round(percent)}"
        >

            ${
                label || showValue
                    ? `
                        <div class="progress-header">

                            ${
                                label
                                    ? `
                                        <span>
                                            ${escapeHtml(label)}
                                        </span>
                                    `
                                    : "<span></span>"
                            }

                            ${
                                showValue
                                    ? `
                                        <strong>
                                            ${Math.round(percent)}%
                                        </strong>
                                    `
                                    : ""
                            }

                        </div>
                    `
                    : ""
            }

            <div class="progress-track">
                <div
                    class="progress-fill"
                    style="width:${percent}%"
                ></div>
            </div>

        </div>
    `;
}


export function setProgress(
    element,
    value,
    max = 100
) {
    if (!element) {
        return;
    }

    const numericValue =
        Number(value) || 0;

    const numericMax =
        Number(max) || 100;

    const percent =
        Math.max(
            0,
            Math.min(
                100,
                (
                    numericValue /
                    numericMax
                ) * 100
            )
        );

    const fill =
        element.querySelector(
            ".progress-fill"
        );

    if (fill) {
        fill.style.width =
            `${percent}%`;
    }

    const valueElement =
        element.querySelector(
            ".progress-header strong"
        );

    if (valueElement) {
        valueElement.textContent =
            `${Math.round(percent)}%`;
    }

    element.dataset.progress =
        String(Math.round(percent));
}


/* ============================================================
   PRACTICE PROGRESS
   ============================================================ */

export function practiceProgressHtml({
    current = 0,
    total = 0
} = {}) {
    const safeTotal =
        Math.max(
            0,
            Number(total) || 0
        );

    const safeCurrent =
        Math.max(
            0,
            Math.min(
                safeTotal,
                Number(current) || 0
            )
        );

    return `
        <div
            class="practice-progress"
            aria-label="Practice progress"
        >

            <div class="practice-progress-header">

                <span>
                    Question
                </span>

                <strong>
                    ${safeCurrent}
                    /
                    ${safeTotal}
                </strong>

            </div>

            <div class="progress-track">
                <div
                    class="progress-fill"
                    style="width:${
                        safeTotal
                            ? (
                                safeCurrent /
                                safeTotal
                            ) * 100
                            : 0
                    }%"
                ></div>
            </div>

        </div>
    `;
}


/* ============================================================
   ANSWER FEEDBACK
   ============================================================ */

/**
 * Render feedback after every answer.

   The practice engine can pass:

   {
       correct: true,
       message: "...",
       expectedAnswer: "...",
       userAnswer: "...",
       explanation: "..."
   }
 */
export function answerFeedbackHtml({
    correct = false,
    message = "",
    expectedAnswer = "",
    userAnswer = "",
    explanation = "",
    showExpected = true
} = {}) {
    const status =
        correct
            ? "correct"
            : "incorrect";

    const title =
        correct
            ? "Correct"
            : "Not quite";

    return `
        <div
            class="answer-feedback answer-feedback-${status}"
            data-answer-feedback="${status}"
            role="status"
            aria-live="polite"
        >

            <div class="answer-feedback-header">

                <span
                    class="answer-feedback-icon"
                    aria-hidden="true"
                >
                    ${
                        correct
                            ? "✓"
                            : "!"
                    }
                </span>

                <strong>
                    ${title}
                </strong>

            </div>

            ${
                message
                    ? `
                        <p class="answer-feedback-message">
                            ${escapeHtml(message)}
                        </p>
                    `
                    : ""
            }

            ${
                !correct &&
                showExpected &&
                expectedAnswer
                    ? `
                        <div class="answer-feedback-answer">
                            <span>Expected answer</span>

                            <strong>
                                ${escapeHtml(
                                    expectedAnswer
                                )}
                            </strong>
                        </div>
                    `
                    : ""
            }

            ${
                userAnswer
                    ? `
                        <div class="answer-feedback-answer">
                            <span>Your answer</span>

                            <strong>
                                ${escapeHtml(
                                    userAnswer
                                )}
                            </strong>
                        </div>
                    `
                    : ""
            }

            ${
                explanation
                    ? `
                        <div class="answer-feedback-explanation">
                            ${escapeHtml(
                                explanation
                            )}
                        </div>
                    `
                    : ""
            }

        </div>
    `;
}


/**
 * Insert feedback into a container.
 */
export function renderAnswerFeedback(
    container,
    feedback
) {
    if (!container) {
        return;
    }

    container.innerHTML =
        answerFeedbackHtml(
            feedback
        );

    container.classList.add(
        "has-feedback"
    );
}


/* ============================================================
   MASTERY FEEDBACK
   ============================================================ */

export function masteryChangeHtml({
    previousLevel = 0,
    newLevel = 0,
    levelName = "",
    changed = false
} = {}) {
    if (!changed) {
        return "";
    }

    const direction =
        newLevel > previousLevel
            ? "up"
            : "down";

    return `
        <div
            class="mastery-change mastery-change-${direction}"
        >
            ${
                newLevel > previousLevel
                    ? "Mastery increased"
                    : "Mastery changed"
            }

            ${
                levelName
                    ? `
                        <strong>
                            ${escapeHtml(levelName)}
                        </strong>
                    `
                    : ""
            }
        </div>
    `;
}


/* ============================================================
   PRACTICE COMPLETION
   ============================================================ */

/**
 * Completion UI.

   Important:
   completion buttons are deliberately wrapped in a dedicated
   flex container so they have proper spacing regardless of the
   global button CSS.
 */
export function practiceCompletionHtml({
    correct = 0,
    total = 0,
    accuracy = null,
    onContinue = "continue",
    onPracticeAgain = "practice-again",
    onDashboard = "dashboard"
} = {}) {
    const safeTotal =
        Math.max(
            0,
            Number(total) || 0
        );

    const safeCorrect =
        Math.max(
            0,
            Number(correct) || 0
        );

    const calculatedAccuracy =
        accuracy !== null
            ? Number(accuracy)
            : safeTotal
                ? (
                    safeCorrect /
                    safeTotal
                ) * 100
                : 0;

    return `
        <section
            class="practice-complete"
            data-practice-complete
        >

            <div class="practice-complete-icon">
                ✓
            </div>

            <h2>
                Practice Complete
            </h2>

            <p>
                You completed
                <strong>${safeTotal}</strong>
                question${safeTotal === 1 ? "" : "s"}.
            </p>

            <div class="practice-result-summary">

                <div class="practice-result-stat">
                    <span>Correct</span>
                    <strong>
                        ${safeCorrect}
                    </strong>
                </div>

                <div class="practice-result-stat">
                    <span>Accuracy</span>
                    <strong>
                        ${Math.round(
                            calculatedAccuracy
                        )}%
                    </strong>
                </div>

            </div>

            <div class="practice-complete-actions">

                <button
                    type="button"
                    class="button button-primary"
                    data-action="${escapeAttribute(onContinue)}"
                >
                    Continue
                </button>

                <button
                    type="button"
                    class="button button-secondary"
                    data-action="${escapeAttribute(onPracticeAgain)}"
                >
                    Practice Again
                </button>

                <button
                    type="button"
                    class="button button-secondary"
                    data-action="${escapeAttribute(onDashboard)}"
                >
                    Dashboard
                </button>

            </div>

        </section>
    `;
}


/* ============================================================
   SELECTION SUMMARY
   ============================================================ */

export function selectionSummaryHtml({
    total = 0,
    all = false,
    packCount = 0,
    newCount = 0,
    weakCount = 0,
    dueCount = 0
} = {}) {
    if (all) {
        return `
            <div class="selection-summary">

                <strong>
                    All vocabulary
                </strong>

                <span>
                    ${Number(total) || 0} words
                </span>

            </div>
        `;
    }

    return `
        <div class="selection-summary">

            <strong>
                ${Number(total) || 0}
                selected
            </strong>

            <div class="selection-summary-details">

                ${
                    packCount
                        ? `
                            <span>
                                ${packCount}
                                pack${packCount === 1 ? "" : "s"}
                            </span>
                        `
                        : ""
                }

                ${
                    newCount
                        ? `
                            <span>
                                ${newCount}
                                new
                            </span>
                        `
                        : ""
                }

                ${
                    weakCount
                        ? `
                            <span>
                                ${weakCount}
                                weak
                            </span>
                        `
                        : ""
                }

                ${
                    dueCount
                        ? `
                            <span>
                                ${dueCount}
                                due
                            </span>
                        `
                        : ""
                }

            </div>

        </div>
    `;
}


/* ============================================================
   VOCABULARY BADGES
   ============================================================ */

export function masteryBadge(
    level,
    label = ""
) {
    const numericLevel =
        Number(level) || 0;

    const names = {
        0: "New",
        1: "Learning",
        2: "Familiar",
        3: "Mastered"
    };

    const name =
        label ||
        names[numericLevel] ||
        "New";

    return `
        <span
            class="mastery-badge mastery-level-${numericLevel}"
        >
            ${escapeHtml(name)}
        </span>
    `;
}


export function statusBadge(
    label,
    type = "neutral"
) {
    return `
        <span
            class="status-badge status-${escapeAttribute(type)}"
        >
            ${escapeHtml(label)}
        </span>
    `;
}


/* ============================================================
   EXERCISE BADGE
   ============================================================ */

export function exerciseBadge(
    type,
    label = ""
) {
    const labels = {
        meaning: "Meaning",
        recall: "Recall",
        fillSentence: "Fill Sentence",
        chooseWord: "Choose Word",
        production: "Production",
        mixed: "Mixed"
    };

    return `
        <span
            class="exercise-badge exercise-${escapeAttribute(type)}"
        >
            ${escapeHtml(
                label ||
                labels[type] ||
                type
            )}
        </span>
    `;
}


/* ============================================================
   KEYBOARD / ENTER HANDLING
   ============================================================ */

/**
 * Install the two-stage Enter behavior required by v2.0.

   First Enter:
       Check Answer

   Second Enter:
       Next Question

   The practice module controls the actual actions by supplying
   callbacks.
 */
export function bindPracticeEnter({
    input,
    checkAnswer,
    nextQuestion,
    isAnswered
} = {}) {
    if (!input) {
        return () => {};
    }

    const handler =
        event => {
            if (
                event.key !==
                "Enter"
            ) {
                return;
            }

            if (
                event.isComposing
            ) {
                return;
            }

            event.preventDefault();

            const answered =
                typeof isAnswered ===
                "function"
                    ? isAnswered()
                    : false;

            if (answered) {
                if (
                    typeof nextQuestion ===
                    "function"
                ) {
                    nextQuestion();
                }
            } else {
                if (
                    typeof checkAnswer ===
                    "function"
                ) {
                    checkAnswer();
                }
            }
        };

    input.addEventListener(
        "keydown",
        handler
    );

    return () => {
        input.removeEventListener(
            "keydown",
            handler
        );
    };
}


/* ============================================================
   BUTTON ENABLE/DISABLE
   ============================================================ */

export function setDisabled(
    element,
    disabled
) {
    if (!element) {
        return;
    }

    element.disabled =
        Boolean(disabled);

    element.setAttribute(
        "aria-disabled",
        disabled
            ? "true"
            : "false"
    );
}


/**
 * Disable all controls inside a container.
 */
export function setContainerDisabled(
    container,
    disabled
) {
    if (!container) {
        return;
    }

    qsa(
        "button, input, select, textarea",
        container
    ).forEach(
        element =>
            setDisabled(
                element,
                disabled
            )
    );

    container.classList.toggle(
        "is-disabled",
        Boolean(disabled)
    );
}


/* ============================================================
   FORM HELPERS
   ============================================================ */

export function getFormValues(
    form
) {
    if (!form) {
        return {};
    }

    const data =
        new FormData(form);

    const result = {};

    for (
        const [key, value]
        of data.entries()
    ) {
        if (
            Object.prototype.hasOwnProperty
                .call(
                    result,
                    key
                )
        ) {
            if (
                !Array.isArray(
                    result[key]
                )
            ) {
                result[key] = [
                    result[key]
                ];
            }

            result[key].push(
                value
            );
        } else {
            result[key] =
                value;
        }
    }

    return result;
}


export function resetForm(
    form
) {
    if (!form) {
        return;
    }

    form.reset();

    qsa(
        "input, select, textarea",
        form
    ).forEach(
        element => {
            element.classList.remove(
                "is-invalid",
                "is-valid"
            );
        }
    );
}


/* ============================================================
   NUMBER INPUT HELPERS
   ============================================================ */

export function getNumberInputValue(
    input,
    {
        min = null,
        max = null,
        fallback = 0
    } = {}
) {
    if (!input) {
        return fallback;
    }

    let value =
        Number(
            input.value
        );

    if (!Number.isFinite(value)) {
        value =
            fallback;
    }

    if (min !== null) {
        value =
            Math.max(
                min,
                value
            );
    }

    if (max !== null) {
        value =
            Math.min(
                max,
                value
            );
    }

    return value;
}


/* ============================================================
   FOCUS MANAGEMENT
   ============================================================ */

export function focusElement(
    element,
    {
        select = false
    } = {}
) {
    if (!element) {
        return;
    }

    window.requestAnimationFrame(
        () => {
            element.focus();

            if (
                select &&
                typeof element.select ===
                    "function"
            ) {
                element.select();
            }
        }
    );
}


export function focusPracticeInput(
    container
) {
    if (!container) {
        return;
    }

    const input =
        container.querySelector(
            "[data-answer-input], " +
            "input[type=text], " +
            "textarea"
        );

    if (input) {
        focusElement(input);
    }
}


/* ============================================================
   SCROLL HELPERS
   ============================================================ */

export function scrollToTop(
    element = window
) {
    if (
        element ===
        window
    ) {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        return;
    }

    element.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


export function scrollIntoView(
    element
) {
    if (!element) {
        return;
    }

    element.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}


/* ============================================================
   EVENT DELEGATION
   ============================================================ */

/**
 * Generic action delegation.

   Example:

   bindActions({
       container,
       actions: {
           "practice-again": () => {}
       }
   });
 */
export function bindActions({
    container = document,
    actions = {}
} = {}) {
    const handler =
        async event => {
            const target =
                event.target.closest(
                    "[data-action]"
                );

            if (!target) {
                return;
            }

            if (
                !container.contains(
                    target
                )
            ) {
                return;
            }

            const action =
                target.dataset.action;

            const callback =
                actions[action];

            if (
                typeof callback !==
                "function"
            ) {
                return;
            }

            event.preventDefault();

            await callback(
                event,
                target
            );
        };

    container.addEventListener(
        "click",
        handler
    );

    return () =>
        container.removeEventListener(
            "click",
            handler
        );
}


/* ============================================================
   PRACTICE BUTTON STATES
   ============================================================ */

export function setPracticeAnsweredState({
    container,
    answered,
    correct = null
} = {}) {
    if (!container) {
        return;
    }

    container.classList.toggle(
        "answer-checked",
        Boolean(answered)
    );

    if (
        correct !== null
    ) {
        container.classList.toggle(
            "answer-correct",
            Boolean(correct)
        );

        container.classList.toggle(
            "answer-incorrect",
            !correct
        );
    }

    const checkButton =
        container.querySelector(
            "[data-action='check-answer'], " +
            "[data-practice-check]"
        );

    const nextButton =
        container.querySelector(
            "[data-action='next-question'], " +
            "[data-practice-next]"
        );

    if (checkButton) {
        setDisabled(
            checkButton,
            answered
        );
    }

    if (nextButton) {
        setDisabled(
            nextButton,
            !answered
        );
    }
}


/* ============================================================
   PRACTICE QUESTION HEADER
   ============================================================ */

export function practiceHeaderHtml({
    exerciseType = "",
    current = 1,
    total = 1,
    wordLabel = ""
} = {}) {
    return `
        <div class="practice-header">

            <div class="practice-header-left">

                ${
                    exerciseType
                        ? exerciseBadge(
                            exerciseType
                        )
                        : ""
                }

                ${
                    wordLabel
                        ? `
                            <span class="practice-word-label">
                                ${escapeHtml(wordLabel)}
                            </span>
                        `
                        : ""
                }

            </div>

            <div class="practice-question-number">
                ${Number(current) || 0}
                /
                ${Number(total) || 0}
            </div>

        </div>
    `;
}


/* ============================================================
   MIXED PRACTICE DISTRIBUTION
   ============================================================ */

export function mixedDistributionHtml({
    counts = {}
} = {}) {
    const types = [
        "meaning",
        "recall",
        "fillSentence",
        "chooseWord",
        "production"
    ];

    return `
        <div class="mixed-distribution">

            <div class="mixed-distribution-title">
                Mixed Practice
            </div>

            <div class="mixed-distribution-list">

                ${types.map(
                    type => `
                        <div
                            class="mixed-distribution-item"
                            data-exercise-type="${escapeAttribute(type)}"
                        >

                            ${exerciseBadge(type)}

                            <strong>
                                ${
                                    Number(
                                        counts[type]
                                    ) || 0
                                }
                            </strong>

                        </div>
                    `
                ).join("")}

            </div>

        </div>
    `;
}


/* ============================================================
   PACK SELECTOR
   ============================================================ */

export function packOptionHtml(
    pack,
    selected = false
) {
    const id =
        pack?.id ??
        pack?.packId ??
        "";

    const name =
        pack?.name ??
        pack?.title ??
        `Pack ${id}`;

    const count =
        pack?.wordCount ??
        pack?.count ??
        "";

    return `
        <option
            value="${escapeAttribute(id)}"
            ${selected ? "selected" : ""}
        >
            ${escapeHtml(name)}
            ${
                count !== ""
                    ? ` (${Number(count) || 0})`
                    : ""
            }
        </option>
    `;
}


/* ============================================================
   SELECTION MODE LABELS
   ============================================================ */

export function selectionModeLabel(
    mode
) {
    const labels = {
        all: "All Vocabulary",
        imported: "Word Pack",
        pack: "Word Pack",
        new: "New Words",
        weak: "Weak Words",
        due: "Due Words"
    };

    return labels[mode] ??
        "Selected Vocabulary";
}


/* ============================================================
   DASHBOARD REFRESH EVENT
   ============================================================ */

export function requestDashboardRefresh() {
    window.dispatchEvent(
        new CustomEvent(
            "dutchntrainer:dashboard-refresh"
        )
    );
}


/* ============================================================
   APPLICATION EVENTS
   ============================================================ */

export function emit(
    eventName,
    detail = {}
) {
    window.dispatchEvent(
        new CustomEvent(
            eventName,
            {
                detail
            }
        )
    );
}


/* ============================================================
   IMPORT RESULT UI
   ============================================================ */

export function importResultHtml({
    imported = 0,
    skipped = 0,
    errors = 0,
    packName = ""
} = {}) {
    return `
        <div class="import-result">

            <div class="import-result-header">
                <h3>
                    Import Complete
                </h3>

                ${
                    packName
                        ? `
                            <p>
                                Pack:
                                <strong>
                                    ${escapeHtml(packName)}
                                </strong>
                            </p>
                        `
                        : ""
                }
            </div>

            <div class="import-result-stats">

                <div>
                    <strong>
                        ${Number(imported) || 0}
                    </strong>

                    <span>
                        Imported
                    </span>
                </div>

                <div>
                    <strong>
                        ${Number(skipped) || 0}
                    </strong>

                    <span>
                        Skipped
                    </span>
                </div>

                <div>
                    <strong>
                        ${Number(errors) || 0}
                    </strong>

                    <span>
                        Errors
                    </span>
                </div>

            </div>

        </div>
    `;
}


/* ============================================================
   RESPONSIVE HELPERS
   ============================================================ */

export function isMobile() {
    return window.matchMedia(
        "(max-width: 768px)"
    ).matches;
}


/* ============================================================
   ACCESSIBILITY
   ============================================================ */

export function announce(
    message
) {
    let region =
        document.querySelector(
            "#aria-live-region"
        );

    if (!region) {
        region =
            document.createElement(
                "div"
            );

        region.id =
            "aria-live-region";

        region.setAttribute(
            "aria-live",
            "polite"
        );

        region.setAttribute(
            "aria-atomic",
            "true"
        );

        region.className =
            "sr-only";

        document.body.appendChild(
            region
        );
    }

    region.textContent =
        "";

    window.setTimeout(
        () => {
            region.textContent =
                message;
        },
        20
    );
}


/* ============================================================
   GLOBAL UI INITIALIZATION
   ============================================================ */

export function initUI({
    navigation = true,
    defaultView = "home"
} = {}) {
    if (navigation) {
        initNavigation({
            defaultView
        });
    }

    /*
     * Global Escape behavior for modals.
     */
    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key ===
                "Escape" &&
                activeModal
            ) {
                closeModal();
            }
        }
    );

    /*
     * Prevent accidental form submission from pressing Enter
     * in non-practice forms unless the form explicitly opts in.
     */
    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key !==
                "Enter"
            ) {
                return;
            }

            const target =
                event.target;

            if (
                !target.matches(
                    "input, textarea"
                )
            ) {
                return;
            }

            const form =
                target.closest(
                    "form"
                );

            if (!form) {
                return;
            }

            if (
                form.matches(
                    "[data-allow-enter-submit]"
                )
            ) {
                return;
            }

            if (
                form.matches(
                    "[data-practice-form]"
                )
            ) {
                return;
            }

            /*
             * Do not block selects or explicit submit buttons.
             */
            if (
                target.type ===
                "submit"
            ) {
                return;
            }
        }
    );
}


/* ============================================================
   GLOBAL BRIDGE
   ============================================================ */

if (
    typeof window !==
    "undefined"
) {
    window.DutchTrainerUI = {
        escapeHtml,
        escapeAttribute,

        qs,
        qsa,
        createElement,
        clearElement,

        show,
        hide,
        toggle,

        setText,
        setHtml,

        addClass,
        removeClass,
        toggleClass,

        navigateTo,
        getCurrentView,
        setActiveNav,
        initNavigation,

        showToast,
        showSuccess,
        showError,
        showWarning,

        setLoading,
        loadingHtml,

        emptyStateHtml,
        errorStateHtml,

        showModal,
        closeModal,
        confirmModal,

        progressHtml,
        setProgress,

        practiceProgressHtml,
        answerFeedbackHtml,
        renderAnswerFeedback,

        practiceCompletionHtml,
        selectionSummaryHtml,

        masteryBadge,
        statusBadge,
        exerciseBadge,

        bindPracticeEnter,
        setDisabled,
        setContainerDisabled,

        getFormValues,
        resetForm,
        getNumberInputValue,

        focusElement,
        focusPracticeInput,

        scrollToTop,
        scrollIntoView,

        bindActions,

        setPracticeAnsweredState,
        practiceHeaderHtml,

        mixedDistributionHtml,
        packOptionHtml,
        selectionModeLabel,

        requestDashboardRefresh,
        emit,

        importResultHtml,

        isMobile,
        announce,

        initUI
    };
}