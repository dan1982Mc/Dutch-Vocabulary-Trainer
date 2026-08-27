'use strict';

const DutchTrainer = window.DutchTrainer || (window.DutchTrainer = {});
const exercises = DutchTrainer.exercises;

function normalize(value) {
    return String(value ?? '').trim().toLowerCase();
}

function getDutchTerms(word) {
    const terms = [word?.dutch, word?.word];
    if (word?.forms && typeof word.forms === 'object') {
        Object.values(word.forms).forEach(value => {
            if (Array.isArray(value)) terms.push(...value);
            else if (typeof value === 'string') terms.push(value);
        });
    }
    return [...new Set(terms.filter(Boolean).map(normalize))];
}

exercises.register('production', {
    label: 'Production',
    generate(word) {
        const answer = word.dutch || word.word || '';
        return {
            type: 'production',
            prompt: `Write a Dutch sentence using “${answer}”.`,
            context: word.english || word.meaning || '',
            answer,
            correctAnswer: answer
        };
    },
    check(question, answer) {
        const sentence = normalize(answer);
        if (!sentence) return false;
        const terms = getDutchTerms(question.word || {});
        const target = normalize(question.answer);
        return sentence.length > target.length && terms.some(term => term && sentence.includes(term));
    }
});
