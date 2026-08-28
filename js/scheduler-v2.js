'use strict';

/* Dutch Vocabulary Trainer V2.4 — Stable Scheduler API.
 * Pure scheduling logic. No DOM, storage, or UI dependencies.
 */
const DutchTrainer = window.DutchTrainer || (window.DutchTrainer = {});

const CONFIG = Object.freeze({
    weakThreshold: 40,
    initialDays: 1,
    failedHours: 1,
    maxDays: 180,
    intervals: [
        [20, 1], [40, 2], [60, 4], [75, 7],
        [85, 14], [92, 30], [100, 60]
    ]
});

function number(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function mastery(word) {
    return Math.max(0, Math.min(100, number(
        word?.mastery ?? word?.masteryScore ?? word?.score, 0
    )));
}

function attempts(word) {
    return Math.max(0, number(word?.attempts ?? word?.stats?.attempts, 0));
}

function dueDate(word) {
    const value = word?.dueAt ?? word?.nextReviewAt ?? word?.nextReview;
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function intervalDays(value) {
    const m = mastery({ mastery: value });
    return CONFIG.intervals.find(([max]) => m <= max)?.[1] ?? CONFIG.maxDays;
}

function addHours(date, hours) {
    return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addDays(date, days) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

DutchTrainer.scheduler = {
    config: CONFIG,

    getMastery: mastery,

    isNew(word) {
        return attempts(word) === 0;
    },

    isDue(word, now = new Date()) {
        if (this.isNew(word)) return false;
        const due = dueDate(word);
        return !!due && due.getTime() <= new Date(now).getTime();
    },

    isWeak(word) {
        return mastery(word) < CONFIG.weakThreshold;
    },

    isLearned(word) {
        return mastery(word) >= 90;
    },

    getIntervalDays(word) {
        return intervalDays(mastery(word));
    },

    schedule(word, result, now = new Date()) {
        const date = new Date(now);
        const correct = result === true || result?.correct === true;
        const almost = result?.almost === true || result === 'almost';
        const next = correct && !almost
            ? addDays(date, intervalDays(mastery(word)))
            : addHours(date, CONFIG.failedHours);

        return {
            ...word,
            dueAt: next.toISOString(),
            nextReviewAt: next.toISOString()
        };
    },

    classify(word, now = new Date()) {
        if (this.isNew(word)) return 'new';
        if (this.isDue(word, now)) return 'due';
        if (this.isWeak(word)) return 'weak';
        if (this.isLearned(word)) return 'learned';
        return 'learning';
    }
};
