/* V2.1.3 runtime contract for the mastery engine.
 * Must load before mastery.js. Keeps the exercise-type list in one place
 * for per-exercise mastery statistics initialization.
 */
(function () {
    "use strict";

    if (!Array.isArray(window.EXERCISE_TYPE_ORDER)) {
        window.EXERCISE_TYPE_ORDER = [
            "meaning",
            "recall",
            "fill",
            "choose",
            "production"
        ];
    }
})();
