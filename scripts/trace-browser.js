const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function traceUrl(targetUrl, name) {
  console.log(`\n========================================`);
  console.log(`Tracing: ${targetUrl} (${name})`);
  console.log(`========================================`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  // Start tracing
  const tracePath = path.join(__dirname, `../trace-${name}.zip`);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  const page = await context.newPage();

  const consoleLogs = [];
  const errors = [];
  const requestFailures = [];

  page.on('console', msg => {
    const text = `[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`;
    consoleLogs.push(text);
    if (msg.type() === 'error') {
      console.error(text);
    }
  });

  page.on('pageerror', err => {
    const text = `[PAGE ERROR] ${err.message}\nStack: ${err.stack}`;
    errors.push(text);
    console.error(text);
  });

  page.on('crash', () => {
    console.error(`[CRASH] Page crashed!`);
    errors.push(`[PAGE CRASH] Target crashed!`);
  });

  page.on('requestfailed', req => {
    const failure = req.failure();
    const text = `[REQUEST FAILED] ${req.method()} ${req.url()} - ${failure ? failure.errorText : 'Unknown error'}`;
    requestFailures.push(text);
  });

  try {
    console.log(`Navigating to ${targetUrl}...`);
    const response = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
    console.log(`Response status: ${response ? response.status() : 'No response'}`);

    // Wait a couple seconds to observe runtime errors / websocket / telemetry loops
    await page.waitForTimeout(3000);

    const title = await page.title();
    console.log(`Page Title: "${title}"`);

    const screenshotPath = path.join(__dirname, `../screenshot-${name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved to: ${screenshotPath}`);

  } catch (err) {
    console.error(`Navigation or execution failed: ${err.message}`);
    errors.push(`Navigation/Execution failed: ${err.message}`);
  } finally {
    await context.tracing.stop({ path: tracePath });
    console.log(`Trace saved to: ${tracePath}`);
    await browser.close();
  }

  console.log(`\n--- Summary for ${name} ---`);
  console.log(`Console logs total: ${consoleLogs.length}`);
  console.log(`Console errors: ${consoleLogs.filter(l => l.includes('ERROR')).length}`);
  console.log(`Page errors: ${errors.length}`);
  console.log(`Request failures: ${requestFailures.length}`);
  if (requestFailures.length > 0) {
    console.log(`Request failures details:`, requestFailures.slice(0, 5));
  }
  return { consoleLogs, errors, requestFailures };
}

(async () => {
  try {
    await traceUrl('http://localhost:5179/', 'battery-swap-5179');
    await traceUrl('http://localhost:5174/', 'vendor-5174');
  } catch (e) {
    console.error('Trace runner error:', e);
  }
})();
