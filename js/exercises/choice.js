'use strict';

const DutchTrainer = window.DutchTrainer || (window.DutchTrainer = {});
const exercises = DutchTrainer.exercises;

function normalize(value) {
    return String(value ?? '').trim().toLowerCase();
}

exercises.register('choose', {
    label: 'Choose Word',
    generate(word, options = []) {
        const answer = word.english || word.meaning || '';
        return {
            type: 'choose',
            prompt: 'Choose the correct meaning.',
            context: word.dutch || word.word || '',
            answer,
            options: Array.isArray(options) ? options : []
        };
    },
    check(question, answer) {
        return normalize(answer) === normalize(question.answer);
    }
});
