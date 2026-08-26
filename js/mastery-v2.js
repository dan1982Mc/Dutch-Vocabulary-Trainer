/* Dutch Vocabulary Trainer V2 — canonical mastery engine */
(function () {
    "use strict";

    const TYPES = ["meaning", "recall", "fill", "choose", "production"];
    const CONFIG = {
        rewards: { correct: 10, almost: 4, incorrect: 0 },
        weakThreshold: 40,
        masteredThreshold: 90,
        intervals: { new: 1, weak: 2, developing: 4, familiar: 7, strong: 14, mastered: 30 },
        historyLimit: 500
    };

    function typeOf(value) {
        const v = String(value || "meaning").toLowerCase().trim();
        return { "fill-sentence": "fill", "choose-word": "choose", "multiple-choice": "meaning" }[v] || (TYPES.includes(v) ? v : "meaning");
    }
    function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
    function clamp(v) { return Math.max(0, Math.min(100, Math.round(num(v)))); }
    function masteryOf(word) { return clamp(word?.mastery ?? word?.masteryScore ?? word?.score ?? 0); }
    function levelOf(score) {
        const n = clamp(score);
        if (n >= CONFIG.masteredThreshold) return "mastered";
        if (n >= 70) return "strong";
        if (n >= 50) return "familiar";
        if (n >= CONFIG.weakThreshold) return "developing";
        if (n > 0) return "weak";
        return "new";
    }
    function ensureStats(word) {
        word.stats = word.stats && typeof word.stats === "object" ? word.stats : {};
        const s = word.stats;
        s.attempts = num(s.attempts); s.correct = num(s.correct); s.incorrect = num(s.incorrect);
        s.accuracy = num(s.accuracy); s.consecutiveCorrect = num(s.consecutiveCorrect); s.consecutiveIncorrect = num(s.consecutiveIncorrect);
        s.byExerciseType = s.byExerciseType && typeof s.byExerciseType === "object" ? s.byExerciseType : {};
        for (const t of TYPES) if (!s.byExerciseType[t]) s.byExerciseType[t] = { attempts: 0, correct: 0, incorrect: 0, accuracy: 0 };
        return s;
    }
    function ensureHistory(word) { if (!Array.isArray(word.history)) word.history = []; return word.history; }
    function accuracy(correct, attempts) { return num(attempts) ? Math.round(num(correct) / num(attempts) * 100) : 0; }
    function setMastery(word, value) { const n = clamp(value); word.mastery = n; if ("masteryScore" in word) word.masteryScore = n; return n; }
    function schedule(word, outcome, mastery) {
        const days = outcome === "incorrect" ? 0 : outcome === "almost" ? 1 : CONFIG.intervals[levelOf(mastery)];
        const d = new Date(); d.setDate(d.getDate() + days); const iso = d.toISOString();
        word.dueAt = iso; word.isDue = days === 0;
        return { dueAt: iso, intervalDays: days };
    }

    async function updateWordAfterAnswer(word, answerData = {}, exercise = null) {
        if (!word) throw new Error("Cannot update mastery without a word.");
        const type = typeOf(exercise?.type ?? answerData.exerciseType);
        const s = ensureStats(word);
        const before = masteryOf(word);
        const isCorrect = Boolean(answerData.correct);
        const isAlmost = !isCorrect && Boolean(answerData.almost);
        const outcome = isCorrect ? "correct" : isAlmost ? "almost" : "incorrect";
        const delta = CONFIG.rewards[outcome];

        s.attempts++;
        if (isCorrect) { s.correct++; s.consecutiveCorrect++; s.consecutiveIncorrect = 0; }
        else { s.incorrect++; s.consecutiveIncorrect++; s.consecutiveCorrect = 0; }
        s.accuracy = accuracy(s.correct, s.attempts);
        const es = s.byExerciseType[type] || (s.byExerciseType[type] = { attempts: 0, correct: 0, incorrect: 0, accuracy: 0 });
        es.attempts++; if (isCorrect) es.correct++; else es.incorrect++; es.accuracy = accuracy(es.correct, es.attempts);

        const after = setMastery(word, before + delta);
        word.isNew = s.attempts === 0;
        word.isWeak = after < CONFIG.weakThreshold;
        word.status = levelOf(after);
        const review = schedule(word, outcome, after);
        const now = new Date().toISOString();
        const entry = {
            timestamp: now, wordId: word.id ?? null, packId: word.packId ?? null,
            exerciseType: type, correct: isCorrect, almost: isAlmost, outcome,
            userAnswer: answerData.userAnswer ?? answerData.answer ?? "",
            expectedAnswer: answerData.expectedAnswer ?? exercise?.correctAnswer ?? "",
            masteryBefore: before, masteryAfter: after, masteryDelta: delta, nextReview: review.dueAt
        };
        ensureHistory(word).push(entry); if (word.history.length > CONFIG.historyLimit) word.history = word.history.slice(-CONFIG.historyLimit);
        word.lastPracticedAt = now; word.lastAnswerAt = now; word.updatedAt = now; word.lastExerciseType = type; word.lastAnswerCorrect = isCorrect; word.lastAnswerOutcome = outcome;
        if (typeof saveWord === "function") await saveWord(word);
        return { word, correct: isCorrect, almost: isAlmost, outcome, exerciseType: type, masteryBefore: before, masteryAfter: after, masteryDelta: delta, nextReview: review.dueAt, dueAt: review.dueAt, intervalDays: review.intervalDays, stats: s, historyEntry: entry };
    }

    function getWordAccuracy(word) { const s = ensureStats(word); return accuracy(s.correct, s.attempts); }
    function getWordExerciseAccuracy(word, type) { const s = ensureStats(word).byExerciseType[typeOf(type)]; return accuracy(s.correct, s.attempts); }
    function getWordMasteryStatus(word) { return levelOf(masteryOf(word)); }
    function getWordPracticeSummary(word) { if (!word) return null; const s = ensureStats(word); return { wordId: word.id ?? null, packId: word.packId ?? null, mastery: masteryOf(word), status: levelOf(word.mastery), isNew: Boolean(word.isNew), isWeak: Boolean(word.isWeak), isDue: Boolean(word.isDue), attempts: s.attempts, correct: s.correct, incorrect: s.incorrect, accuracy: s.accuracy, lastPracticedAt: word.lastPracticedAt || null, dueAt: word.dueAt || null }; }
    function calculateVocabularyStats(words) {
        const a = Array.isArray(words) ? words : []; if (!a.length) return { total: 0, attempted: 0, newWords: 0, weak: 0, due: 0, mastered: 0, averageMastery: 0, accuracy: 0, progress: 0 };
        let attempted=0,newWords=0,weak=0,due=0,mastered=0,totalMastery=0,correct=0,attempts=0;
        for (const w of a) { const s=ensureStats(w), m=masteryOf(w); totalMastery+=m; attempts+=s.attempts; correct+=s.correct; if(s.attempts===0) newWords++; if(m<CONFIG.weakThreshold) weak++; if(w.isDue || (w.dueAt && new Date(w.dueAt).getTime()<=Date.now())) due++; if(m>=CONFIG.masteredThreshold) mastered++; if(s.attempts>0) attempted++; }
        return { total:a.length, attempted, newWords, weak, due, mastered, averageMastery:Math.round(totalMastery/a.length), accuracy:accuracy(correct,attempts), progress:Math.round(mastered/a.length*100) };
    }
    function calculateSkillStats(words) { const out={}; for(const t of TYPES){let a=0,c=0;for(const w of (Array.isArray(words)?words:[])){const s=ensureStats(w).byExerciseType[t];a+=s.attempts;c+=s.correct;}out[t]={type:t,label:t[0].toUpperCase()+t.slice(1),attempts:a,correct:c,accuracy:accuracy(c,a)};}return out; }
    function calculatePackStatistics(words) { const groups={};for(const w of (Array.isArray(words)?words:[])){const id=String(w.packId||"default");(groups[id] ||= []).push(w);}const out={};for(const [id,a] of Object.entries(groups))out[id]={packId:id,stats:calculateVocabularyStats(a),skills:calculateSkillStats(a)};return out; }
    function previewMasteryChange(word, outcomeOrCorrect, type) { const before=masteryOf(word); const outcome=typeof outcomeOrCorrect==='string'?outcomeOrCorrect:(outcomeOrCorrect?'correct':'incorrect');const delta=CONFIG.rewards[outcome] ?? 0;return {before,delta,after:clamp(before+delta)}; }
    async function initializeMasteryData(){if(typeof getAllWords!=="function")return {processed:0};const words=await getAllWords();for(const w of words){ensureStats(w);ensureHistory(w);w.mastery=masteryOf(w);w.isNew=ensureStats(w).attempts===0;w.isWeak=w.mastery<CONFIG.weakThreshold;if(typeof saveWord==="function")await saveWord(w);}return {processed:words.length};}

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
    window.DutchTrainerMastery = { recordAnswer: updateWordAfterAnswer, updateAfterAnswer: updateWordAfterAnswer, policy: CONFIG };
})();
