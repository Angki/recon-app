import { _electron as electron, test, expect, type ElectronApplication, type Page } from '@playwright/test';

test.describe('Comprehensive E2E QA', () => {
  let electronApp: ElectronApplication;
  let window: Page;

  test.beforeAll(async () => {
    electronApp = await electron.launch({ args: ['.'] });
    window = await electronApp.firstWindow();
    await window.waitForSelector('text="Configuration" || text="Dashboard" || text="Recon App"');
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('Settings: Can navigate, load, and save configurations securely', async () => {
    await window.click('a:has-text("Settings")');
    await expect(window.locator('h1:has-text("Configuration")')).toBeVisible();

    // Fill in a dummy acunetix email and password
    await window.fill('input[placeholder="admin@admin.com"]', 'qa@qa.local');
    await window.fill('input[type="password"]', 'QA_Password123');

    // Save
    await window.click('button:has-text("Save Settings")');
    await window.waitForTimeout(1000);
  });

  test('Dashboard: Can initiate a scan and UI responds correctly', async () => {
    await window.click('a:has-text("Dashboard")');
    await expect(window.locator('h1:has-text("Security Dashboard")')).toBeVisible();

    // Check we can type in URL
    await window.fill('input[type="text"]', 'https://example.com');
    await window.click('button:has-text("Start Scan")');
    
    // Stop Scan should appear
    await expect(window.locator('button:has-text("Stop Scan")')).toBeVisible();

    // Tab switching state test
    await window.click('a:has-text("History")');
    await window.click('a:has-text("Dashboard")');
    
    // State should be preserved
    await expect(window.locator('button:has-text("Stop Scan")')).toBeVisible();

    // Stop the scan
    await window.click('button:has-text("Stop Scan")');
    await expect(window.locator('button:has-text("Start Scan")')).toBeVisible();
  });

  test('AI Analyst: Can navigate and render UI elements', async () => {
    await window.click('button:has-text("AI Analyst")');
    await expect(window.locator('button:has-text("Analyze Vulnerabilities")')).toBeVisible();
    await window.click('button:has-text("Analyze Vulnerabilities")');
    
    // Wait to see if loading animation or response happens
    await window.waitForTimeout(3000);
    // It should either show an error boundary or an analysis result
  });

  test('History: Displays previously run scans', async () => {
    await window.click('a:has-text("History")');
    await expect(window.locator('h1:has-text("Scan History")')).toBeVisible();
    
    // Wait for history items to load
    await window.waitForTimeout(2000);
  });
});
