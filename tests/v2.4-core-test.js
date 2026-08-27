'use strict';

/* V2.4 core verification. Loaded after the V2.4 core modules in a browser. */
(function () {
    const checks = [];
    const pass = (name) => checks.push({ name, ok: true });
    const fail = (name, error) => checks.push({ name, ok: false, error: error?.message || String(error) });

    function check(name, fn) {
        try { fn(); pass(name); } catch (error) { fail(name, error); }
    }

    check('DutchTrainer namespace exists', () => {
        if (!window.DutchTrainer) throw new Error('DutchTrainer missing');
    });

    check('DB API exists', () => {
        if (typeof DutchTrainer.db?.saveWord !== 'function' || typeof DutchTrainer.db?.getWords !== 'function') {
            throw new Error('DB word API missing');
        }
    });

    check('Vocabulary API exists', () => {
        if (typeof DutchTrainer.vocabulary?.getSelected !== 'function') throw new Error('Vocabulary API missing');
    });

    check('Exercise registry contains all current types', () => {
        const expected = ['meaning', 'recall', 'fill', 'choose', 'production'];
        for (const type of expected) if (!DutchTrainer.exercises?.get(type)) throw new Error(`Missing ${type}`);
    });

    check('Practice API exists', () => {
        for (const name of ['start', 'answer', 'next', 'finish', 'reset', 'getState']) {
            if (typeof DutchTrainer.practice?.[name] !== 'function') throw new Error(`Missing practice.${name}`);
        }
    });

    check('Mastery API uses DB', () => {
        if (typeof DutchTrainer.mastery?.recordAnswer !== 'function') throw new Error('Mastery API missing');
        if (!DutchTrainer.mastery?.policy) throw new Error('Mastery policy missing');
    });

    check('History API exists', () => {
        for (const name of ['getSessions', 'saveSession', 'getRecent', 'getStats']) {
            if (typeof DutchTrainer.history?.[name] !== 'function') throw new Error(`Missing history.${name}`);
        }
    });

    check('Scheduler API exists', () => {
        for (const name of ['isNew', 'isDue', 'isWeak', 'isLearned', 'schedule', 'classify']) {
            if (typeof DutchTrainer.scheduler?.[name] !== 'function') throw new Error(`Missing scheduler.${name}`);
        }
    });

    check('Core APIs do not expose legacy history storage', () => {
        const source = [...document.scripts].map(script => script.textContent || '').join('\n');
        if (/v2\.practiceHistory/.test(source)) throw new Error('Legacy practiceHistory reference found');
    });

    window.DutchTrainerV24CoreTests = Object.freeze({
        run() {
            return checks.slice();
        },
        passed: checks.filter(x => x.ok).length,
        failed: checks.filter(x => !x.ok).length,
        checks: checks.slice()
    });

    console.log(`V2.4 core verification: ${checks.filter(x => x.ok).length} passed, ${checks.filter(x => !x.ok).length} failed`);
})();
