/* =========================================================
   DUTCH TRAINER V2.0
   js/practice.js

   Practice session engine.

   Architecture A rule:
   selection.js owns vocabulary selection.
   exercises.js owns exercise creation.
========================================================= */

const PRACTICE_EXERCISE_TYPES = { MEANING: "meaning", RECALL: "recall", FILL: "fill", CHOOSE: "choose", PRODUCTION: "production", MIXED: "mixed" };
const PRACTICE_MODES = { START: "start", FULL: "full" };
const PRACTICE_DEFAULTS = { questionCount: 10, exerciseType: "meaning", mode: "full", feedback: true, mixedDistribution: "balanced" };

const PracticeState = {
    active: false, mode: "full", exerciseType: "meaning", questionCount: 10, questions: [], currentIndex: 0,
    currentQuestion: null, currentExercise: null, currentWord: null, currentAnswer: null, answered: false,
    feedback: null, completed: false, startedAt: null, completedAt: null, correctCount: 0, incorrectCount: 0,
    answerCount: 0, selectedVocabulary: [], selectedVocabularyIds: [], selectedPackId: null,
    vocabularySource: "all", mixedTypes: [], results: [], sessionId: null, lastAnswerAt: null
};
const PracticeListeners = { answer: [], feedback: [], next: [], complete: [], start: [], state: [] };

function practiceClone(value) { if (value === null || value === undefined) return value; try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; } }
function practiceNowISO() { return new Date().toISOString(); }
function practiceNormalizeCount(value) { const n = Number(value); return Number.isFinite(n) ? Math.max(1, Math.min(500, Math.floor(n))) : 10; }
function practiceGetWordId(word) { return word ? (word.id ?? word.wordId ?? word.uuid ?? null) : null; }
function practiceGetPackId(word) { return word ? (word.packId ?? word.wordPackId ?? word.pack?.id ?? null) : null; }
function practiceNormalizeText(value) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function practiceCleanText(value) { return String(value ?? "").trim(); }
function practiceGetDutch(word) { return String(word?.word ?? word?.term ?? word?.dutch ?? word?.text ?? "").trim(); }
function practiceGetMeaning(word) { return String(word?.meaning ?? word?.english ?? word?.translation ?? word?.definition ?? "").trim(); }

function practiceSimilarity(answer, expected) {
    const a = practiceNormalizeText(answer), b = practiceNormalizeText(expected); if (!a || !b) return 0;
    if (typeof calculateSimilarity === "function") return Number(calculateSimilarity(a, b));
    if (typeof getSimilarityScore === "function") return Number(getSimilarityScore(a, b));
    if (window.DutchTrainerSimilarity?.calculate) return Number(window.DutchTrainerSimilarity.calculate(a, b));
    return a === b ? 1 : 0;
}
function practiceSimilarityThreshold() { return Number(window.DutchTrainerSimilarity?.threshold ?? window.SIMILARITY_THRESHOLD ?? 0.75); }
function practiceAnswers(word, exercise) {
    const candidates = [];
    for (const value of [exercise?.acceptedAnswers, exercise?.answer, exercise?.correctAnswer]) {
        if (Array.isArray(value)) candidates.push(...value); else if (value != null) candidates.push(value);
    }
    if (["recall", "fill", "production"].includes(exercise?.type)) candidates.push(practiceGetDutch(word));
    if (exercise?.type === "meaning") candidates.push(practiceGetMeaning(word));
    return [...new Set(candidates.map(v => practiceCleanText(v)).filter(Boolean))];
}
function checkPracticeAnswerValue(answer, question) {
    const value = answer && typeof answer === "object" ? (answer.value ?? answer.answer ?? answer.text ?? answer.label ?? "") : answer;
    const expected = question.exercise?.correctAnswer ?? practiceAnswers(question.word, question.exercise)[0] ?? "";
    if (!practiceCleanText(value)) return { empty: true, correct: false, score: 0, threshold: practiceSimilarityThreshold(), matchedAnswer: null };
    if (question.exercise?.inputType === "choice" || ["choose", "meaning"].includes(question.type)) {
        const correct = practiceNormalizeText(value) === practiceNormalizeText(expected);
        return { empty: false, correct, score: correct ? 1 : 0, threshold: 1, matchedAnswer: expected };
    }
    const answers = practiceAnswers(question.word, question.exercise); let score = 0, matchedAnswer = null;
    for (const candidate of answers) { const current = practiceSimilarity(value, candidate); if (current > score) { score = current; matchedAnswer = candidate; } }
    const threshold = practiceSimilarityThreshold(); return { empty: false, correct: score >= threshold, score, threshold, matchedAnswer };
}

function normalizePracticeExerciseType(type) {
    if (typeof normalizeExerciseType === "function") return normalizeExerciseType(type) || "meaning";
    const value = String(type || "meaning").trim().toLowerCase();
    return ({ "fill-sentence": "fill", "choose-word": "choose" })[value] || value;
}
function buildMixedExerciseTypes(count) { const types = ["meaning", "recall", "fill", "choose", "production"]; return Array.from({ length: count }, (_, i) => types[i % types.length]); }
function practiceShuffle(array) { const result = [...array]; for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; }

/* Canonical selection. An explicit vocabulary array is a transient pool for Start Practice only. */
async function resolvePracticeVocabulary(options = {}) {
    if (Array.isArray(options.vocabulary)) {
        return { words: options.vocabulary, selection: typeof getVocabularySelection === "function" ? getVocabularySelection() : { source: "all", packId: null } };
    }
    if (typeof getSelectedVocabulary !== "function") throw new Error("selection.js is required before practice.js");
    const words = await getSelectedVocabulary();
    return { words: Array.isArray(words) ? words : [], selection: typeof getVocabularySelection === "function" ? getVocabularySelection() : { source: "all", packId: null } };
}

/* exercises.js is the single exercise factory; no duplicate V2 factory is kept here. */
function buildPracticeExercise(word, type, vocabulary) {
    if (typeof createExercise !== "function") throw new Error("exercises.js: createExercise() is unavailable.");
    const normalized = normalizePracticeExerciseType(type);
    const exercise = createExercise(word, normalized, vocabulary);
    return { ...practiceClone(exercise), type: normalized, wordId: practiceGetWordId(word), word };
}
function buildPracticeQuestions(vocabulary, count, exerciseType) {
    if (!vocabulary.length) return [];
    const total = practiceNormalizeCount(count);
    const normalized = normalizePracticeExerciseType(exerciseType);
    const types = normalized === "mixed" ? buildMixedExerciseTypes(total) : Array(total).fill(normalized);
    const pool = practiceShuffle(vocabulary);
    return Array.from({ length: total }, (_, index) => {
        const word = pool[index % pool.length], type = types[index], exercise = buildPracticeExercise(word, type, vocabulary);
        return { id: `${practiceGetWordId(word)}-${index}-${Date.now()}`, wordId: practiceGetWordId(word), packId: practiceGetPackId(word), type, word, exercise, answered: false, answer: null, result: null, feedback: null };
    });
}

function getPracticeState() { return practiceClone(PracticeState); }
function emitPracticeEvent(type, payload) { for (const listener of PracticeListeners[type] || []) { try { listener(payload); } catch (error) { console.warn(`Practice ${type} listener failed:`, error); } } try { window.dispatchEvent(new CustomEvent(`practice-${type}`, { detail: payload })); } catch (_) {} }
function onPracticeEvent(type, listener) { if (!PracticeListeners[type] || typeof listener !== "function") return () => {}; PracticeListeners[type].push(listener); return () => { const i = PracticeListeners[type].indexOf(listener); if (i >= 0) PracticeListeners[type].splice(i, 1); }; }
function getPracticeExpectedAnswers(question) { return question ? practiceAnswers(question.word, question.exercise) : []; }
function extractPracticeAnswer(answer, question) { return answer && typeof answer === "object" ? (answer.value ?? answer.answer ?? answer.text ?? answer.label ?? "") : (answer ?? question?.currentAnswer ?? ""); }
function extractPracticeMastery(result, word) { for (const value of [result?.mastery, result?.newMastery, result?.masteryScore, result?.word?.mastery, word?.mastery, word?.masteryScore]) { const n = Number(value); if (Number.isFinite(n)) return Math.max(0, Math.min(100, n)); } return 0; }

async function updatePracticeMastery(word, options) { if (window.DutchTrainerMastery?.recordAnswer) return window.DutchTrainerMastery.recordAnswer(word, options); if (typeof updateWordAfterAnswer === "function") return updateWordAfterAnswer(word, options); throw new Error("mastery.js API is unavailable"); }
async function updatePracticeSchedule(word, options) { if (typeof scheduleAndSaveAfterAnswer === "function") return scheduleAndSaveAfterAnswer(word, options); if (window.DutchTrainerScheduler?.scheduleAndSaveAfterAnswer) return window.DutchTrainerScheduler.scheduleAndSaveAfterAnswer(word, options); if (typeof scheduleAfterAnswer === "function") { const result = await scheduleAfterAnswer(word, options); if (typeof saveWord === "function") await saveWord(word); return result; } throw new Error("scheduler.js API is unavailable"); }

async function checkPracticeAnswer(answer) {
    if (!PracticeState.active) return { success: false, reason: "no-active-session" };
    if (PracticeState.answered) return { success: false, reason: "already-answered", feedback: PracticeState.feedback };
    const question = PracticeState.currentQuestion; if (!question) return { success: false, reason: "no-question" };
    const result = checkPracticeAnswerValue(answer, question); if (result.empty) return { success: false, reason: "empty-answer", result };
    question.answered = true; question.answer = extractPracticeAnswer(answer, question); question.result = result;
    PracticeState.answered = true; PracticeState.answerCount++; PracticeState.lastAnswerAt = practiceNowISO();
    if (result.correct) PracticeState.correctCount++; else PracticeState.incorrectCount++;
    const masteryResult = await updatePracticeMastery(question.word, { correct: result.correct, score: result.score, exerciseType: question.type, answer: question.answer, sessionId: PracticeState.sessionId });
    const mastery = extractPracticeMastery(masteryResult, question.word);
    const scheduleResult = await updatePracticeSchedule(question.word, { correct: result.correct, mastery, exerciseType: question.type, sessionId: PracticeState.sessionId });
    const feedback = { correct: result.correct, message: result.correct ? "Correct!" : "Not quite.", answer: question.answer, correctAnswer: question.exercise?.correctAnswer ?? result.matchedAnswer, score: result.score, threshold: result.threshold, mastery, nextReview: scheduleResult?.dueAt ?? question.word?.dueAt ?? null };
    question.feedback = feedback; PracticeState.feedback = feedback;
    PracticeState.results.push({ questionId: question.id, wordId: question.wordId, packId: question.packId, type: question.type, answer: question.answer, correct: result.correct, score: result.score, threshold: result.threshold ?? null, mastery, dueAt: scheduleResult?.dueAt ?? question.word?.dueAt ?? null, intervalDays: scheduleResult?.intervalDays ?? question.word?.intervalDays ?? null, answeredAt: PracticeState.lastAnswerAt });
    emitPracticeEvent("answer", { result, feedback, mastery, schedule: scheduleResult, question, state: getPracticeState() }); emitPracticeEvent("feedback", feedback); emitPracticeEvent("state", getPracticeState());
    return { success: true, correct: result.correct, score: result.score, threshold: result.threshold, feedback, mastery, schedule: scheduleResult, question, state: getPracticeState() };
}
function nextPracticeQuestion() { if (!PracticeState.active) return { success: false, reason: "no-active-session" }; if (!PracticeState.answered) return { success: false, reason: "answer-required" }; PracticeState.currentIndex++; if (PracticeState.currentIndex >= PracticeState.questions.length) { completePracticeSession(); return { success: true, completed: true, state: getPracticeState() }; } const q = PracticeState.questions[PracticeState.currentIndex]; PracticeState.currentQuestion = q; PracticeState.currentExercise = q.exercise; PracticeState.currentWord = q.word; PracticeState.currentAnswer = null; PracticeState.answered = false; PracticeState.feedback = null; emitPracticeEvent("next", getPracticeState()); emitPracticeEvent("state", getPracticeState()); return { success: true, completed: false, question: q, state: getPracticeState() }; }
async function handlePracticeEnter(answer = undefined) { if (!PracticeState.active) return { handled: false, reason: "no-active-session" }; return PracticeState.answered ? { handled: true, action: "next", result: nextPracticeQuestion() } : { handled: true, action: "check", result: await checkPracticeAnswer(answer) }; }

async function startPractice(options = {}) {
    const resolved = await resolvePracticeVocabulary(options), questionCount = practiceNormalizeCount(options.questionCount ?? 10), exerciseType = normalizePracticeExerciseType(options.exerciseType ?? "meaning");
    if (!resolved.words.length) return { success: false, reason: "no-vocabulary", selection: resolved.selection, state: getPracticeState() };
    const questions = buildPracticeQuestions(resolved.words, questionCount, exerciseType);
    Object.assign(PracticeState, { active: true, completed: false, mode: options.mode ?? "full", exerciseType, questionCount, questions, currentIndex: 0, currentQuestion: questions[0] ?? null, currentExercise: questions[0]?.exercise ?? null, currentWord: questions[0]?.word ?? null, currentAnswer: null, answered: false, feedback: null, startedAt: practiceNowISO(), completedAt: null, correctCount: 0, incorrectCount: 0, answerCount: 0, selectedVocabulary: practiceClone(resolved.words), selectedVocabularyIds: resolved.words.map(practiceGetWordId), selectedPackId: resolved.selection?.packId ?? null, vocabularySource: resolved.selection?.source ?? "all", mixedTypes: exerciseType === "mixed" ? buildMixedExerciseTypes(questionCount) : [], results: [], sessionId: `session-${Date.now()}`, lastAnswerAt: null });
    emitPracticeEvent("start", getPracticeState()); emitPracticeEvent("state", getPracticeState()); return { success: true, question: PracticeState.currentQuestion, state: getPracticeState() };
}
function startPracticeSession(options = {}) { return startPractice(options); }
function beginPractice(options = {}) { return startPractice(options); }
function completePracticeSession() { if (!PracticeState.active) return getPracticeState(); PracticeState.active = false; PracticeState.completed = true; PracticeState.completedAt = practiceNowISO(); emitPracticeEvent("complete", getPracticeState()); emitPracticeEvent("state", getPracticeState()); return getPracticeState(); }
function resetPracticeState() { Object.assign(PracticeState, { active: false, completed: false, questions: [], currentIndex: 0, currentQuestion: null, currentExercise: null, currentWord: null, currentAnswer: null, answered: false, feedback: null, correctCount: 0, incorrectCount: 0, answerCount: 0, selectedVocabulary: [], selectedVocabularyIds: [], selectedPackId: null, vocabularySource: "all", mixedTypes: [], results: [], sessionId: null, startedAt: null, completedAt: null, lastAnswerAt: null }); emitPracticeEvent("state", getPracticeState()); }
function initializePractice() { return getPracticeState(); }
function initPractice() { return initializePractice(); }

window.DutchTrainerPractice = { state: PracticeState, getState: getPracticeState, start: startPractice, startPractice, startPracticeSession, beginPractice, checkAnswer: checkPracticeAnswer, checkPracticeAnswer, next: nextPracticeQuestion, nextQuestion: nextPracticeQuestion, handleEnter: handlePracticeEnter, complete: completePracticeSession, reset: resetPracticeState, on: onPracticeEvent, getExpectedAnswers: getPracticeExpectedAnswers };
