/* =========================================================
   DUTCH TRAINER V2.0
   js/practice.js

   Practice session engine.

   Architecture A rule:
   selection.js is the sole owner of vocabulary selection.
   Practice consumes getSelectedVocabulary() and never
   re-implements All / Pack / New / Weak / Due filtering.
========================================================= */

const PRACTICE_EXERCISE_TYPES = {
    MEANING: "meaning",
    RECALL: "recall",
    FILL_SENTENCE: "fill-sentence",
    CHOOSE_WORD: "choose-word",
    PRODUCTION: "production",
    MIXED: "mixed"
};

const PRACTICE_MODES = {
    START: "start",
    FULL: "full"
};

const PRACTICE_DEFAULTS = {
    questionCount: 10,
    exerciseType: PRACTICE_EXERCISE_TYPES.MEANING,
    mode: PRACTICE_MODES.FULL,
    feedback: true,
    mixedDistribution: "balanced"
};

const PracticeState = {
    active: false,
    mode: PRACTICE_MODES.FULL,
    exerciseType: PRACTICE_EXERCISE_TYPES.MEANING,
    questionCount: PRACTICE_DEFAULTS.questionCount,
    questions: [],
    currentIndex: 0,
    currentQuestion: null,
    currentExercise: null,
    currentWord: null,
    currentAnswer: null,
    answered: false,
    feedback: null,
    completed: false,
    startedAt: null,
    completedAt: null,
    correctCount: 0,
    incorrectCount: 0,
    answerCount: 0,
    selectedVocabulary: [],
    selectedVocabularyIds: [],
    selectedPackId: null,
    vocabularySource: "all",
    mixedTypes: [],
    results: [],
    sessionId: null,
    lastAnswerAt: null
};

const PracticeListeners = {
    answer: [],
    feedback: [],
    next: [],
    complete: [],
    start: [],
    state: []
};

function practiceClone(value) {
    if (value === null || value === undefined) return value;
    try { return JSON.parse(JSON.stringify(value)); }
    catch (error) { return value; }
}

function practiceNow() { return new Date(); }
function practiceNowISO() { return practiceNow().toISOString(); }

function practiceNormalizeCount(value) {
    const count = Number(value);
    if (!Number.isFinite(count)) return PRACTICE_DEFAULTS.questionCount;
    return Math.max(1, Math.min(500, Math.floor(count)));
}

function practiceGetWordId(word) {
    return word ? (word.id ?? word.wordId ?? word.uuid ?? null) : null;
}

function practiceGetPackId(word) {
    return word ? (word.packId ?? word.wordPackId ?? word.pack?.id ?? null) : null;
}

function practiceNormalizeText(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim().toLowerCase().replace(/\s+/g, " ");
}

function practiceCleanText(value) { return String(value ?? "").trim(); }

function practiceGetDutch(word) {
    return word ? (word.dutch ?? word.word ?? word.term ?? word.expression ?? word.text ?? "") : "";
}

function practiceGetMeaning(word) {
    return word ? (word.meaning ?? word.translation ?? word.english ?? word.definition ?? "") : "";
}

function practiceGetExampleSentence(word) {
    return word ? (word.exampleSentence ?? word.example ?? word.sentence ?? word.context ?? "") : "";
}

function practiceGetAcceptedAnswers(word, exercise = null) {
    const values = [];
    if (exercise) {
        if (Array.isArray(exercise.acceptedAnswers)) values.push(...exercise.acceptedAnswers);
        if (exercise.answer !== undefined) values.push(exercise.answer);
        if (exercise.correctAnswer !== undefined) values.push(exercise.correctAnswer);
    }
    if (word) {
        if (Array.isArray(word.acceptedAnswers)) values.push(...word.acceptedAnswers);
        if (Array.isArray(word.answers)) values.push(...word.answers);
        if (Array.isArray(word.synonyms)) values.push(...word.synonyms);
    }
    const meaning = practiceGetMeaning(word);
    if (meaning) values.push(meaning);
    return [...new Set(values.filter(v => v !== null && v !== undefined && String(v).trim()).map(v => String(v).trim()))];
}

function practiceSimilarity(answer, expected) {
    const userAnswer = practiceNormalizeText(answer);
    const expectedAnswer = practiceNormalizeText(expected);
    if (!userAnswer || !expectedAnswer) return 0;
    if (typeof calculateSimilarity === "function") return Number(calculateSimilarity(userAnswer, expectedAnswer));
    if (typeof getSimilarityScore === "function") return Number(getSimilarityScore(userAnswer, expectedAnswer));
    if (window.DutchTrainerSimilarity) {
        const similarity = window.DutchTrainerSimilarity;
        if (typeof similarity.calculate === "function") return Number(similarity.calculate(userAnswer, expectedAnswer));
        if (typeof similarity.score === "function") return Number(similarity.score(userAnswer, expectedAnswer));
    }
    return userAnswer === expectedAnswer ? 1 : 0;
}

function practiceGetSimilarityThreshold() {
    if (window.DutchTrainerSimilarity) {
        const similarity = window.DutchTrainerSimilarity;
        if (Number.isFinite(Number(similarity.threshold))) return Number(similarity.threshold);
        if (Number.isFinite(Number(similarity.config?.threshold))) return Number(similarity.config.threshold);
    }
    if (Number.isFinite(Number(window.SIMILARITY_THRESHOLD))) return Number(window.SIMILARITY_THRESHOLD);
    return 0.75;
}

function practiceCheckTypedAnswer(answer, acceptedAnswers) {
    const cleanAnswer = practiceCleanText(answer);
    if (!cleanAnswer) return { correct: false, score: 0, matchedAnswer: null, empty: true };
    const answers = Array.isArray(acceptedAnswers) ? acceptedAnswers : [acceptedAnswers];
    let bestScore = 0;
    let bestAnswer = null;
    for (const expected of answers) {
        if (expected === null || expected === undefined) continue;
        const expectedText = practiceCleanText(expected);
        if (!expectedText) continue;
        const score = practiceSimilarity(cleanAnswer, expectedText);
        if (score > bestScore) { bestScore = score; bestAnswer = expectedText; }
    }
    const threshold = practiceGetSimilarityThreshold();
    return { correct: bestScore >= threshold, score: bestScore, threshold, matchedAnswer: bestAnswer, empty: false };
}

function practiceCheckChoiceAnswer(answer, expected) {
    const user = practiceNormalizeText(answer);
    const correct = practiceNormalizeText(expected);
    return { correct: Boolean(user && correct && user === correct), score: user === correct ? 1 : 0, threshold: 1, matchedAnswer: expected, empty: !user };
}

function normalizePracticeExerciseType(type) {
    if (!type) return PRACTICE_EXERCISE_TYPES.MEANING;
    const value = String(type).trim().toLowerCase().replace(/[_\s]+/g, "-");
    const aliases = {
        meaning: "meaning", translation: "meaning", recall: "recall", "free-recall": "recall",
        sentence: "fill-sentence", "fill-sentence": "fill-sentence", fill: "fill-sentence", "fill-in-the-blank": "fill-sentence",
        choose: "choose-word", "choose-word": "choose-word", choice: "choose-word",
        production: "production", produce: "production", mixed: "mixed"
    };
    return aliases[value] ?? value;
}

function getPracticeExerciseTypes() {
    return ["meaning", "recall", "fill-sentence", "choose-word", "production"];
}

function buildMixedExerciseTypes(questionCount) {
    const count = practiceNormalizeCount(questionCount);
    const types = getPracticeExerciseTypes();
    return Array.from({ length: count }, (_, index) => types[index % types.length]);
}

function practiceShuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/* =========================================================
   CANONICAL VOCABULARY SELECTION
========================================================= */

async function resolvePracticeVocabulary(options = {}) {
    if (typeof getSelectedVocabulary !== "function") {
        throw new Error("selection.js is required before practice.js");
    }

    let selected = await getSelectedVocabulary();

    /* Explicit pack/source changes must go through selection.js. */
    if (options.source || options.packId !== undefined) {
        const source = String(options.source ?? "all").toLowerCase();
        if (source === "pack" && typeof selectVocabularyPack === "function") {
            selectVocabularyPack(options.packId);
        } else if (source === "new" && typeof selectNewVocabulary === "function") {
            selectNewVocabulary();
        } else if (source === "weak" && typeof selectWeakVocabulary === "function") {
            selectWeakVocabulary();
        } else if (source === "due" && typeof selectDueVocabulary === "function") {
            selectDueVocabulary();
        } else if (typeof selectAllVocabulary === "function") {
            selectAllVocabulary();
        }
        selected = await getSelectedVocabulary();
    }

    const selection = typeof getVocabularySelection === "function"
        ? getVocabularySelection()
        : { source: "all", packId: null };

    return { words: Array.isArray(selected) ? selected : [], selection, allWords: typeof getAllLoadedVocabulary === "function" ? await getAllLoadedVocabulary() : [...selected] };
}

function practiceGetStoredSelection() {
    return typeof getVocabularySelection === "function" ? getVocabularySelection() : null;
}

function practiceSaveSelection(selection) {
    if (selection && typeof saveVocabularySelection === "function") return saveVocabularySelection(selection);
    return selection;
}

/* =========================================================
   EXERCISE BUILDER
========================================================= */

function practiceGetImportedExercise(word, type) {
    if (!word) return null;
    const normalizedType = normalizePracticeExerciseType(type);
    const containers = [word.aiExercises, word.importedExercises, word.exercises, word.ai?.exercises, word.generatedExercises];
    for (const container of containers) {
        if (!container) continue;
        if (Array.isArray(container)) {
            const match = container.find(exercise => normalizePracticeExerciseType(exercise.type ?? exercise.exerciseType) === normalizedType);
            if (match) return match;
        } else if (typeof container === "object" && container[normalizedType]) return container[normalizedType];
    }
    return null;
}

function buildPracticeExercise(word, type, vocabulary) {
    const normalizedType = normalizePracticeExerciseType(type);
    const imported = practiceGetImportedExercise(word, normalizedType);
    if (imported) return { ...practiceClone(imported), type: normalizedType, wordId: practiceGetWordId(word), word };
    if (window.DutchTrainerExercises) {
        const exercises = window.DutchTrainerExercises;
        for (const builder of [exercises.createExercise, exercises.buildExercise, exercises.generateExercise, exercises.create]) {
            if (typeof builder !== "function") continue;
            try {
                const result = builder.call(exercises, word, normalizedType, vocabulary);
                if (result) return { ...result, type: normalizedType, wordId: practiceGetWordId(word), word };
            } catch (error) { console.warn("Exercise builder failed:", error); }
        }
    }
    return buildFallbackPracticeExercise(word, normalizedType, vocabulary);
}

function buildFallbackPracticeExercise(word, type, vocabulary) {
    const dutch = practiceGetDutch(word), meaning = practiceGetMeaning(word), sentence = practiceGetExampleSentence(word);
    switch (type) {
        case "meaning": return { type, prompt: `What does "${dutch}" mean?`, instruction: "Type the meaning.", answerType: "text", acceptedAnswers: practiceGetAcceptedAnswers(word), correctAnswer: meaning, wordId: practiceGetWordId(word) };
        case "recall": return { type, prompt: "Recall the Dutch word for this meaning:", instruction: practiceCleanText(meaning), answerType: "text", acceptedAnswers: [dutch], correctAnswer: dutch, wordId: practiceGetWordId(word) };
        case "fill-sentence": return { type, prompt: sentence || `Complete the sentence with "${dutch}".`, instruction: sentence ? "Type the missing Dutch word." : "Type the Dutch word.", answerType: "text", acceptedAnswers: [dutch], correctAnswer: dutch, wordId: practiceGetWordId(word) };
        case "choose-word": {
            const choices = [dutch, ...practiceShuffle(vocabulary.filter(item => practiceGetWordId(item) !== practiceGetWordId(word)).map(practiceGetDutch).filter(Boolean)).slice(0, 3)];
            return { type, prompt: `Choose the Dutch word for: ${meaning}`, answerType: "choice", choices: practiceShuffle(choices), correctAnswer: dutch, acceptedAnswers: [dutch], wordId: practiceGetWordId(word) };
        }
        case "production": return { type, prompt: `Produce the Dutch word for: ${meaning}`, instruction: "Type the Dutch word.", answerType: "text", acceptedAnswers: [dutch], correctAnswer: dutch, wordId: practiceGetWordId(word) };
        default: return buildFallbackPracticeExercise(word, "meaning", vocabulary);
    }
}

function buildPracticeQuestions(vocabulary, questionCount, exerciseType) {
    const count = practiceNormalizeCount(questionCount);
    if (!vocabulary.length) return [];
    const types = normalizePracticeExerciseType(exerciseType) === "mixed" ? buildMixedExerciseTypes(count) : Array(count).fill(normalizePracticeExerciseType(exerciseType));
    const pool = practiceShuffle(vocabulary);
    return Array.from({ length: count }, (_, index) => {
        const word = pool[index % pool.length];
        const type = types[index];
        const exercise = buildPracticeExercise(word, type, vocabulary);
        return { id: `${practiceGetWordId(word)}-${index}-${Date.now()}`, wordId: practiceGetWordId(word), packId: practiceGetPackId(word), type, word, exercise, answered: false, answer: null, result: null, feedback: null };
    });
}

function getPracticeState() { return practiceClone(PracticeState); }

function emitPracticeEvent(type, payload) {
    for (const listener of PracticeListeners[type] || []) {
        try { listener(payload); } catch (error) { console.warn(`Practice ${type} listener failed:`, error); }
    }
    try { window.dispatchEvent(new CustomEvent(`practice-${type}`, { detail: payload })); } catch (error) { /* no-op */ }
}

function onPracticeEvent(type, listener) {
    if (!PracticeListeners[type] || typeof listener !== "function") return () => {};
    PracticeListeners[type].push(listener);
    return () => { const index = PracticeListeners[type].indexOf(listener); if (index >= 0) PracticeListeners[type].splice(index, 1); };
}

function getPracticeExpectedAnswers(question) {
    if (!question) return [];
    return practiceGetAcceptedAnswers(question.word, question.exercise);
}

function extractPracticeAnswer(answer, question) {
    if (answer && typeof answer === "object") return answer.value ?? answer.answer ?? answer.text ?? answer.label ?? "";
    return answer ?? question?.currentAnswer ?? "";
}

function extractPracticeMastery(result, word) {
    const values = [result?.mastery, result?.newMastery, result?.masteryScore, result?.word?.mastery, word?.mastery, word?.masteryScore];
    for (const value of values) { const number = Number(value); if (Number.isFinite(number)) return Math.max(0, Math.min(100, number)); }
    return 0;
}

async function updatePracticeMastery(word, options) {
    if (window.DutchTrainerMastery?.recordAnswer) return window.DutchTrainerMastery.recordAnswer(word, options);
    if (typeof updateWordAfterAnswer === "function") return updateWordAfterAnswer(word, options);
    throw new Error("mastery.js API is not available");
}

async function updatePracticeSchedule(word, options) {
    if (typeof scheduleAndSaveAfterAnswer === "function") return scheduleAndSaveAfterAnswer(word, options);
    if (window.DutchTrainerScheduler?.scheduleAndSaveAfterAnswer) return window.DutchTrainerScheduler.scheduleAndSaveAfterAnswer(word, options);
    if (typeof scheduleAfterAnswer === "function") {
        const result = await scheduleAfterAnswer(word, options);
        if (typeof saveWord === "function") await saveWord(word);
        return result;
    }
    throw new Error("scheduler.js API is not available");
}

function calculatePracticeMasteryChange(result, word) {
    const current = extractPracticeMastery(result, word);
    const previous = Number(result?.previousMastery ?? result?.oldMastery ?? result?.before ?? NaN);
    return Number.isFinite(previous) ? current - previous : null;
}

function buildPracticeFeedback(question, result, masteryResult, scheduleResult) {
    const expected = getPracticeExpectedAnswers(question);
    const correctAnswer = question.exercise?.correctAnswer ?? question.exercise?.answer ?? expected[0] ?? practiceGetDutch(question.word);
    const mastery = extractPracticeMastery(masteryResult, question.word);
    const nextReview = scheduleResult?.dueAt ?? question.word?.dueAt ?? null;
    return { correct: result.correct, message: result.correct ? "Correct!" : "Not quite.", answer: question.answer, correctAnswer, score: result.score, threshold: result.threshold ?? null, mastery, masteryChange: calculatePracticeMasteryChange(masteryResult, question.word), nextReview, nextReviewLabel: typeof getNextReviewLabel === "function" ? getNextReviewLabel(question.word) : null };
}

async function checkPracticeAnswer(answer) {
    if (!PracticeState.active) return { success: false, reason: "no-active-session" };
    if (PracticeState.answered) return { success: false, reason: "already-answered", feedback: PracticeState.feedback };
    const question = PracticeState.currentQuestion;
    if (!question) return { success: false, reason: "no-question" };
    const exercise = question.exercise, word = question.word, submittedAnswer = extractPracticeAnswer(answer, question);
    const result = question.type === "choose-word" || exercise?.answerType === "choice"
        ? practiceCheckChoiceAnswer(submittedAnswer, exercise?.correctAnswer ?? exercise?.answer ?? practiceGetDutch(word))
        : practiceCheckTypedAnswer(submittedAnswer, getPracticeExpectedAnswers(question));
    if (result.empty) return { success: false, reason: "empty-answer", result };

    question.answered = true; question.answer = submittedAnswer; question.result = result;
    PracticeState.answered = true; PracticeState.answerCount++; PracticeState.lastAnswerAt = practiceNowISO();
    if (result.correct) PracticeState.correctCount++; else PracticeState.incorrectCount++;

    const masteryResult = await updatePracticeMastery(word, { correct: result.correct, score: result.score, exerciseType: question.type, answer: submittedAnswer, sessionId: PracticeState.sessionId });
    const updatedMastery = extractPracticeMastery(masteryResult, word);
    const scheduleResult = await updatePracticeSchedule(word, { correct: result.correct, mastery: updatedMastery, exerciseType: question.type, sessionId: PracticeState.sessionId });
    const feedback = buildPracticeFeedback(question, result, masteryResult, scheduleResult);
    question.feedback = feedback; PracticeState.feedback = feedback;
    PracticeState.results.push({ questionId: question.id, wordId: question.wordId, packId: question.packId, type: question.type, answer: submittedAnswer, correct: result.correct, score: result.score, threshold: result.threshold ?? null, mastery: updatedMastery, dueAt: scheduleResult?.dueAt ?? word.dueAt ?? null, intervalDays: scheduleResult?.intervalDays ?? word.intervalDays ?? null, answeredAt: PracticeState.lastAnswerAt });
    emitPracticeEvent("answer", { result, feedback, mastery: updatedMastery, schedule: scheduleResult, question, state: getPracticeState() });
    emitPracticeEvent("feedback", feedback); emitPracticeEvent("state", getPracticeState());
    return { success: true, correct: result.correct, score: result.score, threshold: result.threshold, feedback, mastery: updatedMastery, schedule: scheduleResult, question, state: getPracticeState() };
}

function nextPracticeQuestion() {
    if (!PracticeState.active) return { success: false, reason: "no-active-session" };
    if (!PracticeState.answered) return { success: false, reason: "answer-required" };
    PracticeState.currentIndex++;
    if (PracticeState.currentIndex >= PracticeState.questions.length) { completePracticeSession(); return { success: true, completed: true, state: getPracticeState() }; }
    const question = PracticeState.questions[PracticeState.currentIndex];
    PracticeState.currentQuestion = question; PracticeState.currentExercise = question.exercise; PracticeState.currentWord = question.word; PracticeState.currentAnswer = null; PracticeState.answered = false; PracticeState.feedback = null;
    emitPracticeEvent("next", getPracticeState()); emitPracticeEvent("state", getPracticeState());
    return { success: true, completed: false, question, state: getPracticeState() };
}

async function handlePracticeEnter(answer = undefined) {
    if (!PracticeState.active) return { handled: false, reason: "no-active-session" };
    if (!PracticeState.answered) return { handled: true, action: "check", result: await checkPracticeAnswer(answer) };
    return { handled: true, action: "next", result: nextPracticeQuestion() };
}

async function startPractice(options = {}) {
    const resolved = await resolvePracticeVocabulary(options);
    const questionCount = practiceNormalizeCount(options.questionCount ?? PracticeState.questionCount);
    const exerciseType = normalizePracticeExerciseType(options.exerciseType ?? PracticeState.exerciseType);
    if (!resolved.words.length) return { success: false, reason: "no-vocabulary", selection: resolved.selection, state: getPracticeState() };

    PracticeState.active = true; PracticeState.completed = false; PracticeState.mode = options.mode ?? PRACTICE_MODES.FULL; PracticeState.exerciseType = exerciseType; PracticeState.questionCount = questionCount;
    PracticeState.questions = buildPracticeQuestions(resolved.words, questionCount, exerciseType); PracticeState.currentIndex = 0; PracticeState.currentQuestion = PracticeState.questions[0]; PracticeState.currentExercise = PracticeState.questions[0]?.exercise ?? null; PracticeState.currentWord = PracticeState.questions[0]?.word ?? null; PracticeState.currentAnswer = null; PracticeState.answered = false; PracticeState.feedback = null; PracticeState.startedAt = practiceNowISO(); PracticeState.completedAt = null; PracticeState.correctCount = 0; PracticeState.incorrectCount = 0; PracticeState.answerCount = 0; PracticeState.selectedVocabulary = practiceClone(resolved.words); PracticeState.selectedVocabularyIds = resolved.words.map(practiceGetWordId); PracticeState.selectedPackId = resolved.selection.packId ?? null; PracticeState.vocabularySource = resolved.selection.source ?? "all"; PracticeState.mixedTypes = exerciseType === "mixed" ? buildMixedExerciseTypes(questionCount) : []; PracticeState.results = []; PracticeState.sessionId = `session-${Date.now()}`; PracticeState.lastAnswerAt = null;
    emitPracticeEvent("start", getPracticeState()); emitPracticeEvent("state", getPracticeState());
    return { success: true, question: PracticeState.currentQuestion, state: getPracticeState() };
}

function startPracticeSession(options = {}) { return startPractice(options); }
function beginPractice(options = {}) { return startPractice(options); }

function completePracticeSession() {
    if (!PracticeState.active) return getPracticeState();
    PracticeState.active = false; PracticeState.completed = true; PracticeState.completedAt = practiceNowISO();
    emitPracticeEvent("complete", getPracticeState()); emitPracticeEvent("state", getPracticeState());
    return getPracticeState();
}

function resetPracticeState() {
    Object.assign(PracticeState, { active: false, completed: false, questions: [], currentIndex: 0, currentQuestion: null, currentExercise: null, currentWord: null, currentAnswer: null, answered: false, feedback: null, correctCount: 0, incorrectCount: 0, answerCount: 0, selectedVocabulary: [], selectedVocabularyIds: [], selectedPackId: null, vocabularySource: "all", mixedTypes: [], results: [], sessionId: null, startedAt: null, completedAt: null, lastAnswerAt: null });
    emitPracticeEvent("state", getPracticeState());
}

function initializePractice() { return getPracticeState(); }
function initPractice() { return initializePractice(); }

window.DutchTrainerPractice = {
    state: PracticeState,
    getState: getPracticeState,
    start: startPractice,
    startPractice,
    startPracticeSession,
    beginPractice,
    checkAnswer: checkPracticeAnswer,
    checkPracticeAnswer,
    next: nextPracticeQuestion,
    nextQuestion: nextPracticeQuestion,
    handleEnter: handlePracticeEnter,
    complete: completePracticeSession,
    reset: resetPracticeState,
    on: onPracticeEvent,
    getExpectedAnswers: getPracticeExpectedAnswers
};
