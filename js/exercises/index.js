'use strict';

/* Dutch Vocabulary Trainer V2.4 — small, extensible exercise registry. */
const DutchTrainer = window.DutchTrainer || (window.DutchTrainer = {});

const registry = {};

function register(name, exercise) {
    if (!name || !exercise || typeof exercise.generate !== 'function' || typeof exercise.check !== 'function') {
        throw new Error(`Invalid exercise: ${name}`);
    }
    registry[name] = Object.freeze({ name, ...exercise });
}

function get(name) {
    return registry[name] || null;
}

function list() {
    return Object.keys(registry);
}

register('meaning', {
    label: 'Meaning',
    generate(word) {
        return {
            type: 'meaning',
            prompt: 'What does this Dutch word mean?',
            context: word.dutch || word.word || '',
            answer: word.english || word.meaning || ''
        };
    },
    check(question, answer) {
        return normalize(answer) === normalize(question.answer);
    }
});

register('recall', {
    label: 'Recall',
    generate(word) {
        return {
            type: 'recall',
            prompt: 'What is the Dutch word?',
            context: word.english || word.meaning || '',
            answer: word.dutch || word.word || ''
        };
    },
    check(question, answer) {
        return normalize(answer) === normalize(question.answer);
    }
});

function normalize(value) {
    return String(value ?? '').trim().toLowerCase();
}

DutchTrainer.exercises = Object.freeze({
    register,
    get,
    list
});
