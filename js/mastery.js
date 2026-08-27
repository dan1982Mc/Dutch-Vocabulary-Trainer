'use strict';

/* Dutch Vocabulary Trainer V2.4 — canonical mastery engine. */
const DutchTrainer = window.DutchTrainer || (window.DutchTrainer = {});

const TYPES = ['meaning', 'recall', 'fill', 'choose', 'production'];
const CONFIG = Object.freeze({
    rewards: Object.freeze({ correct: 10, almost: 4, incorrect: 0 }),
    weakThreshold: 40,
    masteredThreshold: 90,
    intervals: Object.freeze({ new: 1, weak: 2, developing: 4, familiar: 7, strong: 14, mastered: 30 }),
    historyLimit: 500
});

function typeOf(value) {
    const v = String(value || 'meaning').toLowerCase().trim();
    const aliases = { 'fill-sentence': 'fill', 'choose-word': 'choose', 'multiple-choice': 'meaning' };
    return aliases[v] || (TYPES.includes(v) ? v : 'meaning');
}

function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function clamp(value) {
    return Math.max(0, Math.min(100, Math.round(num(value))));
}

function masteryOf(word) {
    return clamp(word?.mastery ?? word?.masteryScore ?? word?.score ?? 0);
}

function levelOf(score) {
    const n = clamp(score);
    if (n >= CONFIG.masteredThreshold) return 'mastered';
    if (n >= 70) return 'strong';
    if (n >= 50) return 'familiar';
    if (n >= CONFIG.weakThreshold) return 'developing';
    if (n > 0) return 'weak';
    return 'new';
}

function ensureStats(word) {
    word.stats = word.stats && typeof word.stats === 'object' ? word.stats : {};
    const s = word.stats;
    s.attempts = num(s.attempts);
    s.correct = num(s.correct);
    s.incorrect = num(s.incorrect);
    s.accuracy = num(s.accuracy);
    s.consecutiveCorrect = num(s.consecutiveCorrect);
    s.consecutiveIncorrect = num(s.consecutiveIncorrect);
    s.byExerciseType = s.byExerciseType && typeof s.byExerciseType === 'object' ? s.byExerciseType : {};
    for (const type of TYPES) {
        if (!s.byExerciseType[type]) s.byExerciseType[type] = { attempts: 0, correct: 0, incorrect: 0, accuracy: 0 };
    }
    return s;
}

function ensureHistory(word) {
    if (!Array.isArray(word.history)) word.history = [];
    return word.history;
}

function accuracy(correct, attempts) {
    return num(attempts) ? Math.round(num(correct) / num(attempts) * 100) : 0;
}

function setMastery(word, value) {
    const n = clamp(value);
    word.mastery = n;
    if ('masteryScore' in word) word.masteryScore = n;
    return n;
}

function schedule(word, outcome, mastery) {
    const days = outcome === 'incorrect' ? 0 : outcome === 'almost' ? 1 : CONFIG.intervals[levelOf(mastery)];
    const date = new Date();
    date.setDate(date.getDate() + days);
    const iso = date.toISOString();
    word.dueAt = iso;
    word.isDue = days === 0;
    return { dueAt: iso, intervalDays: days };
}

async function updateWordAfterAnswer(word, answerData = {}, exercise = null) {
    if (!word) throw new Error('Cannot update mastery without a word.');

    const type = typeOf(exercise?.type ?? answerData.exerciseType);
    const stats = ensureStats(word);
    const before = masteryOf(word);
    const isCorrect = Boolean(answerData.correct);
    const isAlmost = !isCorrect && Boolean(answerData.almost);
    const outcome = isCorrect ? 'correct' : isAlmost ? 'almost' : 'incorrect';
    const delta = CONFIG.rewards[outcome];

    stats.attempts++;
    if (isCorrect) {
        stats.correct++;
        stats.consecutiveCorrect++;
        stats.consecutiveIncorrect = 0;
    } else {
        stats.incorrect++;
        stats.consecutiveIncorrect++;
        stats.consecutiveCorrect = 0;
    }
    stats.accuracy = accuracy(stats.correct, stats.attempts);

    const exerciseStats = stats.byExerciseType[type];
    exerciseStats.attempts++;
    if (isCorrect) exerciseStats.correct++;
    else exerciseStats.incorrect++;
    exerciseStats.accuracy = accuracy(exerciseStats.correct, exerciseStats.attempts);

    const after = setMastery(word, before + delta);
    word.isNew = stats.attempts === 0;
    word.isWeak = after < CONFIG.weakThreshold;
    word.status = levelOf(after);

    const review = schedule(word, outcome, after);
    const now = new Date().toISOString();
    const entry = {
        timestamp: now,
        wordId: word.id ?? null,
        packId: word.packId ?? null,
        level: word.level ?? word.cefr ?? null,
        exerciseType: type,
        correct: isCorrect,
        almost: isAlmost,
        outcome,
        userAnswer: answerData.userAnswer ?? answerData.answer ?? '',
        expectedAnswer: answerData.expectedAnswer ?? exercise?.correctAnswer ?? '',
        masteryBefore: before,
        masteryAfter: after,
        masteryDelta: delta,
        nextReview: review.dueAt
    };

    ensureHistory(word).push(entry);
    if (word.history.length > CONFIG.historyLimit) word.history = word.history.slice(-CONFIG.historyLimit);
    word.lastPracticedAt = now;
    word.lastAnswerAt = now;
    word.updatedAt = now;
    word.lastExerciseType = type;
    word.lastAnswerCorrect = isCorrect;
    word.lastAnswerOutcome = outcome;

    if (!DutchTrainer.db?.saveWord) throw new Error('DutchTrainer.db.saveWord is unavailable.');
    await DutchTrainer.db.saveWord(word);

    return {
        word,
        correct: isCorrect,
        almost: isAlmost,
        outcome,
        exerciseType: type,
        masteryBefore: before,
        masteryAfter: after,
        masteryDelta: delta,
        nextReview: review.dueAt,
        dueAt: review.dueAt,
        intervalDays: review.intervalDays,
        stats,
        historyEntry: entry
    };
}

function getWordAccuracy(word) {
    const stats = ensureStats(word);
    return accuracy(stats.correct, stats.attempts);
}

function getWordExerciseAccuracy(word, type) {
    const stats = ensureStats(word).byExerciseType[typeOf(type)];
    return accuracy(stats.correct, stats.attempts);
}

function getWordMasteryStatus(word) {
    return levelOf(masteryOf(word));
}

function getWordPracticeSummary(word) {
    if (!word) return null;
    const stats = ensureStats(word);
    return {
        wordId: word.id ?? null,
        packId: word.packId ?? null,
        mastery: masteryOf(word),
        status: levelOf(masteryOf(word)),
        isNew: Boolean(word.isNew),
        isWeak: Boolean(word.isWeak),
        isDue: Boolean(word.isDue),
        attempts: stats.attempts,
        correct: stats.correct,
        incorrect: stats.incorrect,
        accuracy: stats.accuracy,
        lastPracticedAt: word.lastPracticedAt || null,
        dueAt: word.dueAt || null
    };
}

function calculateVocabularyStats(words) {
    const list = Array.isArray(words) ? words : [];
    if (!list.length) return { total: 0, attempted: 0, newWords: 0, weak: 0, due: 0, mastered: 0, averageMastery: 0, accuracy: 0, progress: 0 };
    let attempted = 0, newWords = 0, weak = 0, due = 0, mastered = 0, totalMastery = 0, correct = 0, attempts = 0;
    for (const word of list) {
        const stats = ensureStats(word);
        const mastery = masteryOf(word);
        totalMastery += mastery;
        attempts += stats.attempts;
        correct += stats.correct;
        if (stats.attempts === 0) newWords++;
        if (mastery < CONFIG.weakThreshold) weak++;
        if (word.isDue || (word.dueAt && new Date(word.dueAt).getTime() <= Date.now())) due++;
        if (mastery >= CONFIG.masteredThreshold) mastered++;
        if (stats.attempts > 0) attempted++;
    }
    const averageMastery = Math.round(totalMastery / list.length);
    return { total: list.length, attempted, newWords, weak, due, mastered, averageMastery, accuracy: accuracy(correct, attempts), progress: averageMastery };
}

function calculateSkillStats(words) {
    const result = {};
    for (const type of TYPES) {
        let attempts = 0, correct = 0;
        for (const word of (Array.isArray(words) ? words : [])) {
            const stats = ensureStats(word).byExerciseType[type];
            attempts += stats.attempts;
            correct += stats.correct;
        }
        result[type] = { type, label: type[0].toUpperCase() + type.slice(1), attempts, correct, incorrect: Math.max(0, attempts - correct), accuracy: accuracy(correct, attempts) };
    }
    return result;
}

function calculatePackStatistics(words) {
    const groups = {};
    for (const word of (Array.isArray(words) ? words : [])) {
        const id = String(word.packId || 'default');
        (groups[id] ??= []).push(word);
    }
    const result = {};
    for (const [id, wordsInPack] of Object.entries(groups)) {
        result[id] = { packId: id, stats: calculateVocabularyStats(wordsInPack), skills: calculateSkillStats(wordsInPack) };
    }
    return result;
}

function previewMasteryChange(word, outcomeOrCorrect) {
    const before = masteryOf(word);
    const outcome = typeof outcomeOrCorrect === 'string' ? outcomeOrCorrect : outcomeOrCorrect ? 'correct' : 'incorrect';
    const delta = CONFIG.rewards[outcome] ?? 0;
    return { before, delta, after: clamp(before + delta) };
}

async function initializeMasteryData() {
    if (!DutchTrainer.db?.getWords) return { processed: 0 };
    const words = await DutchTrainer.db.getWords();
    for (const word of words) {
        const stats = ensureStats(word);
        ensureHistory(word);
        word.mastery = masteryOf(word);
        word.isNew = stats.attempts === 0;
        word.isWeak = word.mastery < CONFIG.weakThreshold;
        await DutchTrainer.db.saveWord(word);
    }
    return { processed: words.length };
}

window.EXERCISE_TYPE_ORDER = window.EXERCISE_TYPE_ORDER || TYPES.slice();
window.MASTERY_CONFIG = CONFIG;
window.updateWordAfterAnswer = updateWordAfterAnswer;
window.getCurrentMastery = masteryOf;
window.getMasteryLevel = levelOf;
window.getWordAccuracy = getWordAccuracy;
window.getWordExerciseAccuracy = getWordExerciseAccuracy;
window.getWordMasteryStatus = getWordMasteryStatus;
window.getWordPracticeSummary = getWordPracticeSummary;
window.calculateVocabularyStats = calculateVocabularyStats;
window.calculateSkillStats = calculateSkillStats;
window.calculatePackStatistics = calculatePackStatistics;
window.previewMasteryChange = previewMasteryChange;
window.initializeMasteryData = initializeMasteryData;
window.DutchTrainerMastery = Object.freeze({ recordAnswer: updateWordAfterAnswer, updateAfterAnswer: updateWordAfterAnswer, policy: CONFIG });
DutchTrainer.mastery = window.DutchTrainerMastery;
