import { chromium } from "playwright";

export async function scanWilaya(browser, wilaya) {
  const url = process.env.TARGET_URL;
  if (!url) {
    throw new Error("TARGET_URL environment variable is required.");
  }

  let page = await browser.newPage();

  async function navigate() {
    return page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
  }

  try {
    let response = await navigate();

    if (!response || !response.ok()) {
      await page.close();
      page = await browser.newPage();
      response = await navigate();
    }

    await page.waitForSelector("#reg-wilaya", { timeout: 15000 });
    await page.fill("#reg-wilaya", wilaya);
    await page.waitForTimeout(800);

    const available = await page.evaluate((wilaya) => {
      const items = document.querySelectorAll('[role="option"]');

      for (const li of items) {
        const text = li.textContent?.trim() || "";
        if (!text.includes(wilaya)) continue;

        const availableText =
          text.includes("حجز متوفر") || text.includes("متوفر");
        const isGreenClass =
          li.classList.contains("text-green-600") ||
          li.classList.contains("bg-green-500") ||
          li.classList.contains("green");
        const colorStyle = window.getComputedStyle(li).color || "";
        const isGreenColor = colorStyle.includes("green");
        const isClickable =
          !li.hasAttribute("aria-disabled") &&
          li.classList.contains("cursor-pointer");

        if (
          (availableText || isGreenClass || isGreenColor) &&
          !li.hasAttribute("aria-disabled")
        ) {
          return true;
        }
      }
      return false;
    }, wilaya);

    return available;
  } finally {
    await page.close();
  }
}
