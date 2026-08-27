'use strict';

const DutchTrainer = window.DutchTrainer || (window.DutchTrainer = {});
const exercises = DutchTrainer.exercises;

function normalize(value) {
    return String(value ?? '').trim().toLowerCase();
}

function getExamples(word) {
    const examples = Array.isArray(word?.examples) ? word.examples : [];
    return examples
        .map(example => typeof example === 'string' ? { nl: example } : example)
        .filter(example => example && (example.nl || example.sentence || example.text));
}

function getSentence(word) {
    const examples = getExamples(word);
    const answer = word.dutch || word.word || '';
    const matching = examples.find(example => normalize(example.nl || example.sentence || example.text).includes(normalize(answer)));
    const selected = matching || examples[0];
    return selected?.nl || selected?.sentence || selected?.text || word.example || word.sentence || '';
}

function makeGap(sentence, answer) {
    if (!sentence || !answer) return '';
    const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exact = new RegExp(`\\b${escaped}\\b`, 'i');
    if (exact.test(sentence)) return sentence.replace(exact, '_____');
    const index = normalize(sentence).indexOf(normalize(answer));
    if (index >= 0) return `${sentence.slice(0, index)}_____${sentence.slice(index + answer.length)}`;
    return sentence;
}

exercises.register('fill', {
    label: 'Fill Sentence',
    generate(word) {
        const answer = word.dutch || word.word || '';
        const sentence = getSentence(word);
        const context = makeGap(sentence, answer);
        return {
            type: 'fill',
            prompt: context === sentence && sentence
                ? 'Complete the sentence with the missing Dutch word.'
                : 'Fill in the missing Dutch word.',
            context,
            answer
        };
    },
    check(question, answer) {
        return normalize(answer) === normalize(question.answer);
    }
});
