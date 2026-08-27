'use strict';

const DutchTrainer = window.DutchTrainer || (window.DutchTrainer = {});
const exercises = DutchTrainer.exercises;

function normalize(value) {
    return String(value ?? '').trim().toLowerCase();
}

exercises.register('fill', {
    label: 'Fill Sentence',
    generate(word) {
        const sentence = word.example || word.sentence || '';
        const answer = word.dutch || word.word || '';
        return {
            type: 'fill',
            prompt: 'Fill in the missing word.',
            context: sentence,
            answer
        };
    },
    check(question, answer) {
        return normalize(answer) === normalize(question.answer);
    }
});
