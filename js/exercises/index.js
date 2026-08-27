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

function create(word, name, vocabulary = []) {
    const type = String(name || 'meaning').trim().toLowerCase();
    const exercise = get(type);
    if (!exercise) throw new Error(`Unknown exercise type: ${type}`);

    let options = [];
    if (type === 'choose') {
        const answer = word.english || word.meaning || '';
        const distractors = vocabulary
            .filter(item => item !== word)
            .map(item => item.english || item.meaning || '')
            .filter(Boolean)
            .filter(value => normalize(value) !== normalize(answer));
        options = [answer, ...shuffle(distractors).slice(0, 3)];
        options = shuffle(options);
    }

    const generated = exercise.generate(word, options, vocabulary);
    return {
        ...generated,
        type: generated.type || type,
        label: generated.label || exercise.label || type,
        correctAnswer: generated.correctAnswer ?? generated.answer ?? ''
    };
}

function shuffle(values) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function normalize(value) {
    return String(value ?? '').trim().toLowerCase();
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

DutchTrainer.exercises = {
    register,
    get,
    list,
    create
};
