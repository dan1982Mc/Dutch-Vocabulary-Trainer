'use strict';

/*
 * Dutch Vocabulary Trainer V2.4
 * Practice engine only.
 * No DOM access. No localStorage. No UI dependencies.
 */

const DutchTrainer = window.DutchTrainer || (window.DutchTrainer = {});

const TYPES = ['meaning', 'recall', 'fill', 'choose', 'production'];
const DEFAULTS = {
    questionCount: 10,
    exerciseType: 'meaning',
    mode: 'full'
};

const state = {
    active: false,
    completed: false,
    mode: DEFAULTS.mode,
    exerciseType: DEFAULTS.exerciseType,
    questionCount: DEFAULTS.questionCount,
    questions: [],
    currentIndex: 0,
    currentQuestion: null,
    currentWord: null,
    answered: false,
    feedback: null,
    startedAt: null,
    completedAt: null,
    correctCount: 0,
    incorrectCount: 0,
    answerCount: 0,
    selectedVocabularyIds: [],
    selectedPackId: null,
    vocabularySource: 'all',
    results: [],
    sessionId: null
};

const listeners = {
    start: new Set(),
    answer: new Set(),
    next: new Set(),
    complete: new Set(),
    state: new Set()
};

function clone(value) {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value));
}

function emit(type, value) {
    for (const listener of listeners[type] || []) {
        try { listener(clone(value)); } catch (error) { console.warn(error); }
    }
    return value;
}

function now() {
    return new Date().toISOString();
}

function normalizeType(type) {
    const value = String(type || DEFAULTS.exerciseType).trim().toLowerCase();
    const aliases = {
        'fill-sentence': 'fill',
        'choose-word': 'choose',
        'multiple-choice': 'meaning'
    };
    const normalized = aliases[value] || value;
    return normalized === 'mixed' || TYPES.includes(normalized) ? normalized : DEFAULTS.exerciseType;
}

function normalizeCount(value) {
    const count = Number(value);
    return Number.isFinite(count)
        ? Math.max(1, Math.min(500, Math.floor(count)))
        : DEFAULTS.questionCount;
}

function wordId(word) {
    return word?.id ?? word?.wordId ?? null;
}

function packId(word) {
    return word?.packId ?? word?.wordPackId ?? word?.pack?.id ?? null;
}

function text(value) {
    return String(value ?? '').trim();
}

function normalizedText(value) {
    return text(value).toLocaleLowerCase('nl-NL').replace(/\s+/g, ' ');
}

function shuffle(values) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function answerValue(answer) {
    return answer && typeof answer === 'object'
        ? text(answer.value ?? answer.answer ?? answer.text ?? answer.label)
        : text(answer);
}

function correctAnswer(question) {
    return text(question?.exercise?.correctAnswer);
}

function isChoice(question) {
    return question?.exercise?.inputType === 'choice' ||
        ['meaning', 'choose'].includes(question?.type);
}

function checkAnswerValue(answer, question) {
    const value = answerValue(answer);
    const expected = correctAnswer(question);

    if (!value) {
        return { correct: false, almost: false, empty: true, score: 0 };
    }

    if (isChoice(question)) {
        const correct = normalizedText(value) === normalizedText(expected);
        return { correct, almost: false, empty: false, score: correct ? 1 : 0 };
    }

    const exact = normalizedText(value) === normalizedText(expected);
    if (exact) return { correct: true, almost: false, empty: false, score: 1 };

    const similarity = typeof DutchTrainer.similarity?.calculate === 'function'
        ? Number(DutchTrainer.similarity.calculate(value, expected))
        : 0;
    const threshold = Number(DutchTrainer.similarity?.threshold ?? 0.75);
    const almost = similarity >= threshold;

    return {
        correct: false,
        almost,
        empty: false,
        score: similarity,
        threshold,
        expected
    };
}

function buildQuestion(word, type, vocabulary) {
    if (!DutchTrainer.exercises?.create) {
        throw new Error('DutchTrainer.exercises.create is unavailable.');
    }

    const exercise = DutchTrainer.exercises.create(word, type, vocabulary);
    return {
        id: `${wordId(word)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        wordId: wordId(word),
        packId: packId(word),
        type: normalizeType(type),
        word: clone(word),
        exercise: clone(exercise),
        answered: false,
        answer: null,
        result: null,
        feedback: null
    };
}

function buildQuestions(words, count, type) {
    const pool = shuffle(words);
    const types = type === 'mixed'
        ? Array.from({ length: count }, (_, i) => TYPES[i % TYPES.length])
        : Array(count).fill(type);

    return Array.from({ length: count }, (_, i) =>
        buildQuestion(pool[i % pool.length], types[i], words)
    );
}

async function getVocabulary(options = {}) {
    if (Array.isArray(options.vocabulary)) {
        return {
            words: options.vocabulary,
            selection: DutchTrainer.vocabulary?.getSelection?.() || { source: 'all', packId: null }
        };
    }

    if (!DutchTrainer.vocabulary?.getSelected) {
        throw new Error('DutchTrainer.vocabulary.getSelected is unavailable.');
    }

    return {
        words: await DutchTrainer.vocabulary.getSelected(),
        selection: DutchTrainer.vocabulary.getSelection?.() || { source: 'all', packId: null }
    };
}

async function start(options = {}) {
    const type = normalizeType(options.exerciseType ?? DEFAULTS.exerciseType);
    const questionCount = normalizeCount(options.questionCount ?? DEFAULTS.questionCount);
    const resolved = await getVocabulary(options);

    if (!resolved.words.length) {
        return { success: false, reason: 'no-vocabulary', state: getState() };
    }

    const questions = buildQuestions(resolved.words, questionCount, type);

    Object.assign(state, {
        active: true,
        completed: false,
        mode: options.mode || DEFAULTS.mode,
        exerciseType: type,
        questionCount,
        questions,
        currentIndex: 0,
        currentQuestion: questions[0] || null,
        currentWord: questions[0]?.word || null,
        answered: false,
        feedback: null,
        startedAt: now(),
        completedAt: null,
        correctCount: 0,
        incorrectCount: 0,
        answerCount: 0,
        selectedVocabularyIds: resolved.words.map(wordId).filter(Boolean),
        selectedPackId: resolved.selection?.packId ?? null,
        vocabularySource: resolved.selection?.source ?? 'all',
        results: [],
        sessionId: `session-${Date.now()}`
    });

    emit('start', state);
    emit('state', state);
    return { success: true, question: state.currentQuestion, state: getState() };
}

async function answer(answer) {
    if (!state.active) return { success: false, reason: 'no-active-session' };
    if (state.answered) return { success: false, reason: 'already-answered', feedback: state.feedback };
    if (!state.currentQuestion) return { success: false, reason: 'no-question' };

    const question = state.currentQuestion;
    const result = checkAnswerValue(answer, question);

    if (result.empty) return { success: false, reason: 'empty-answer', result };

    const masteryBefore = Number(question.word?.mastery ?? 0);
    let masteryResult = null;

    if (DutchTrainer.mastery?.recordAnswer) {
        masteryResult = await DutchTrainer.mastery.recordAnswer(question.word, {
            correct: result.correct,
            almost: result.almost,
            score: result.score,
            exerciseType: question.type,
            answer: answerValue(answer),
            userAnswer: answerValue(answer),
            expectedAnswer: correctAnswer(question),
            sessionId: state.sessionId
        });
    }

    const masteryAfter = Number(masteryResult?.masteryAfter ?? question.word?.mastery ?? masteryBefore);
    const outcome = result.correct ? 'correct' : result.almost ? 'almost' : 'incorrect';
    const feedback = {
        correct: result.correct,
        almost: result.almost,
        outcome,
        answer: answerValue(answer),
        correctAnswer: correctAnswer(question),
        masteryBefore: masteryResult?.masteryBefore ?? masteryBefore,
        masteryAfter,
        masteryDelta: masteryResult?.masteryDelta ?? (masteryAfter - masteryBefore),
        nextReview: masteryResult?.nextReview ?? masteryResult?.dueAt ?? null
    };

    question.answered = true;
    question.answer = answerValue(answer);
    question.result = result;
    question.feedback = feedback;
    state.answered = true;
    state.feedback = feedback;
    state.answerCount++;
    if (result.correct) state.correctCount++;
    else state.incorrectCount++;

    state.results.push({
        questionId: question.id,
        wordId: question.wordId,
        packId: question.packId,
        type: question.type,
        answer: question.answer,
        correct: result.correct,
        almost: result.almost,
        outcome,
        score: result.score,
        masteryBefore: feedback.masteryBefore,
        masteryAfter: feedback.masteryAfter,
        masteryDelta: feedback.masteryDelta,
        dueAt: feedback.nextReview,
        answeredAt: now()
    });

    emit('answer', { result, feedback, question, state });
    emit('state', state);

    return {
        success: true,
        correct: result.correct,
        almost: result.almost,
        outcome,
        feedback,
        mastery: masteryAfter,
        masteryBefore: feedback.masteryBefore,
        masteryAfter,
        masteryDelta: feedback.masteryDelta,
        state: getState()
    };
}

async function next() {
    if (!state.active) return { success: false, reason: 'no-active-session' };
    if (!state.answered) return { success: false, reason: 'answer-required' };

    state.currentIndex++;

    if (state.currentIndex >= state.questions.length) {
        return finish();
    }

    state.currentQuestion = state.questions[state.currentIndex];
    state.currentWord = state.currentQuestion.word;
    state.answered = false;
    state.feedback = null;

    emit('next', state);
    emit('state', state);
    return { success: true, completed: false, question: state.currentQuestion, state: getState() };
}

async function finish() {
    if (!state.active) return getState();

    state.active = false;
    state.completed = true;
    state.completedAt = now();

    const session = {
        sessionId: state.sessionId,
        schemaVersion: 3,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
        mode: state.mode,
        exerciseType: state.exerciseType,
        questionCount: state.questionCount,
        selectedPackId: state.selectedPackId,
        vocabularySource: state.vocabularySource,
        selectedVocabularyIds: state.selectedVocabularyIds,
        answerCount: state.answerCount,
        correctCount: state.correctCount,
        incorrectCount: state.incorrectCount,
        results: state.results
    };

    if (DutchTrainer.db?.saveSession) {
        await DutchTrainer.db.saveSession(session);
    }

    emit('complete', state);
    emit('state', state);
    return { success: true, completed: true, session, state: getState() };
}

function reset() {
    Object.assign(state, {
        active: false,
        completed: false,
        questions: [],
        currentIndex: 0,
        currentQuestion: null,
        currentWord: null,
        answered: false,
        feedback: null,
        startedAt: null,
        completedAt: null,
        correctCount: 0,
        incorrectCount: 0,
        answerCount: 0,
        selectedVocabularyIds: [],
        selectedPackId: null,
        vocabularySource: 'all',
        results: [],
        sessionId: null
    });
    emit('state', state);
}

function getState() {
    return clone(state);
}

function on(type, listener) {
    if (!listeners[type] || typeof listener !== 'function') return () => {};
    listeners[type].add(listener);
    return () => listeners[type].delete(listener);
}

DutchTrainer.practice = {
    TYPES,
    DEFAULTS,
    state,
    getState,
    start,
    answer,
    next,
    finish,
    reset,
    on
};
