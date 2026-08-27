'use strict';

/* Dutch Vocabulary Trainer V2.4 — stable practice core. */
const DutchTrainer = window.DutchTrainer || (window.DutchTrainer = {});

const DEFAULTS = Object.freeze({ exerciseType: 'meaning', questionCount: 20, mode: 'start' });
const TYPES = Object.freeze(['meaning', 'recall', 'fill', 'choose', 'production']);

let state = {
    active: false,
    completed: false,
    mode: DEFAULTS.mode,
    exerciseType: DEFAULTS.exerciseType,
    questionCount: 0,
    currentIndex: 0,
    questions: [],
    correctCount: 0,
    answerCount: 0,
    startedAt: null,
    finishedAt: null,
    selectedVocabulary: [],
    selection: { source: 'all', packId: null }
};

const listeners = new Map();

function normalizeType(value) {
    const type = String(value || DEFAULTS.exerciseType).trim().toLowerCase();
    const aliases = { 'fill-sentence': 'fill', 'choose-word': 'choose', 'multiple-choice': 'meaning' };
    const normalized = aliases[type] || type;
    return TYPES.includes(normalized) || normalized === 'mixed' ? normalized : DEFAULTS.exerciseType;
}

function normalizeCount(value) {
    const n = Number(value);
    return Math.max(1, Math.min(500, Number.isFinite(n) ? Math.floor(n) : DEFAULTS.questionCount));
}

function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function wordId(word) {
    return String(word?.id ?? word?.wordId ?? word?.dutch ?? word?.word ?? '');
}

function emit(event, payload) {
    (listeners.get(event) || []).forEach(fn => {
        try { fn(payload); } catch (error) { console.warn(error); }
    });
}

function getState() { return clone(state); }

function answerValue(answer) {
    return answer && typeof answer === 'object'
        ? String(answer.value ?? answer.answer ?? answer.text ?? answer.label ?? '').trim()
        : String(answer ?? '').trim();
}

async function getVocabulary(options = {}) {
    if (Array.isArray(options.vocabulary)) {
        return { words: options.vocabulary, selection: { source: 'all', packId: null } };
    }
    if (!DutchTrainer.vocabulary?.getSelected) throw new Error('DutchTrainer.vocabulary.getSelected is unavailable.');
    return {
        words: await DutchTrainer.vocabulary.getSelected(),
        selection: DutchTrainer.vocabulary.getSelection?.() || { source: 'all', packId: null }
    };
}

function buildQuestion(word, type, vocabulary) {
    const exercise = DutchTrainer.exercises?.create?.(word, type, vocabulary);
    if (!exercise) throw new Error(`Exercise '${type}' is unavailable.`);
    return {
        id: `${wordId(word)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        wordId: wordId(word), type, word: clone(word), exercise: clone(exercise),
        answered: false, answer: null, result: null, feedback: null
    };
}

function shuffle(values) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function buildQuestions(words, count, type) {
    const pool = shuffle(words);
    return Array.from({ length: count }, (_, index) => {
        const questionType = type === 'mixed' ? TYPES[index % TYPES.length] : type;
        return buildQuestion(pool[index % pool.length], questionType, words);
    });
}

function checkAnswerValue(question, answer) {
    const value = answerValue(answer);
    if (!value) return { correct: false, almost: false, empty: true, score: 0 };
    const exercise = DutchTrainer.exercises?.get?.(question.type);
    if (exercise?.check) {
        const correct = Boolean(exercise.check(question.exercise, value));
        return { correct, almost: false, empty: false, score: correct ? 1 : 0, expected: question.exercise.correctAnswer || question.exercise.answer || '' };
    }
    return { correct: false, almost: false, empty: false, score: 0 };
}

async function start(options = {}) {
    const type = normalizeType(options.exerciseType);
    const questionCount = normalizeCount(options.questionCount);
    const resolved = await getVocabulary(options);
    if (!resolved.words.length) return { success: false, reason: 'no-vocabulary', state: getState() };
    const questions = buildQuestions(resolved.words, questionCount, type);
    state = {
        active: true, completed: false, mode: options.mode || DEFAULTS.mode,
        exerciseType: type, questionCount: questions.length, currentIndex: 0, questions,
        correctCount: 0, answerCount: 0, startedAt: new Date().toISOString(), finishedAt: null,
        selectedVocabulary: clone(resolved.words), selection: clone(resolved.selection)
    };
    emit('start', getState());
    return { success: true, state: getState(), question: clone(state.questions[0]) };
}

async function answer(answer) {
    if (!state.active || state.completed) throw new Error('No active practice session.');
    const question = state.questions[state.currentIndex];
    if (question.answered) return { success: false, reason: 'already-answered', state: getState(), question: clone(question) };
    const value = answerValue(answer);
    const check = checkAnswerValue(question, value);
    if (check.empty) return { success: false, reason: 'empty-answer', state: getState(), question: clone(question) };
    let masteryResult = null;
    if (DutchTrainer.mastery?.recordAnswer) {
        masteryResult = await DutchTrainer.mastery.recordAnswer(question.word, {
            correct: check.correct, almost: check.almost, userAnswer: value,
            expectedAnswer: check.expected, exerciseType: question.type
        }, question.exercise);
    }
    question.answered = true; question.answer = value;
    question.result = check.correct ? 'correct' : (check.almost ? 'almost' : 'incorrect');
    question.feedback = { ...check, mastery: masteryResult?.masteryAfter ?? question.word.mastery ?? 0 };
    state.answerCount++; if (check.correct) state.correctCount++;
    emit('answer', { question: clone(question), result: clone(masteryResult || check), state: getState() });
    return { success: true, correct: check.correct, almost: check.almost, feedback: clone(question.feedback), mastery: masteryResult?.masteryAfter, historyEntry: masteryResult?.historyEntry, state: getState(), question: clone(question) };
}

async function finish() {
    if (!state.active) return { success: false, reason: 'no-active-session', state: getState() };
    if (state.completed) return { success: true, state: getState() };
    state.completed = true; state.active = false; state.finishedAt = new Date().toISOString();
    const session = {
        id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startedAt: state.startedAt, finishedAt: state.finishedAt, exerciseType: state.exerciseType,
        mode: state.mode, questionCount: state.questionCount, answerCount: state.answerCount,
        correctCount: state.correctCount, selectedVocabulary: clone(state.selectedVocabulary), selection: clone(state.selection)
    };
    if (DutchTrainer.history?.saveSession) await DutchTrainer.history.saveSession(session);
    state.session = session; emit('finish', { session: clone(session), state: getState() });
    return { success: true, session: clone(session), state: getState() };
}

async function next() {
    if (!state.active) return { completed: true, state: getState() };
    if (!state.questions[state.currentIndex]?.answered) throw new Error('Answer the current question first.');
    if (state.currentIndex >= state.questions.length - 1) return { completed: true, ...(await finish()) };
    state.currentIndex++; emit('next', getState());
    return { completed: false, state: getState(), question: clone(state.questions[state.currentIndex]) };
}

function reset() {
    state = { ...state, active: false, completed: false, currentIndex: 0, questions: [], correctCount: 0, answerCount: 0, startedAt: null, finishedAt: null, selectedVocabulary: [], session: undefined };
    emit('reset', getState()); return getState();
}

function on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler); return () => listeners.get(event)?.delete(handler);
}

DutchTrainer.practice = Object.freeze({ start, answer, next, finish, reset, getState, on });
window.DutchTrainerPractice = DutchTrainer.practice;
window.getPracticeState = getState;
