import { _electron as electron, test, expect } from '@playwright/test';

test('QA/QC - Update Tools and Run Scan', async () => {
  test.setTimeout(600000);
  const electronApp = await electron.launch({ 
    args: ['.'],
  });

  const window = await electronApp.firstWindow();
  
  // Wait for the app to load
  await window.waitForSelector('input[type="text"]');

  // Click Update Tools
  await window.click('button:has-text("Update Tools")');

  // Wait for the update modal to appear and complete (button changes to Close)
  // Wait for up to 500 seconds since updating tools (especially via pip/go) can take time
  await window.waitForSelector('button:has-text("Close")', { timeout: 500000 });
  await window.click('button:has-text("Close")');

  // Fill in a random target URL
  await window.fill('input[type="text"]', 'https://example.com');

  // Start Scan
  await window.click('button:has-text("Start Scan")');

  // Verify the button changes to Stop Scan
  await expect(window.locator('button:has-text("Stop Scan")')).toBeVisible();

  // Let it scan for 15 seconds
  await window.waitForTimeout(15000);

  // Take a screenshot for the evaluation report
  await window.screenshot({ path: 'tests/qa-qc-scan-results.png' });

  // Stop the scan
  await window.click('button:has-text("Stop Scan")');

  // Verify it stopped
  await expect(window.locator('button:has-text("Start Scan")')).toBeVisible();

  await electronApp.close();
});
