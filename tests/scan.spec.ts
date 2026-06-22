import { _electron as electron, test, expect } from '@playwright/test';

test('App starts, runs scan, and preserves UI state across tabs', async () => {
  // Wait for the electron app to build and start
  const electronApp = await electron.launch({ 
    args: ['.'],
  });

  const window = await electronApp.firstWindow();
  
  // 1. Wait for the app to load
  await window.waitForSelector('input[type="text"]');

  // 2. Fill in a safe target URL for automated QA
  await window.fill('input[type="text"]', 'https://scanme.nmap.org/');

  // 3. Click the Start Scan button
  await window.click('button:has-text("Start Scan")');

  // 4. Verify the button changes to Stop Scan
  await expect(window.locator('button:has-text("Stop Scan")')).toBeVisible();

  // Let it scan for 5 seconds
  await window.waitForTimeout(5000);

  // 5. Test the UI Reset Bug (User reported switching tabs resets UI)
  // Click on Settings tab
  await window.click('a:has-text("Settings")');
  await expect(window.locator('h1:has-text("Configuration")')).toBeVisible();
  await window.waitForTimeout(1000);

  // Click on History tab
  await window.click('a:has-text("History")');
  await expect(window.locator('h1:has-text("Scan History")')).toBeVisible();
  await window.waitForTimeout(1000);

  // Go back to Dashboard
  await window.click('a:has-text("Dashboard")');

  // 6. Verify Dashboard State is preserved (The Stop Scan button should still be visible, meaning scan is still running)
  await expect(window.locator('button:has-text("Stop Scan")')).toBeVisible();

  // Wait another 10 seconds for tools to produce some logs
  await window.waitForTimeout(10000);

  // 7. Take a screenshot for the evaluation report
  await window.screenshot({ path: 'tests/qa-eval-scan-results.png' });

  // 8. Stop the scan manually to save CI time
  await window.click('button:has-text("Stop Scan")');

  // Verify it stopped
  await expect(window.locator('button:has-text("Start Scan")')).toBeVisible();

  await electronApp.close();
});
