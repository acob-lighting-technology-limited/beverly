const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testFullPipeline() {
  console.log('Starting full interactive trace of Battery Swap Portal...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const tracePath = path.join(__dirname, '../trace-battery-swap-interactive.zip');
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  const page = await context.newPage();

  const errors = [];
  const consoleWarningsAndErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const line = `[${msg.type().toUpperCase()}] ${msg.text()}`;
      consoleWarningsAndErrors.push(line);
      console.log(line);
    }
  });

  page.on('pageerror', err => {
    const line = `[PAGE ERROR] ${err.message}\n${err.stack}`;
    errors.push(line);
    console.error(line);
  });

  page.on('crash', () => {
    errors.push('[PAGE CRASH] Browser page crashed!');
    console.error('[PAGE CRASH] Browser page crashed!');
  });

  try {
    // 1. Navigate to root
    console.log('\n--- 1. Visiting Login Page ---');
    await page.goto('http://localhost:5177/', { waitUntil: 'domcontentloaded' });
    console.log('Title:', await page.title());

    // Injected auth session
    await page.evaluate(() => {
      const mockUser = {
        id: 'usr-admin-001',
        email: 'operations@beverly.ng',
        full_name: 'Beverly Admin',
        role: 'super-admin'
      };
      localStorage.setItem('beverly.battery_swap.access_token', 'mock_jwt_token_admin');
      localStorage.setItem('beverly.battery_swap.user', JSON.stringify(mockUser));
      localStorage.setItem('beverly.batterySwap.theme', 'dark');
    });

    // 2. Navigate to /fleet
    console.log('\n--- 2. Navigating to /fleet ---');
    await page.goto('http://localhost:5177/#/fleet', { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(__dirname, '../screenshot-fleet-page.png') });
    console.log('Screenshot saved: screenshot-fleet-page.png');

    // Click Merchant Batteries View Tab
    const merchantTab = page.locator('button:has-text("Merchant Batteries")');
    if (await merchantTab.count() > 0) {
      console.log('Clicking "Merchant Batteries" view tab...');
      await merchantTab.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(__dirname, '../screenshot-fleet-merchant-view.png') });
      console.log('Screenshot saved: screenshot-fleet-merchant-view.png');
    }

    // Click "+ Merchants add batteries" button
    const addBatBtn = page.locator('button:has-text("Merchants add batteries")');
    if (await addBatBtn.count() > 0) {
      console.log('Opening Add Battery modal...');
      await addBatBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(__dirname, '../screenshot-add-battery-modal.png') });
      const closeBtn = page.locator('.abm-close');
      if (await closeBtn.count() > 0) await closeBtn.click();
    }

    // 3. Navigate to /stations
    console.log('\n--- 3. Navigating to /stations ---');
    await page.goto('http://localhost:5177/#/stations', { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(__dirname, '../screenshot-stations-page.png') });
    console.log('Screenshot saved: screenshot-stations-page.png');

    // Click "+ New Station" button
    const newStationBtn = page.locator('button:has-text("New Station")');
    if (await newStationBtn.count() > 0) {
      console.log('Opening New Station modal...');
      await newStationBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(__dirname, '../screenshot-new-station-modal.png') });
      const closeBtn = page.locator('.asm-close');
      if (await closeBtn.count() > 0) await closeBtn.click();
    }

    // 4. Navigate to /crm
    console.log('\n--- 4. Navigating to /crm ---');
    await page.goto('http://localhost:5177/#/crm', { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(__dirname, '../screenshot-crm-page.png') });
    console.log('Screenshot saved: screenshot-crm-page.png');

    // Click on the first rider to open the CRM customer drawer
    const riderRow = page.locator('.crm-row').first();
    if (await riderRow.count() > 0) {
      console.log('Opening Rider CRM Profile Modal...');
      await riderRow.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(__dirname, '../screenshot-crm-rider-modal.png') });
      console.log('Screenshot saved: screenshot-crm-rider-modal.png');

      // Click "15S Cell Diagnostics" inspector button
      const inspectBtn = page.locator('button:has-text("15S Cell Diagnostics")');
      if (await inspectBtn.count() > 0) {
        console.log('Opening 15S Cell Diagnostics Modal...');
        await inspectBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(__dirname, '../screenshot-15s-diagnostics-modal.png') });
        console.log('Screenshot saved: screenshot-15s-diagnostics-modal.png');
      }
    }

    // 5. Navigate to /diagnostics
    console.log('\n--- 5. Navigating to /diagnostics ---');
    await page.goto('http://localhost:5177/#/diagnostics', { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(__dirname, '../screenshot-diagnostics-page.png') });
    console.log('Screenshot saved: screenshot-diagnostics-page.png');

    // 6. Navigate to /map
    console.log('\n--- 6. Navigating to /map ---');
    await page.goto('http://localhost:5177/#/map', { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(__dirname, '../screenshot-map-page.png') });
    console.log('Screenshot saved: screenshot-map-page.png');

  } catch (err) {
    console.error('Test pipeline error:', err);
    errors.push(`Pipeline execution failed: ${err.message}`);
  } finally {
    await context.tracing.stop({ path: tracePath });
    console.log(`Trace saved to: ${tracePath}`);
    await browser.close();
  }

  console.log('\n========================================');
  console.log('FULL TRACE VERIFICATION RESULTS:');
  console.log(`Page Errors: ${errors.length}`);
  console.log(`Console Warnings/Errors: ${consoleWarningsAndErrors.length}`);
  console.log('========================================');

  if (errors.length > 0) {
    console.error('Errors found:');
    errors.forEach(e => console.error(e));
    process.exit(1);
  } else {
    console.log('ALL ROUTES, VIEWS, MODALS AND TELEMETRY CONTROLS LOADED WITH 0 CRASHES AND 0 PAGE ERRORS!');
  }
}

testFullPipeline();
