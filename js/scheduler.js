/* =========================================================
   DUTCH VOCABULARY TRAINER V2.0
   scheduler.js

   Responsibilities:
   - Determine whether words are new, due, weak, or learned
   - Calculate next review dates
   - Schedule words after every answer
   - Keep scheduling independent from exercise selection
   - Preserve existing V1.2 review data
   - Work with the V2 mastery system
   - Support persistent vocabulary selection
   - Provide statistics used by Dashboard / Practice

   Important:
   - scheduler.js does NOT decide which exercise type to use.
   - scheduler.js does NOT randomly select questions.
   - selection.js / practice.js handle question selection.
   - mastery.js handles mastery calculations.
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const SchedulerConfig = {

    /*
     * Mastery below this value is considered weak.
     */
    weakThreshold:
        40,

    /*
     * Words without meaningful practice history are new.
     */
    newAttemptsThreshold:
        0,

    /*
     * Maximum interval.
     */
    maxIntervalDays:
        180,

    /*
     * Initial review interval.
     */
    initialIntervalDays:
        1,

    /*
     * Minimum review interval after an incorrect answer.
     */
    minimumFailedIntervalHours:
        1,

    /*
     * Review intervals by mastery.
     *
     * These are intentionally conservative. The interval
     * grows through successful answers rather than jumping
     * directly to long-term retention.
     */
    intervals: [

        {
            maxMastery:
                20,

            days:
                1
        },

        {
            maxMastery:
                40,

            days:
                2
        },

        {
            maxMastery:
                60,

            days:
                4
        },

        {
            maxMastery:
                75,

            days:
                7
        },

        {
            maxMastery:
                85,

            days:
                14
        },

        {
            maxMastery:
                92,

            days:
                30
        },

        {
            maxMastery:
                100,

            days:
                60
        }

    ]

};


/* =========================================================
   SCHEDULER STATE
========================================================= */

const SchedulerState = {

    initialized:
        false,

    lastSchedule:
        null

};


/* =========================================================
   DATE HELPERS
========================================================= */

function schedulerNow() {

    return new Date();

}


function schedulerNowISO() {

    return schedulerNow()
        .toISOString();

}


function schedulerToDate(
    value
) {

    if (
        value instanceof Date
    ) {

        return new Date(
            value.getTime()
        );

    }


    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;

    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return null;

    }


    return date;

}


/* =========================================================
   ADD DAYS
========================================================= */

function schedulerAddDays(
    date,
    days
) {

    const result =
        schedulerToDate(
            date
        ) ??
        schedulerNow();


    result.setTime(

        result.getTime() +

        (
            Number(days || 0) *
            24 *
            60 *
            60 *
            1000
        )

    );


    return result;

}


/* =========================================================
   ADD HOURS
========================================================= */

function schedulerAddHours(
    date,
    hours
) {

    const result =
        schedulerToDate(
            date
        ) ??
        schedulerNow();


    result.setTime(

        result.getTime() +

        (
            Number(hours || 0) *
            60 *
            60 *
            1000
        )

    );


    return result;

}


/* =========================================================
   START OF TODAY
========================================================= */

function schedulerStartOfToday(
    date = null
) {

    const result =
        schedulerToDate(
            date
        ) ??
        schedulerNow();


    result.setHours(
        0,
        0,
        0,
        0
    );


    return result;

}


/* =========================================================
   END OF TODAY
========================================================= */

function schedulerEndOfToday(
    date = null
) {

    const result =
        schedulerToDate(
            date
        ) ??
        schedulerNow();


    result.setHours(
        23,
        59,
        59,
        999
    );


    return result;

}


/* =========================================================
   IS VALID DATE
========================================================= */

function schedulerHasValidDate(
    value
) {

    return (
        schedulerToDate(
            value
        ) !== null
    );

}


/* =========================================================
   GET MASTERY
========================================================= */

function schedulerGetMastery(
    word
) {

    if (
        !word
    ) {

        return 0;

    }


    const candidates = [

        word.mastery,

        word.masteryScore,

        word.score,

        word.progress

    ];


    for (
        const value
        of candidates
    ) {

        if (
            value !== undefined &&
            value !== null &&
            value !== ""
        ) {

            const number =
                Number(
                    value
                );


            if (
                Number.isFinite(
                    number
                )
            ) {

                return Math.max(

                    0,

                    Math.min(
                        100,
                        number
                    )

                );

            }

        }

    }


    return 0;

}


/* =========================================================
   GET ATTEMPTS
========================================================= */

function schedulerGetAttempts(
    word
) {

    if (
        !word
    ) {

        return 0;

    }


    if (
        word.stats &&
        Number.isFinite(
            Number(
                word.stats.attempts
            )
        )
    ) {

        return Number(
            word.stats.attempts
        );

    }


    const candidates = [

        word.attempts,

        word.totalAttempts,

        word.reviewCount,

        word.seenCount

    ];


    for (
        const value
        of candidates
    ) {

        const number =
            Number(
                value
            );


        if (
            Number.isFinite(
                number
            )
        ) {

            return Math.max(
                0,
                number
            );

        }

    }


    return 0;

}


/* =========================================================
   GET CORRECT ANSWERS
========================================================= */

function schedulerGetCorrect(
    word
) {

    if (
        !word
    ) {

        return 0;

    }


    if (
        word.stats &&
        Number.isFinite(
            Number(
                word.stats.correct
            )
        )
    ) {

        return Number(
            word.stats.correct
        );

    }


    const candidates = [

        word.correct,

        word.correctAnswers,

        word.successes

    ];


    for (
        const value
        of candidates
    ) {

        const number =
            Number(
                value
            );


        if (
            Number.isFinite(
                number
            )
        ) {

            return Math.max(
                0,
                number
            );

        }

    }


    return 0;

}


/* =========================================================
   GET LAST PRACTICED
========================================================= */

function schedulerGetLastPracticed(
    word
) {

    if (
        !word
    ) {

        return null;

    }


    const candidates = [

        word.lastPracticedAt,

        word.lastReviewedAt,

        word.lastReview,

        word.lastPractice,

        word.updatedAt

    ];


    for (
        const value
        of candidates
    ) {

        if (
            schedulerHasValidDate(
                value
            )
        ) {

            return schedulerToDate(
                value
            );

        }

    }


    return null;

}


/* =========================================================
   GET DUE DATE
========================================================= */

function schedulerGetDueDate(
    word
) {

    if (
        !word
    ) {

        return null;

    }


    const candidates = [

        word.dueAt,

        word.nextReviewAt,

        word.nextReview,

        word.reviewAt,

        word.scheduledFor

    ];


    for (
        const value
        of candidates
    ) {

        if (
            schedulerHasValidDate(
                value
            )
        ) {

            return schedulerToDate(
                value
            );

        }

    }


    return null;

}


/* =========================================================
   GET INTERVAL
========================================================= */

function schedulerGetInterval(
    word
) {

    if (
        !word
    ) {

        return 0;

    }


    const candidates = [

        word.intervalDays,

        word.reviewIntervalDays,

        word.interval,

        word.schedule?.intervalDays

    ];


    for (
        const value
        of candidates
    ) {

        const number =
            Number(
                value
            );


        if (
            Number.isFinite(
                number
            ) &&
            number >= 0
        ) {

            return number;

        }

    }


    return 0;

}


/* =========================================================
   GET CONSECUTIVE CORRECT
========================================================= */

function schedulerGetConsecutiveCorrect(
    word
) {

    if (
        !word
    ) {

        return 0;

    }


    const candidates = [

        word.consecutiveCorrect,

        word.streak,

        word.correctStreak,

        word.stats?.consecutiveCorrect

    ];


    for (
        const value
        of candidates
    ) {

        const number =
            Number(
                value
            );


        if (
            Number.isFinite(
                number
            )
        ) {

            return Math.max(
                0,
                number
            );

        }

    }


    return 0;

}


/* =========================================================
   GET CONSECUTIVE INCORRECT
========================================================= */

function schedulerGetConsecutiveIncorrect(
    word
) {

    if (
        !word
    ) {

        return 0;

    }


    const candidates = [

        word.consecutiveIncorrect,

        word.errorStreak,

        word.incorrectStreak,

        word.stats?.consecutiveIncorrect

    ];


    for (
        const value
        of candidates
    ) {

        const number =
            Number(
                value
            );


        if (
            Number.isFinite(
                number
            )
        ) {

            return Math.max(
                0,
                number
            );

        }

    }


    return 0;

}


/* =========================================================
   IS NEW WORD
========================================================= */

function isNewWord(
    word
) {

    if (
        !word
    ) {

        return false;

    }


    /*
     * Explicit V2/V1 flags.
     */
    if (
        word.isNew === true
    ) {

        return true;

    }


    if (
        word.status ===
        "new"
    ) {

        return true;

    }


    /*
     * Attempts are the most reliable fallback.
     */
    return (
        schedulerGetAttempts(
            word
        ) <=
        SchedulerConfig.newAttemptsThreshold
    );

}


/* =========================================================
   IS WEAK WORD
========================================================= */

function isWeakWord(
    word
) {

    if (
        !word
    ) {

        return false;

    }


    if (
        isNewWord(
            word
        )
    ) {

        return false;

    }


    return (

        schedulerGetMastery(
            word
        ) <
        SchedulerConfig.weakThreshold

    );

}


/* =========================================================
   IS DUE WORD
========================================================= */

function isDueWord(
    word,
    now = null
) {

    if (
        !word
    ) {

        return false;

    }


    const current =
        schedulerToDate(
            now
        ) ??
        schedulerNow();


    /*
     * New words are handled separately.
     */
    if (
        isNewWord(
            word
        )
    ) {

        return false;

    }


    /*
     * Explicit due flag.
     */
    if (
        word.isDue === true
    ) {

        return true;

    }


    const dueDate =
        schedulerGetDueDate(
            word
        );


    /*
     * No due date means it is not currently due.
     */
    if (
        !dueDate
    ) {

        return false;

    }


    return (
        dueDate.getTime() <=
        current.getTime()
    );

}


/* =========================================================
   IS LEARNED
========================================================= */

function isLearnedWord(
    word
) {

    if (
        !word
    ) {

        return false;

    }


    return (

        !isNewWord(
            word
        ) &&

        schedulerGetMastery(
            word
        ) >=
        SchedulerConfig.weakThreshold

    );

}


/* =========================================================
   GET WORD STATUS
========================================================= */

function getWordScheduleStatus(
    word,
    now = null
) {

    if (
        !word
    ) {

        return "unknown";

    }


    if (
        isNewWord(
            word
        )
    ) {

        return "new";

    }


    if (
        isDueWord(
            word,
            now
        )
    ) {

        return "due";

    }


    if (
        isWeakWord(
            word
        )
    ) {

        return "weak";

    }


    return "learned";

}


/* =========================================================
   GET INTERVAL FOR MASTERY
========================================================= */

function getIntervalDaysForMastery(
    mastery
) {

    const score =
        Math.max(

            0,

            Math.min(

                100,

                Number(
                    mastery || 0
                )

            )

        );


    const interval =
        SchedulerConfig.intervals.find(

            item =>
                score <=
                item.maxMastery

        );


    if (
        interval
    ) {

        return interval.days;

    }


    return SchedulerConfig.initialIntervalDays;

}


/* =========================================================
   CALCULATE SUCCESS INTERVAL
========================================================= */

function calculateSuccessfulInterval(
    word,
    mastery,
    options = {}
) {

    const currentInterval =
        schedulerGetInterval(
            word
        );


    const consecutiveCorrect =
        schedulerGetConsecutiveCorrect(
            word
        );


    let baseInterval =
        getIntervalDaysForMastery(
            mastery
        );


    /*
     * If a word already has a longer interval, don't
     * accidentally shorten it after a successful answer.
     */
    if (
        currentInterval >
        baseInterval
    ) {

        baseInterval =
            currentInterval;

    }


    /*
     * Repeated consecutive success increases the interval.
     */
    if (
        consecutiveCorrect >=
        2
    ) {

        baseInterval *=
            1.5;

    }


    if (
        consecutiveCorrect >=
        4
    ) {

        baseInterval *=
            1.5;

    }


    /*
     * Optional multiplier supplied by mastery.js or caller.
     */
    const multiplier =
        Number(
            options.multiplier ??
            1
        );


    if (
        Number.isFinite(
            multiplier
        ) &&
        multiplier > 0
    ) {

        baseInterval *=
            multiplier;

    }


    /*
     * Round to sensible intervals.
     */
    baseInterval =
        Math.max(

            SchedulerConfig.initialIntervalDays,

            Math.min(

                SchedulerConfig.maxIntervalDays,

                baseInterval

            )

        );


    return Math.round(
        baseInterval
    );

}


/* =========================================================
   CALCULATE FAILED INTERVAL
========================================================= */

function calculateFailedInterval(
    word,
    options = {}
) {

    const consecutiveIncorrect =
        schedulerGetConsecutiveIncorrect(
            word
        );


    /*
     * First failure:
     * review again soon.
     */
    let hours =
        Number(

            options.hours ??

            SchedulerConfig
                .minimumFailedIntervalHours

        );


    if (
        !Number.isFinite(
            hours
        ) ||
        hours <= 0
    ) {

        hours =
            SchedulerConfig
                .minimumFailedIntervalHours;

    }


    /*
     * Repeated failure should bring the word back even
     * sooner rather than pushing it into a long interval.
     */
    if (
        consecutiveIncorrect >=
        2
    ) {

        hours =
            Math.min(
                hours,
                1
            );

    }


    return Math.max(
        0.25,
        hours
    );

}


/* =========================================================
   CALCULATE NEXT REVIEW
========================================================= */

function calculateNextReview(
    word,
    options = {}
) {

    const correct =
        Boolean(
            options.correct
        );


    const mastery =
        Number(

            options.mastery ??
            schedulerGetMastery(
                word
            )

        );


    const current =
        schedulerToDate(
            options.now
        ) ??
        schedulerNow();


    if (
        correct
    ) {

        const intervalDays =
            calculateSuccessfulInterval(

                word,

                mastery,

                options

            );


        return {

            intervalDays,

            intervalHours:
                intervalDays *
                24,

            dueAt:
                schedulerAddDays(
                    current,
                    intervalDays
                ).toISOString(),

            correct:
                true

        };

    }


    const intervalHours =
        calculateFailedInterval(

            word,

            options

        );


    return {

        intervalDays:
            intervalHours / 24,

        intervalHours,

        dueAt:
            schedulerAddHours(
                current,
                intervalHours
            ).toISOString(),

        correct:
            false

    };

}


/* =========================================================
   SCHEDULE AFTER ANSWER
========================================================= */

/**
 * Called after every answer.
 *
 * This function does not calculate mastery itself.
 * mastery.js remains responsible for mastery updates.
 *
 * Expected options:
 *
 * {
 *   correct: true/false,
 *   mastery: updated mastery,
 *   exerciseType: "meaning",
 *   now: Date
 * }
 */
function scheduleAfterAnswer(
    word,
    options = {}
) {

    if (
        !word
    ) {

        return null;

    }


    const now =
        schedulerToDate(
            options.now
        ) ??
        schedulerNow();


    const mastery =
        Number(

            options.mastery ??
            schedulerGetMastery(
                word
            )

        );


    const result =
        calculateNextReview(

            word,

            {

                ...options,

                mastery,

                now

            }

        );


    /*
     * Preserve canonical V2 scheduling fields.
     */
    word.dueAt =
        result.dueAt;


    word.nextReviewAt =
        result.dueAt;


    word.intervalDays =
        result.intervalDays;


    word.reviewIntervalDays =
        result.intervalDays;


    word.lastPracticedAt =
        now.toISOString();


    word.lastReviewedAt =
        now.toISOString();


    word.isDue =
        false;


    /*
     * Update explicit state.
     */
    word.status =
        result.correct
            ? (
                mastery >=
                SchedulerConfig.weakThreshold
                    ? "learned"
                    : "weak"
            )
            : "due";


    /*
     * New word is no longer new after its first answer.
     */
    word.isNew =
        false;


    word.updatedAt =
        now.toISOString();


    SchedulerState.lastSchedule = {

        wordId:
            word.id,

        correct:
            Boolean(
                options.correct
            ),

        mastery,

        dueAt:
            result.dueAt,

        intervalDays:
            result.intervalDays,

        exerciseType:
            options.exerciseType ??
            null,

        scheduledAt:
            now.toISOString()

    };


    return {

        ...result,

        word,

        scheduledAt:
            now.toISOString()

    };

}


/* =========================================================
   MARK WORD AS DUE
========================================================= */

function markWordDue(
    word,
    options = {}
) {

    if (
        !word
    ) {

        return null;

    }


    const now =
        schedulerToDate(
            options.now
        ) ??
        schedulerNow();


    word.isDue =
        true;


    word.status =
        "due";


    /*
     * A due word should be available immediately.
     */
    word.dueAt =
        now.toISOString();


    word.nextReviewAt =
        now.toISOString();


    word.updatedAt =
        now.toISOString();


    return word;

}


/* =========================================================
   MARK WORD NEW
========================================================= */

function markWordNew(
    word
) {

    if (
        !word
    ) {

        return null;

    }


    word.isNew =
        true;


    word.isDue =
        false;


    word.status =
        "new";


    word.mastery =
        0;


    word.intervalDays =
        0;


    word.reviewIntervalDays =
        0;


    return word;

}


/* =========================================================
   SCHEDULE NEW WORD
========================================================= */

function scheduleNewWord(
    word,
    options = {}
) {

    if (
        !word
    ) {

        return null;

    }


    const now =
        schedulerToDate(
            options.now
        ) ??
        schedulerNow();


    const intervalDays =
        Number(

            options.intervalDays ??

            SchedulerConfig
                .initialIntervalDays

        );


    const safeInterval =
        Math.max(

            1,

            Math.min(

                SchedulerConfig.maxIntervalDays,

                Number.isFinite(
                    intervalDays
                )
                    ? intervalDays
                    : 1

            )

        );


    const dueAt =
        schedulerAddDays(

            now,

            safeInterval

        ).toISOString();


    word.isNew =
        false;


    word.isDue =
        false;


    word.status =
        "weak";


    word.intervalDays =
        safeInterval;


    word.reviewIntervalDays =
        safeInterval;


    word.dueAt =
        dueAt;


    word.nextReviewAt =
        dueAt;


    word.lastPracticedAt =
        now.toISOString();


    word.updatedAt =
        now.toISOString();


    return {

        word,

        intervalDays:
            safeInterval,

        dueAt

    };

}


/* =========================================================
   RESCHEDULE WEAK WORD
========================================================= */

function rescheduleWeakWord(
    word,
    options = {}
) {

    if (
        !word
    ) {

        return null;

    }


    const mastery =
        schedulerGetMastery(
            word
        );


    const now =
        schedulerToDate(
            options.now
        ) ??
        schedulerNow();


    /*
     * Weak words should never be left without a review date.
     */
    const intervalDays =
        Math.min(

            2,

            Math.max(

                1,

                getIntervalDaysForMastery(
                    mastery
                )

            )

        );


    const dueAt =
        schedulerAddDays(

            now,

            intervalDays

        ).toISOString();


    word.dueAt =
        dueAt;


    word.nextReviewAt =
        dueAt;


    word.intervalDays =
        intervalDays;


    word.reviewIntervalDays =
        intervalDays;


    word.isDue =
        false;


    word.status =
        "weak";


    word.updatedAt =
        now.toISOString();


    return {

        word,

        intervalDays,

        dueAt

    };

}


/* =========================================================
   GET NEXT REVIEW DATE
========================================================= */

function getNextReviewDate(
    word
) {

    return schedulerGetDueDate(
        word
    );

}


/* =========================================================
   GET NEXT REVIEW LABEL
========================================================= */

function getNextReviewLabel(
    word,
    now = null
) {

    const dueDate =
        schedulerGetDueDate(
            word
        );


    if (
        !dueDate
    ) {

        return "Not scheduled";

    }


    const current =
        schedulerToDate(
            now
        ) ??
        schedulerNow();


    const difference =
        dueDate.getTime() -
        current.getTime();


    if (
        difference <= 0
    ) {

        return "Due now";

    }


    const minutes =
        Math.round(
            difference /
            60000
        );


    if (
        minutes <
        60
    ) {

        return (

            `In ${Math.max(
                1,
                minutes
            )} min`

        );

    }


    const hours =
        Math.round(
            minutes /
            60
        );


    if (
        hours <
        24
    ) {

        return (

            `In ${hours} hour` +

            (
                hours === 1
                    ? ""
                    : "s"
            )

        );

    }


    const days =
        Math.round(
            hours /
            24
        );


    return (

        `In ${days} day` +

        (
            days === 1
                ? ""
                : "s"
        )

    );

}


/* =========================================================
   GET SCHEDULE CATEGORY
========================================================= */

function getScheduleCategory(
    word,
    now = null
) {

    const status =
        getWordScheduleStatus(
            word,
            now
        );


    switch (
        status
    ) {

        case "new":

            return "new";

        case "due":

            return "due";

        case "weak":

            return "weak";

        case "learned":

            return "scheduled";

        default:

            return "unknown";

    }

}


/* =========================================================
   FILTER WORDS BY SCHEDULE
========================================================= */

function filterWordsBySchedule(
    words,
    category,
    now = null
) {

    if (
        !Array.isArray(
            words
        )
    ) {

        return [];

    }


    const current =
        schedulerToDate(
            now
        ) ??
        schedulerNow();


    switch (
        category
    ) {

        case "new":

            return words.filter(

                word =>
                    isNewWord(
                        word
                    )

            );


        case "due":

            return words.filter(

                word =>
                    isDueWord(
                        word,
                        current
                    )

            );


        case "weak":

            return words.filter(

                word =>
                    isWeakWord(
                        word
                    )

            );


        case "learned":

        case "scheduled":

            return words.filter(

                word =>
                    isLearnedWord(
                        word
                    ) &&
                    !isDueWord(
                        word,
                        current
                    )

            );


        case "all":

        default:

            return [
                ...words
            ];

    }

}


/* =========================================================
   GET NEW WORDS
========================================================= */

function getNewWords(
    words
) {

    return filterWordsBySchedule(
        words,
        "new"
    );

}


/* =========================================================
   GET DUE WORDS
========================================================= */

function getDueWords(
    words,
    now = null
) {

    return filterWordsBySchedule(
        words,
        "due",
        now
    );

}


/* =========================================================
   GET WEAK WORDS
========================================================= */

function getWeakWords(
    words
) {

    return filterWordsBySchedule(
        words,
        "weak"
    );

}


/* =========================================================
   GET LEARNED WORDS
========================================================= */

function getLearnedWords(
    words,
    now = null
) {

    return filterWordsBySchedule(
        words,
        "learned",
        now
    );

}


/* =========================================================
   GET SCHEDULE STATISTICS
========================================================= */

function getScheduleStatistics(
    words,
    now = null
) {

    const list =
        Array.isArray(
            words
        )
            ? words
            : [];


    const current =
        schedulerToDate(
            now
        ) ??
        schedulerNow();


    let newCount =
        0;

    let dueCount =
        0;

    let weakCount =
        0;

    let learnedCount =
        0;

    let scheduledCount =
        0;


    for (
        const word
        of list
    ) {

        const status =
            getWordScheduleStatus(
                word,
                current
            );


        switch (
            status
        ) {

            case "new":

                newCount++;

                break;


            case "due":

                dueCount++;

                break;


            case "weak":

                weakCount++;

                break;


            case "learned":

                learnedCount++;

                scheduledCount++;

                break;

        }

    }


    return {

        total:
            list.length,

        new:
            newCount,

        due:
            dueCount,

        weak:
            weakCount,

        learned:
            learnedCount,

        scheduled:
            scheduledCount,

        actionable:
            newCount +
            dueCount +
            weakCount

    };

}


/* =========================================================
   GET DUE COUNT
========================================================= */

function getDueCount(
    words,
    now = null
) {

    return getDueWords(

        words,

        now

    ).length;

}


/* =========================================================
   GET ACTIONABLE WORDS
========================================================= */

/*
 * Actionable means:
 *
 * 1. new
 * 2. due
 * 3. weak
 *
 * This is exactly what Start Practice needs.
 */
function getActionableWords(
    words,
    options = {}
) {

    if (
        !Array.isArray(
            words
        )
    ) {

        return [];

    }


    const current =
        schedulerToDate(
            options.now
        ) ??
        schedulerNow();


    const includeNew =
        options.includeNew !==
        false;


    const includeDue =
        options.includeDue !==
        false;


    const includeWeak =
        options.includeWeak !==
        false;


    const result =
        words.filter(

            word => {

                if (
                    includeNew &&
                    isNewWord(
                        word
                    )
                ) {

                    return true;

                }


                if (
                    includeDue &&
                    isDueWord(
                        word,
                        current
                    )
                ) {

                    return true;

                }


                if (
                    includeWeak &&
                    isWeakWord(
                        word
                    )
                ) {

                    return true;

                }


                return false;

            }

        );


    /*
     * Remove duplicate object references.
     */
    return [
        ...new Set(
            result
        )
    ];

}


/* =========================================================
   PRIORITY SCORE
========================================================= */

/*
 * Higher score = should be practiced earlier.
 *
 * Priority:
 *   due > weak > new
 *
 * This gives Start Practice useful deterministic behavior.
 */
function getSchedulePriority(
    word,
    now = null
) {

    if (
        !word
    ) {

        return -Infinity;

    }


    const current =
        schedulerToDate(
            now
        ) ??
        schedulerNow();


    if (
        isDueWord(
            word,
            current
        )
    ) {

        const dueDate =
            schedulerGetDueDate(
                word
            );


        let overdueHours =
            0;


        if (
            dueDate
        ) {

            overdueHours =
                Math.max(

                    0,

                    (
                        current.getTime() -
                        dueDate.getTime()
                    ) /
                    3600000

                );

        }


        return (

            3000 +

            Math.min(
                1000,
                overdueHours
            )

        );

    }


    if (
        isWeakWord(
            word
        )
    ) {

        return (

            2000 +

            (
                SchedulerConfig
                    .weakThreshold -

                schedulerGetMastery(
                    word
                )

            )

        );

    }


    if (
        isNewWord(
            word
        )
    ) {

        return 1000;

    }


    return 0;

}


/* =========================================================
   SORT ACTIONABLE WORDS
========================================================= */

function sortActionableWords(
    words,
    now = null
) {

    if (
        !Array.isArray(
            words
        )
    ) {

        return [];

    }


    return [

        ...words

    ].sort(

        (
            a,
            b
        ) => {

            const priorityDifference =

                getSchedulePriority(
                    b,
                    now
                ) -

                getSchedulePriority(
                    a,
                    now
                );


            if (
                priorityDifference !==
                0
            ) {

                return priorityDifference;

            }


            /*
             * Secondary ordering:
             * lower mastery first.
             */
            return (

                schedulerGetMastery(
                    a
                ) -

                schedulerGetMastery(
                    b
                )

            );

        }

    );

}


/* =========================================================
   SELECT START PRACTICE WORDS
========================================================= */

/**
 * Returns the words Start Practice should use.
 *
 * Start Practice is intentionally limited to:
 *   - new
 *   - due
 *   - weak
 *
 * It does NOT include all learned words.
 */
function selectStartPracticeWords(
    words,
    questionCount = 10,
    options = {}
) {

    const actionable =
        getActionableWords(

            words,

            options

        );


    const sorted =
        sortActionableWords(

            actionable,

            options.now

        );


    const count =
        Math.max(

            0,

            Number(
                questionCount || 0
            )

        );


    if (
        count === 0
    ) {

        return [];

    }


    /*
     * If there are fewer actionable words than requested,
     * return all available words.
     *
     * practice.js can decide whether to stop or recycle
     * words according to its session settings.
     */
    return sorted.slice(
        0,
        count
    );

}


/* =========================================================
   REBUILD LEGACY SCHEDULE DATA
========================================================= */

/**
 * V1.2 may have used different field names.
 *
 * This function upgrades scheduling information without
 * changing mastery or answer statistics.
 */
function migrateLegacyScheduleFields(
    word
) {

    if (
        !word
    ) {

        return word;

    }


    /*
     * V1.2 nextReview -> V2 dueAt
     */
    if (
        !word.dueAt &&
        word.nextReview
    ) {

        const date =
            schedulerToDate(
                word.nextReview
            );


        if (
            date
        ) {

            word.dueAt =
                date.toISOString();

        }

    }


    /*
     * V1.2 nextReviewAt -> V2 dueAt
     */
    if (
        !word.dueAt &&
        word.nextReviewAt
    ) {

        const date =
            schedulerToDate(
                word.nextReviewAt
            );


        if (
            date
        ) {

            word.dueAt =
                date.toISOString();

        }

    }


    /*
     * Legacy interval names.
     */
    if (
        word.intervalDays ===
        undefined
    ) {

        if (
            word.reviewIntervalDays !==
            undefined
        ) {

            word.intervalDays =
                Number(
                    word.reviewIntervalDays
                );

        } else if (
            word.interval !==
            undefined
        ) {

            word.intervalDays =
                Number(
                    word.interval
                );

        }

    }


    /*
     * Infer new status only when there is insufficient
     * information.
     */
    if (
        word.isNew ===
        undefined
    ) {

        word.isNew =
            schedulerGetAttempts(
                word
            ) === 0;

    }


    if (
        word.isDue ===
        undefined
    ) {

        word.isDue =
            isDueWord(
                word
            );

    }


    return word;

}


/* =========================================================
   INITIALIZE SCHEDULER
========================================================= */

async function initializeScheduler() {

    if (
        SchedulerState.initialized
    ) {

        return true;

    }


    /*
     * If the DB exposes a migration hook, allow it to run.
     * The scheduler itself never replaces existing data.
     */
    if (
        typeof getAllWords ===
        "function"
    ) {

        try {

            const words =
                await getAllWords();


            if (
                Array.isArray(
                    words
                )
            ) {

                let changed =
                    false;


                for (
                    const word
                    of words
                ) {

                    const before =
                        JSON.stringify({

                            dueAt:
                                word.dueAt,

                            intervalDays:
                                word.intervalDays,

                            isNew:
                                word.isNew,

                            isDue:
                                word.isDue

                        });


                    migrateLegacyScheduleFields(
                        word
                    );


                    const after =
                        JSON.stringify({

                            dueAt:
                                word.dueAt,

                            intervalDays:
                                word.intervalDays,

                            isNew:
                                word.isNew,

                            isDue:
                                word.isDue

                        });


                    if (
                        before !==
                        after
                    ) {

                        changed =
                            true;


                        if (
                            typeof saveWord ===
                            "function"
                        ) {

                            await saveWord(
                                word
                            );

                        } else if (
                            typeof upsertWord ===
                            "function"
                        ) {

                            await upsertWord(
                                word
                            );

                        }

                    }

                }


                void changed;

            }

        } catch (
            error
        ) {

            console.warn(

                "Scheduler initialization could not migrate " +
                "legacy schedule data.",

                error

            );

        }

    }


    SchedulerState.initialized =
        true;


    return true;

}


/* =========================================================
   PERSIST SCHEDULED WORD
========================================================= */

async function persistScheduledWord(
    word
) {

    if (
        !word
    ) {

        return null;

    }


    if (
        typeof saveWord ===
        "function"
    ) {

        return await saveWord(
            word
        );

    }


    if (
        typeof upsertWord ===
        "function"
    ) {

        return await upsertWord(
            word
        );

    }


    return word;

}


/* =========================================================
   SCHEDULE AND SAVE AFTER ANSWER
========================================================= */

async function scheduleAndSaveAfterAnswer(
    word,
    options = {}
) {

    const result =
        scheduleAfterAnswer(

            word,

            options

        );


    if (
        result?.word
    ) {

        await persistScheduledWord(
            result.word
        );

    }


    return result;

}


/* =========================================================
   REPAIR SCHEDULE FOR WORD
========================================================= */

function repairWordSchedule(
    word,
    options = {}
) {

    if (
        !word
    ) {

        return null;

    }


    migrateLegacyScheduleFields(
        word
    );


    const now =
        schedulerToDate(
            options.now
        ) ??
        schedulerNow();


    /*
     * New words don't need a review date yet.
     */
    if (
        isNewWord(
            word
        )
    ) {

        word.status =
            "new";

        word.isDue =
            false;

        return word;

    }


    /*
     * If there is an existing due date, preserve it.
     */
    const dueDate =
        schedulerGetDueDate(
            word
        );


    if (
        dueDate
    ) {

        word.dueAt =
            dueDate.toISOString();


        word.nextReviewAt =
            dueDate.toISOString();


        word.isDue =
            dueDate.getTime() <=
            now.getTime();


        word.status =
            word.isDue
                ? "due"
                : (
                    isWeakWord(
                        word
                    )
                        ? "weak"
                        : "learned"
                );


        return word;

    }


    /*
     * No schedule exists for an already practiced word.
     * Create a conservative schedule based on mastery.
     */
    const mastery =
        schedulerGetMastery(
            word
        );


    const intervalDays =
        getIntervalDaysForMastery(
            mastery
        );


    const newDueDate =
        schedulerAddDays(

            now,

            intervalDays

        );


    word.intervalDays =
        intervalDays;


    word.reviewIntervalDays =
        intervalDays;


    word.dueAt =
        newDueDate.toISOString();


    word.nextReviewAt =
        newDueDate.toISOString();


    word.isDue =
        false;


    word.status =
        mastery <
        SchedulerConfig.weakThreshold
            ? "weak"
            : "learned";


    return word;

}


/* =========================================================
   REPAIR ALL WORD SCHEDULES
========================================================= */

async function repairAllWordSchedules(
    words = null
) {

    let list =
        words;


    if (
        !Array.isArray(
            list
        )
    ) {

        if (
            typeof getAllWords ===
            "function"
        ) {

            list =
                await getAllWords();

        } else {

            list =
                [];

        }

    }


    if (
        !Array.isArray(
            list
        )
    ) {

        return [];

    }


    for (
        const word
        of list
    ) {

        repairWordSchedule(
            word
        );


        await persistScheduledWord(
            word
        );

    }


    return list;

}


/* =========================================================
   PUBLIC API
========================================================= */

window.DutchTrainerScheduler = {

    config:
        SchedulerConfig,

    state:
        SchedulerState,

    isNew:
        isNewWord,

    isDue:
        isDueWord,

    isWeak:
        isWeakWord,

    isLearned:
        isLearnedWord,

    getStatus:
        getWordScheduleStatus,

    getCategory:
        getScheduleCategory,

    getPriority:
        getSchedulePriority,

    getStatistics:
        getScheduleStatistics,

    getNewWords,

    getDueWords,

    getWeakWords,

    getLearnedWords,

    getActionableWords,

    selectStartPracticeWords,

    calculateNextReview,

    scheduleAfterAnswer,

    scheduleAndSaveAfterAnswer,

    scheduleNewWord,

    markWordNew,

    markWordDue,

    rescheduleWeakWord,

    getNextReviewDate,

    getNextReviewLabel,

    migrateLegacyScheduleFields,

    repairWordSchedule,

    repairAllWordSchedules,

    initialize:
        initializeScheduler

};


/* =========================================================
   GLOBAL COMPATIBILITY API
========================================================= */

window.isNewWord =
    isNewWord;


window.isDueWord =
    isDueWord;


window.isWeakWord =
    isWeakWord;


window.getWordScheduleStatus =
    getWordScheduleStatus;


window.getScheduleStatistics =
    getScheduleStatistics;


window.getNewWords =
    getNewWords;


window.getDueWords =
    getDueWords;


window.getWeakWords =
    getWeakWords;


window.getActionableWords =
    getActionableWords;


window.selectStartPracticeWords =
    selectStartPracticeWords;


window.scheduleAfterAnswer =
    scheduleAfterAnswer;


window.scheduleAndSaveAfterAnswer =
    scheduleAndSaveAfterAnswer;


/* =========================================================
   AUTO INITIALIZATION
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(

        "DOMContentLoaded",

        () => {

            initializeScheduler()
                .catch(

                    error => {

                        console.warn(

                            "Scheduler initialization failed:",

                            error

                        );

                    }

                );

        },

        {
            once:
                true
        }

    );

} else {

    initializeScheduler()
        .catch(

            error => {

                console.warn(

                    "Scheduler initialization failed:",

                    error

                );

            }

        );

}