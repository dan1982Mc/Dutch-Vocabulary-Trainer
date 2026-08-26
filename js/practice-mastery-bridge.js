/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   practice-mastery-bridge.js

   Architecture-A integration contract between practice.js
   and mastery.js.

   mastery.js remains the owner of mastery calculations.
   This file exposes one canonical practice-facing method.
========================================================= */

(function () {

    "use strict";

    if (typeof updateWordAfterAnswer !== "function") {
        throw new Error(
            "mastery.js must be loaded before practice-mastery-bridge.js."
        );
    }

    function recordAnswer(word, options = {}) {

        const exercise = {
            type:
                options.exerciseType ?? "meaning"
        };

        return updateWordAfterAnswer(
            word,
            {
                ...options,
                userAnswer:
                    options.userAnswer ?? options.answer ?? ""
            },
            exercise
        );
    }

    window.DutchTrainerMastery = {
        recordAnswer,
        updateAfterAnswer: recordAnswer
    };

})();
