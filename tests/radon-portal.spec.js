// Playwright tests for Radon Portal fallback and basic SPA behavior
// Uses @playwright/test
// Ensures /radon-g3mes loads, game list appears, selecting game loads iframe content.

const { test, expect } = require('@playwright/test');
// Server is auto-managed by playwright.config.js webServer

// Basic availability
 test('Radon portal loads (fallback or SPA)', async ({ page }) => {
  await page.goto('/radon-g3mes');
  // Either fallback header or React root element
  const fallbackHeader = page.locator('header:has-text("Radon Portal")');
  const reactRoot = page.locator('#root');
  await expect(fallbackHeader.or(reactRoot)).toBeVisible({ timeout: 8000 });
});

// games.json endpoint returns array or valid JSON
 test('games.json returns array of games', async ({ page }) => {
  const response = await page.request.get('/radon-g3mes/games.json');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(Array.isArray(body)).toBeTruthy();
});

// Fallback search script populates list and loads game iframe
 test('Fallback portal lists games and loads a game', async ({ page }) => {
  await page.goto('/radon-g3mes');
  // Ensure list populates
  const listItems = page.locator('#gameList li');
  await expect(listItems.first()).toBeVisible({ timeout: 10000 });
  const firstText = await listItems.first().innerText();
  // Click first game
  await listItems.first().click();
  const iframe = page.frameLocator('#gameFrame');
  // Wait for inner game content to load (look for any body)
  await expect(iframe.locator('body')).toBeVisible({ timeout: 10000 });
  expect(firstText.length).toBeGreaterThan(0);
});

// Media player basic load
 test('Media player page loads', async ({ page }) => {
  await page.goto('/media-player');
  await expect(page.locator('h1:has-text("Secret Media Player")')).toBeVisible();
});
