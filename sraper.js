import { chromium } from "playwright";

export async function scanWilaya(wilaya) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(process.env.TARGET_URL);

  await page.fill("#reg-wilaya", wilaya);

  await page.waitForTimeout(800);

  const available = await page.evaluate((wilaya) => {
    const items = document.querySelectorAll('[role="option"]');

    for (let li of items) {
      if (!li.textContent.includes(wilaya)) continue;

      return (
        !li.hasAttribute("aria-disabled") &&
        li.classList.contains("cursor-pointer")
      );
    }
    return false;
  }, wilaya);

  await browser.close();
  return available;
}
