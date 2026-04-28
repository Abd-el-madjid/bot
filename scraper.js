import { chromium } from "playwright";

export async function scanAllWilayas() {
  const url = process.env.TARGET_URL;
  if (!url) throw new Error("TARGET_URL is not set.");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
    ],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    locale: "ar-DZ",
    extraHTTPHeaders: {
      "Accept-Language": "ar,fr;q=0.9,en;q=0.8",
    },
  });

  // Hide automation fingerprints
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();

  // Block heavy resources
  await page.route("**/*", (route) => {
    const type = route.request().resourceType();
    if (["image", "font", "media"].includes(type)) route.abort();
    else route.continue();
  });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });

    // Try clicking the wilaya field to trigger the dropdown
    const input = page.locator("#reg-wilaya");
    await input.waitFor({ state: "visible", timeout: 30000 });
    await input.click();
    await page.waitForTimeout(800);

    // Wait for dropdown list
    await page.waitForSelector('ul[role="listbox"] li[role="option"]', {
      timeout: 10000,
    });

    const results = await page.evaluate(() => {
      const items = document.querySelectorAll(
        'ul[role="listbox"] li[role="option"]',
      );
      const available = [],
        unavailable = [];
      items.forEach((li) => {
        const text = li.textContent?.trim() ?? "";
        const name = text.split("—")[0].trim();
        if (!name) return;
        const isDisabled = li.hasAttribute("aria-disabled");
        const isClickable = li.classList.contains("cursor-pointer");
        const textOk =
          text.includes("حجز متوفر") && !text.includes("غير متوفر");
        if (!isDisabled && isClickable && textOk) available.push(name);
        else unavailable.push(name);
      });
      return { available, unavailable };
    });

    return {
      ...results,
      totalFound: results.available.length + results.unavailable.length,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}
