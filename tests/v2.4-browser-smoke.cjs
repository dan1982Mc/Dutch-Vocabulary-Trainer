/* Dutch Vocabulary Trainer V2.4 browser smoke test. */
'use strict';
const { chromium } = require('playwright');
const BASE_URL = process.env.DVT_BASE_URL || 'http://127.0.0.1:8000/index.html';
function assert(condition, message) { if (!condition) throw new Error(message); }
async function active(page, id) { return page.locator(`#${id}`).evaluate(el => el.classList.contains('active')); }
async function waitForApp(page) {
  try {
    await page.waitForFunction(() => window.DutchTrainerApp?.state?.initialized === true, { timeout: 15000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      app: !!window.DutchTrainerApp,
      initialized: window.DutchTrainerApp?.state?.initialized ?? null,
      initializing: window.DutchTrainerApp?.state?.initializing ?? null,
      lastError: window.DutchTrainerApp?.state?.lastError ?? null,
      activeScreens: [...document.querySelectorAll('.screen.active')].map(e => e.id),
      body: document.body.innerText.slice(0, 1000)
    }));
    throw new Error(`Application did not initialize: ${JSON.stringify(state)}`);
  }
}
async function navigate(page, buttonId, screenId, label) {
  const button = page.locator(`#${buttonId}`);
  await button.waitFor({ state: 'visible', timeout: 5000 });
  await button.click();
  try {
    await page.locator(`#${screenId}`).waitFor({ state: 'visible', timeout: 5000 });
  } catch (error) {
    const state = await page.evaluate(({ buttonId, screenId }) => ({
      button: document.getElementById(buttonId)?.outerHTML,
      activeScreens: [...document.querySelectorAll('.screen.active')].map(e => e.id),
      targetClasses: document.getElementById(screenId)?.className ?? null,
      hash: location.hash,
      uiBound: window.__DutchTrainerUIBound ?? null,
      navigateToAvailable: typeof window.navigateTo === 'function',
      appInitialized: window.DutchTrainerApp?.state?.initialized ?? null,
      appError: window.DutchTrainerApp?.state?.lastError ?? null
    }), { buttonId, screenId });
    throw new Error(`${label} navigation failed: ${JSON.stringify(state)}`);
  }
  assert(await active(page, screenId), `${label} navigation failed`);
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await waitForApp(page);
    assert(await active(page, 'homeScreen'), 'Home screen is not active after initialization');
    assert(await page.locator('#app').count() === 1, 'Application root is missing');
    await navigate(page, 'dashboardBtn', 'dashboardScreen', 'Dashboard');
    await navigate(page, 'packsBtn', 'packsScreen', 'Word Packs');
    assert(await page.locator('#activePackSelector').count() === 1, 'Active pack selector is missing');
    assert(await page.locator('#packsList').count() === 1, 'Installed Packs container is missing');
    await navigate(page, 'settingsBtn', 'settingsScreen', 'Settings');
    await navigate(page, 'historyBtn', 'historyScreen', 'History');
    await page.locator('#practiceSetupBtn').click();
    await page.locator('#practiceModal').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('#closePracticeModal').click();
    await page.locator('#practiceModal').waitFor({ state: 'hidden', timeout: 5000 });
    await navigate(page, 'dashboardBtn', 'dashboardScreen', 'Return to Dashboard');
    if (consoleErrors.length) throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);
    console.log('PASS V2.4 browser smoke: app initializes and all primary screens/navigation work');
  } catch (error) {
    console.error(`FAIL V2.4 browser smoke — ${error.message}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
