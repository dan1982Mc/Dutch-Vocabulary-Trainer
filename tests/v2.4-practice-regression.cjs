/* V2.4 Practice regression tests. Validate the current public V2.4 APIs. */
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
      const exercises = api.exercises;
      if (!exercises?.create || !exercises?.get || !exercises?.list) throw new Error('DutchTrainer.exercises API unavailable');
      const words = [
        { id:'__reg_omringen__', dutch:'omringen', english:'to surround; encircle', level:'B2', forms:{participle:'omringd'}, examples:[{nl:'De politie zal het huis omringen.'}] },
        { id:'__reg_verwaand__', dutch:'verwaand', english:'conceited; arrogant; self-important', level:'B2', examples:[{nl:'Hij is erg verwaand.'}] },
        { id:'__reg_evenwicht__', dutch:'het evenwicht verliezen', english:"to lose one's balance", level:'B2', examples:[] },
        { id:'__reg_juichen__', dutch:'juichen', english:'to cheer', level:'B2', examples:[] }
      ];
      const out = { registeredTypes: exercises.list() };
      const create = (word, type) => exercises.create(word, type, words);
      const meaning = create(words[1], 'meaning');
      out.meaning = { type: meaning?.type, prompt: meaning?.prompt, context: meaning?.context, options: meaning?.options?.length || 0, answer: meaning?.correctAnswer };
      out.meaningShape = meaning?.type === 'meaning' && meaning?.context === words[1].english && meaning?.options?.length === 4;
      const recall = create(words[0], 'recall');
      out.recall = { type: recall?.type, input: recall?.context, answer: recall?.correctAnswer };
      out.recallShape = recall?.type === 'recall' && recall?.context === words[0].dutch && !!recall?.correctAnswer;
      const fill = create(words[0], 'fill');
      out.fill = { type: fill?.type, context: fill?.context, answer: fill?.correctAnswer };
      out.fillShape = fill?.type === 'fill' && (fill?.context || '').includes('_____') && fill?.correctAnswer === words[0].dutch;
      const choose = create(words[0], 'choose');
      out.choose = { type: choose?.type, context: choose?.context, options: choose?.options?.length || 0 };
      out.chooseShape = choose?.type === 'choose' && choose?.options?.length === 4 && (choose?.context || '').includes('_____');
      const production = create(words[1], 'production');
      out.production = { type: production?.type, context: production?.context, answer: production?.correctAnswer };
      out.productionShape = production?.type === 'production' && production?.context === words[1].dutch;
      const start = await api.practice.start({ vocabulary: words, exerciseType:'meaning', questionCount:5 });
      out.practiceStart = start?.success === true && start?.state?.questionCount === 5 && start?.state?.active === true;
      const state1 = api.practice.getState();
      out.counterStart = state1?.currentIndex === 0 && state1?.questionCount === 5 && state1?.questions?.length === 5;
      const q = state1?.questions?.[state1.currentIndex];
      assert(q?.exercise?.correctAnswer, 'Practice question has no correct answer');
      const answer = await api.practice.answer(q.exercise.correctAnswer);
      out.answer = answer?.success === true && answer?.correct === true && answer?.feedback;
      const next = await api.practice.next();
      out.next = next?.completed === false && api.practice.getState()?.currentIndex === 1;
      api.practice.reset();
      out.reset = api.practice.getState()?.active === false && api.practice.getState()?.questions?.length === 0;
      return out;
    });
    assert(result.meaningShape, `Meaning regression: ${JSON.stringify(result.meaning)}`);
    assert(result.recallShape, `Recall regression: ${JSON.stringify(result.recall)}`);
    assert(result.fillShape, `Fill regression: ${JSON.stringify(result.fill)}`);
    assert(result.chooseShape, `Choose regression: ${JSON.stringify(result.choose)}`);
    assert(result.productionShape, `Production regression: ${JSON.stringify(result.production)}`);
    assert(result.practiceStart && result.counterStart && result.answer && result.next && result.reset, `Practice lifecycle regression: ${JSON.stringify(result)}`);
    if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
    console.log('PASS V2.4 Practice regression: current exercise API, all 5 exercise shapes, practice lifecycle, answer, next and reset');
  } catch (error) {
    console.error(`FAIL V2.4 Practice regression — ${error.message}`);
    process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
