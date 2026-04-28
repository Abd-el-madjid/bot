import { chromium } from "playwright";

/**
 * Opens the page, types the wilaya name into #reg-wilaya,
 * waits for the dropdown, then checks if that wilaya has
 * the "available" styling (emerald bg + cursor-pointer + no aria-disabled).
 */
export async function scanWilaya(browser, wilaya) {
  const url = process.env.TARGET_URL;
  if (!url) throw new Error("TARGET_URL environment variable is required.");

  const page = await browser.newPage();

  try {
    /* ── 1. Load page ── */
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("#reg-wilaya", { timeout: 20000 });

    /* ── 2. Clear field then type wilaya name ── */
    await page.click("#reg-wilaya");
    await page.fill("#reg-wilaya", ""); // clear first
    await page.type("#reg-wilaya", wilaya, { delay: 60 });

    /* ── 3. Wait for listbox to appear ── */
    await page
      .waitForSelector('[role="listbox"] li[role="option"]', { timeout: 5000 })
      .catch(() => null);

    await page.waitForTimeout(600);

    /* ── 4. Evaluate availability ── */
    const available = await page.evaluate((w) => {
      const listbox = document.querySelector('[role="listbox"]');
      if (!listbox) return false;

      const items = listbox.querySelectorAll('li[role="option"]');

      for (const li of items) {
        const text = li.textContent?.trim() ?? "";

        // Must contain the wilaya name
        if (!text.includes(w)) continue;

        // Available items:
        //  - have NO aria-disabled attribute
        //  - have cursor-pointer (NOT cursor-not-allowed)
        //  - text contains "حجز متوفر" (not "غير متوفر")
        //  - Tailwind classes: bg-emerald-50/95, text-emerald-950, ring-emerald-200/90
        const isDisabled = li.hasAttribute("aria-disabled");
        const isClickable = li.classList.contains("cursor-pointer");
        const textSaysAvailable =
          text.includes("حجز متوفر") && !text.includes("غير متوفر");
        const hasEmeraldBg =
          li.classList.contains("bg-emerald-50/95") ||
          [...li.classList].some((c) => c.startsWith("bg-emerald"));

        if (!isDisabled && isClickable && textSaysAvailable) return true;
        if (!isDisabled && hasEmeraldBg && textSaysAvailable) return true;
      }

      return false;
    }, wilaya);

    return available;
  } finally {
    await page.close();
  }
}
