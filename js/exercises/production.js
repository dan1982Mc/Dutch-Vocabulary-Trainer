'use strict';

const DutchTrainer = window.DutchTrainer || (window.DutchTrainer = {});
const exercises = DutchTrainer.exercises;

function normalize(value) {
    return String(value ?? '').trim().toLowerCase();
}

exercises.register('production', {
    label: 'Production',
    generate(word) {
        const answer = word.dutch || word.word || '';
        return {
            type: 'production',
            prompt: 'Write the Dutch word.',
            context: word.english || word.meaning || '',
            answer
        };
    },
    check(question, answer) {
        return normalize(answer) === normalize(question.answer);
    }
});
