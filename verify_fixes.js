const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // TTT Check
  await page.goto('http://localhost:3000/games/tic-tac-toe.html');
  await page.screenshot({ path: '/home/jules/verification/fixed_ttt.png' });

  // UNO Check
  await page.goto('http://localhost:3000/games/uno.html');
  await page.screenshot({ path: '/home/jules/verification/fixed_uno.png' });

  await browser.close();
})();
