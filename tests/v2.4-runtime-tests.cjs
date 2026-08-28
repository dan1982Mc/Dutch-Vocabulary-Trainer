/* Dutch Vocabulary Trainer V2.4 runtime self-tests.
 * Exercises the real browser runtime against IndexedDB and public APIs.
 */
'use strict';
const { chromium } = require('playwright');
const BASE_URL = process.env.DVT_BASE_URL || 'http://127.0.0.1:8000/index.html';
const TEST_WORD_ID = '__v24_test_word__';
const TEST_PACK_ID = '__v24_test_pack__';
function assert(condition, message) { if (!condition) throw new Error(message); }
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.DutchTrainerDatabaseReady);
    await page.evaluate(async ({ wordId, packId }) => {
      if (typeof deleteWord === 'function') await deleteWord(wordId).catch(() => {});
      if (typeof deletePackRecord === 'function') await deletePackRecord(packId).catch(() => {});
    }, { wordId: TEST_WORD_ID, packId: TEST_PACK_ID });

    await page.evaluate(async ({ wordId, packId }) => {
      await saveWord({ id: wordId, packId, dutch: 'testwoord', english: 'test word', mastery: 0, isNew: true });
      await savePackRecord({ packId, name: 'V2.4 Test Pack', version: 1, wordCount: 1 });
    }, { wordId: TEST_WORD_ID, packId: TEST_PACK_ID });
    const persisted = await page.evaluate(async ({ wordId, packId }) => ({
      word: await getWord(wordId),
      pack: await getPackRecord(packId),
      words: (await getAllWords()).some(w => w.id === wordId),
      packs: (await getAllPackRecords()).some(p => p.packId === packId)
    }), { wordId: TEST_WORD_ID, packId: TEST_PACK_ID });
    assert(persisted.word?.id === TEST_WORD_ID, 'DB save/get word failed');
    assert(persisted.pack?.packId === TEST_PACK_ID, 'DB save/get pack failed');
    assert(persisted.words && persisted.packs, 'DB collection reads failed');

    const packResult = await page.evaluate(async packId => {
      const p = window.DutchTrainerPacks;
      if (!p) throw new Error('DutchTrainerPacks unavailable');
      const found = await p.getPack(packId);
      return { found: found?.packId === packId, api: ['getAllPacks','getPack','savePack','createPack','ensurePack','updatePack','deletePack','removePackWords','assignWordToPack'].every(k => typeof p[k] === 'function') };
    }, TEST_PACK_ID);
    assert(packResult.api, 'Pack API contract unavailable at runtime');
    assert(packResult.found, 'Pack manager cannot read persisted test pack');

    const scheduler = await page.evaluate(() => ({
      config: !!window.SchedulerConfig,
      due: typeof schedulerGetDueDate === 'function',
      interval: typeof schedulerGetInterval === 'function',
      mastery: typeof schedulerGetMastery === 'function'
    }));
    assert(scheduler.config && scheduler.due && scheduler.interval && scheduler.mastery, 'Scheduler runtime API incomplete');

    const exercises = await page.evaluate(() => {
      const word = { id: 'exercise-test', dutch: 'lopen', english: 'to walk', examples: ['Ik ga lopen.'] };
      const types = ['meaning','recall','fill','choose','production'];
      return types.map(type => {
        const e = window.DutchTrainerExercises?.createExercise(word, type, [word]);
        return { type, valid: e?.type === type && !!e?.prompt && !!e?.correctAnswer };
      });
    });
    assert(exercises.every(x => x.valid), `Exercise runtime failed: ${JSON.stringify(exercises)}`);

    const practice = await page.evaluate(async () => {
      const word = { id: 'practice-test-word', packId: '__v24_runtime_practice__', dutch: 'lopen', english: 'to walk', mastery: 0, isNew: true, examples: ['Ik ga lopen.'] };
      const r = await window.DutchTrainerPractice.startPractice({ vocabulary: [word], questionCount: 1, exerciseType: 'recall' });
      const started = r?.success === true && r.state?.questions?.length === 1;
      if (started) window.DutchTrainerPractice.reset();
      return { started, stateApi: typeof window.DutchTrainerPractice.getState === 'function' };
    });
    assert(practice.started && practice.stateApi, 'Practice runtime start/reset failed');

    await page.evaluate(async ({ wordId, packId }) => {
      await deleteWord(wordId).catch(() => {});
      await deletePackRecord(packId).catch(() => {});
    }, { wordId: TEST_WORD_ID, packId: TEST_PACK_ID });
    if (errors.length) throw new Error(`Browser runtime errors: ${errors.join(' | ')}`);
    console.log('PASS V2.4 runtime self-tests: IndexedDB, Packs, Scheduler, Exercises and Practice');
  } catch (error) {
    console.error(`FAIL V2.4 runtime self-tests — ${error.message}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
