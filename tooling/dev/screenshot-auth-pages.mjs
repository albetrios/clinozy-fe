import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pages = [
  { url: 'http://localhost:5175/login', name: 'login' },
  { url: 'http://localhost:5175/mfa', name: 'mfa' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  console.log('Starting screenshot capture...\n');

  for (const { url, name } of pages) {
    try {
      console.log(`Navigating to ${url}...`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });

      // Wait a bit for any animations or lazy-loaded content
      await page.waitForTimeout(1000);

      const screenshotPath = join(__dirname, `screenshot-${name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`✓ Screenshot saved: screenshot-${name}.png\n`);
    } catch (error) {
      console.error(`✗ Error capturing ${name}: ${error.message}\n`);
    }
  }

  await browser.close();
  console.log('Screenshot capture complete!');
})();
