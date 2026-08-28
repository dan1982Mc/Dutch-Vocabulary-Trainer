/* Dutch Vocabulary Trainer V2.4 browser smoke test.
 * Requires Playwright. CI installs it without making it a runtime app dependency.
 */
'use strict';
const { chromium } = require('playwright');

const BASE_URL=process.env.DVT_BASE_URL||'http://127.0.0.1:8000/index.html';
const failures=[];
function assert(condition,message){if(!condition)throw new Error(message);}
async function active(page,id){return page.locator(`#${id}`).evaluate(el=>el.classList.contains('active'));}
async function waitForApp(page){await page.waitForFunction(()=>window.DutchTrainerApp?.state?.initialized===true,{timeout:15000});}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  const page=await context.newPage();
  const consoleErrors=[];
  page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text());});
  page.on('pageerror',error=>consoleErrors.push(error.message));
  try{
    await page.goto(BASE_URL,{waitUntil:'networkidle'});
    await waitForApp(page);
    assert(await active(page,'homeScreen'),'Home screen is not active after initialization');
    assert(await page.locator('#app').count()===1,'Application root is missing');

    await page.click('#dashboardBtn');
    assert(await active(page,'dashboardScreen'),'Dashboard navigation failed');

    await page.click('#packsBtn');
    assert(await active(page,'packsScreen'),'Word Packs navigation failed');
    assert(await page.locator('#activePackSelector').count()===1,'Active pack selector is missing');
    assert(await page.locator('#packsList').count()===1,'Installed Packs container is missing');

    await page.click('#settingsBtn');
    assert(await active(page,'settingsScreen'),'Settings navigation failed');

    await page.click('#historyBtn');
    assert(await active(page,'historyScreen'),'History navigation failed');

    await page.click('#practiceSetupBtn');
    assert(await page.locator('#practiceModal').count()===1,'Practice modal is missing');
    assert(!(await page.locator('#practiceModal').evaluate(el=>el.classList.contains('hidden'))),'Practice setup modal did not open');
    await page.click('#closePracticeModal');
    assert(await page.locator('#practiceModal').evaluate(el=>el.classList.contains('hidden')),'Practice setup modal did not close');

    await page.click('#dashboardBtn');
    assert(await active(page,'dashboardScreen'),'Return to Dashboard failed');

    if(consoleErrors.length)throw new Error(`Browser console errors: ${consoleErrors.join(' | ')}`);
    console.log('PASS V2.4 browser smoke: app initializes and all primary screens/navigation work');
  }catch(error){
    failures.push(error.message);
    console.error(`FAIL V2.4 browser smoke — ${error.message}`);
    process.exitCode=1;
  }finally{
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
