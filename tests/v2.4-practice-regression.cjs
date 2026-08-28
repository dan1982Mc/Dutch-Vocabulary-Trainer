/* V2.4 Practice regression tests. Run in the same browser harness as runtime tests. */
'use strict';
const { chromium } = require('playwright');
const BASE_URL = process.env.DVT_BASE_URL || 'http://127.0.0.1:8000/index.html';
function assert(condition, message) { if (!condition) throw new Error(message); }
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.DutchTrainer?.ready || window.DutchTrainerDatabaseReady);
    const result = await page.evaluate(async () => {
      const api = window.DutchTrainer;
      if (!api?.practice) throw new Error('DutchTrainer.practice API unavailable');
      const exercises = window.DutchTrainerExercises;
      if (!exercises) throw new Error('DutchTrainerExercises unavailable');
      const words = [
        { id:'__reg_omringen__', dutch:'omringen', english:'to surround; encircle', level:'B2', forms:{participle:'omringd'}, examples:[{nl:'De politie zal het huis omringen.'}] },
        { id:'__reg_verwaand__', dutch:'verwaand', english:'conceited; arrogant; self-important', level:'B2', examples:[{nl:'Hij is erg verwaand.'}] },
        { id:'__reg_evenwicht__', dutch:'het evenwicht verliezen', english:"to lose one's balance", level:'B2', examples:[] }
      ];
      const out = {};
      const create = (word, type, vocabulary = words) => exercises.createExercise(word, type, vocabulary);
      const meaning = create(words[1], 'meaning');
      out.meaning = { inputType: meaning?.inputType, context: meaning?.context, options: meaning?.options?.length || 0 };
      out.meaningShape = meaning?.inputType === 'choice' && meaning?.context === words[1].english && meaning?.options?.length === 4;
      const recall = create(words[0], 'recall');
      const recallCheck = exercises.checkAnswer ? exercises.checkAnswer('to surround', 'to surround; encircle') : null;
      out.recall = { inputType: recall?.inputType, check: recallCheck };
      out.recallShape = recall?.inputType === 'text';
      const fill = create(words[0], 'fill');
      out.fill = { sentence: fill?.sentence, context: fill?.context, answer: fill?.correctAnswer };
      out.fillShape = !!fill && ((fill.sentence || fill.context || '').includes('_____'));
      const choose = create(words[0], 'choose', words);
      out.chooseShape = choose?.inputType === 'choice' && choose?.options?.length === 4 && (choose.sentence || choose.context || '').includes('_____');
      const production = create(words[1], 'production');
      out.productionShape = production?.inputType === 'text' && (production?.context === words[1].dutch || production?.word?.dutch === words[1].dutch);
      const start = await api.practice.start({ vocabulary: words, exerciseType:'meaning', questionCount:5 });
      out.practiceStart = start?.success === true && start?.state?.questionCount === 5;
      const state1 = api.practice.getState();
      out.counterStart = state1?.currentIndex === 0 && state1?.questionCount === 5;
      const q = state1.questions[state1.currentIndex];
      const answer = await api.practice.answer(q.exercise.correctAnswer || q.exercise.answer);
      out.answer = answer?.success === true && answer?.correct === true;
      const next = await api.practice.next();
      out.next = next?.completed === false && api.practice.getState()?.currentIndex === 1;
      api.practice.reset();
      out.reset = api.practice.getState()?.active === false;
      return out;
    });
    assert(result.meaningShape, `Meaning regression: ${JSON.stringify(result.meaning)}`);
    assert(result.recallShape, `Recall input regression: ${JSON.stringify(result.recall)}`);
    assert(result.fillShape, `Fill sentence regression: ${JSON.stringify(result.fill)}`);
    assert(result.chooseShape, 'Choose Word must be a 4-option sentence-gap exercise');
    assert(result.productionShape, 'Production must present the Dutch word');
    assert(result.practiceStart && result.counterStart && result.answer && result.next && result.reset, `Practice lifecycle regression: ${JSON.stringify(result)}`);
    if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
    console.log('PASS V2.4 Practice regression: exercise shapes, practice lifecycle, counter and reset');
  } catch (error) {
    console.error(`FAIL V2.4 Practice regression — ${error.message}`);
    process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
