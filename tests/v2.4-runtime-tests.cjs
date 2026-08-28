/* Dutch Vocabulary Trainer V2.4 runtime self-tests. */
'use strict';

const { chromium } = require('playwright');
const BASE_URL = process.env.DVT_BASE_URL || 'http://127.0.0.1:8000/index.html';
const TEST_WORD_ID = '__v24_test_word__';
const TEST_PACK_ID = '__v24_test_pack__';

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    try {
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        await page.waitForFunction(() => window.DutchTrainer?.ready);
        await page.evaluate(() => window.DutchTrainer.ready);
        await page.waitForFunction(() => window.DutchTrainer?.vocabulary && window.DutchTrainer?.exercises && window.DutchTrainer?.scheduler && window.DutchTrainer?.practice);

        await page.evaluate(async ({ wordId, packId }) => {
            if (typeof deleteWord === 'function') await deleteWord(wordId).catch(() => {});
            if (typeof deletePackRecord === 'function') await deletePackRecord(packId).catch(() => {});
        }, { wordId: TEST_WORD_ID, packId: TEST_PACK_ID });

        await page.evaluate(async ({ wordId, packId }) => {
            await saveWord({
                id: wordId,
                packId,
                dutch: 'testwoord',
                english: 'test word',
                mastery: 0,
                isNew: true,
                examples: ['Dit is een testwoord.']
            });
            await savePackRecord({
                packId,
                name: 'V2.4 Test Pack',
                version: 1,
                wordCount: 1,
                type: 'imported'
            });
        }, { wordId: TEST_WORD_ID, packId: TEST_PACK_ID });

        const persisted = await page.evaluate(async ({ wordId, packId }) => ({
            word: await getWord(wordId),
            pack: await getPackRecord(packId),
            words: (await getAllWords()).some(word => word.id === wordId),
            packs: (await getAllPackRecords()).some(pack => pack.packId === packId)
        }), { wordId: TEST_WORD_ID, packId: TEST_PACK_ID });
        assert(persisted.word?.id === TEST_WORD_ID, 'DB save/get word failed');
        assert(persisted.pack?.packId === TEST_PACK_ID, 'DB save/get pack failed');
        assert(persisted.words && persisted.packs, 'DB collection reads failed');

        const pack = await page.evaluate(async packId => {
            const api = window.DutchTrainer.vocabulary;
            const found = await api.getPack(packId);
            const packs = await api.getPacks();
            return {
                found: found?.packId === packId,
                listed: Array.isArray(packs) && packs.some(pack => pack.packId === packId),
                api: ['getAll', 'getWord', 'saveWord', 'getPacks', 'getPack', 'savePack', 'selectAll', 'selectPack', 'selectNew', 'selectWeak', 'selectDue', 'getSelection'].every(key => typeof api[key] === 'function')
            };
        }, TEST_PACK_ID);
        assert(pack.api, 'Vocabulary/Pack facade API incomplete at runtime');
        assert(pack.found && pack.listed, 'Vocabulary facade cannot read persisted test pack');

        const scheduler = await page.evaluate(() => {
            const api = window.DutchTrainer.scheduler;
            const now = new Date('2026-01-10T12:00:00.000Z');
            const fresh = { id: 'scheduler-new', attempts: 0, mastery: 0 };
            const due = { id: 'scheduler-due', attempts: 3, mastery: 50, dueAt: '2026-01-09T12:00:00.000Z' };
            const future = { id: 'scheduler-future', attempts: 3, mastery: 50, dueAt: '2026-01-11T12:00:00.000Z' };
            const weak = { id: 'scheduler-weak', attempts: 1, mastery: 20, dueAt: '2026-01-11T12:00:00.000Z' };
            const learned = { id: 'scheduler-learned', attempts: 1, mastery: 95, dueAt: '2026-01-11T12:00:00.000Z' };
            const success = api.schedule({ ...due, mastery: 60 }, { correct: true }, now);
            const failed = api.schedule({ ...due, mastery: 60 }, { correct: false }, now);
            return {
                config: api.config?.initialDays === 1 && api.config?.failedHours === 1,
                new: api.isNew(fresh) && api.classify(fresh, now) === 'new',
                due: api.isDue(due, now) && api.classify(due, now) === 'due',
                notDue: !api.isDue(future, now),
                weak: api.isWeak(weak) && api.classify(weak, now) === 'weak',
                learned: api.isLearned(learned) && api.classify(learned, now) === 'learned',
                interval: api.getIntervalDays({ mastery: 60 }) === 4,
                success: success.dueAt === '2026-01-14T12:00:00.000Z' && success.nextReviewAt === success.dueAt,
                failed: failed.dueAt === '2026-01-10T13:00:00.000Z' && failed.nextReviewAt === failed.dueAt
            };
        });
        assert(Object.values(scheduler).every(Boolean), `Scheduler behavior failed: ${JSON.stringify(scheduler)}`);

        const exercises = await page.evaluate(() => {
            const api = window.DutchTrainer.exercises;
            const vocabulary = [
                { id: 'exercise-test', dutch: 'lopen', english: 'to walk', examples: ['Ik ga lopen.'] },
                { id: 'exercise-other', dutch: 'fietsen', english: 'to cycle', examples: ['Ik ga fietsen.'] }
            ];
            return ['meaning', 'recall', 'fill', 'choose', 'production'].map(type => {
                const exercise = api.create(vocabulary[0], type, vocabulary);
                return { type, valid: exercise?.type === type && !!exercise.prompt && !!exercise.correctAnswer };
            });
        });
        assert(exercises.every(item => item.valid), `Exercise runtime failed: ${JSON.stringify(exercises)}`);

        const practice = await page.evaluate(async () => {
            const api = window.DutchTrainer.practice;
            const word = {
                id: 'practice-test-word',
                packId: '__v24_runtime_practice__',
                dutch: 'lopen',
                english: 'to walk',
                mastery: 0,
                isNew: true,
                examples: ['Ik ga lopen.']
            };
            const result = await api.start({ vocabulary: [word], questionCount: 1, exerciseType: 'recall' });
            const state = api.getState();
            const started = result?.success === true && state?.questions?.length === 1 && state?.currentIndex === 0;
            if (started) await api.reset();
            return { started, stateApi: typeof api.getState === 'function', resetState: api.getState()?.questions?.length === 0 };
        });
        assert(practice.started && practice.stateApi && practice.resetState, 'Practice runtime start/reset failed');

        await page.evaluate(async ({ wordId, packId }) => {
            await deleteWord(wordId).catch(() => {});
            await deletePackRecord(packId).catch(() => {});
        }, { wordId: TEST_WORD_ID, packId: TEST_PACK_ID });

        if (errors.length) throw new Error(`Browser runtime errors: ${errors.join(' | ')}`);
        console.log('PASS V2.4 runtime self-tests: IndexedDB, Vocabulary/Packs, Scheduler, Exercises and Practice');
    } catch (error) {
        console.error(`FAIL V2.4 runtime self-tests — ${error.message}`);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
