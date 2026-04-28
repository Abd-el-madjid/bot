import fs from "fs/promises";
import dotenv from "dotenv";
import { chromium } from "playwright";
import { sendTelegram } from "./telegram.js";

dotenv.config();

const WILAYAS = [
  "قسنطينة",
  "ميلة",
  "سكيكدة",
  "أم البواقي",
  "قالمة",
  "سوق أهراس",
  "عنابة",
  "جيجل",
  "خنشلة",
  "باتنة",
  "بسكرة",
  "سطيف",
  "برج بوعريريج",
];

const STATE_FILE = new URL("./state.json", import.meta.url);

async function readState() {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { notified: [] };
  }
}

async function writeState(state) {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Scan a single wilaya for availability
 */
async function scanWilaya(browser, wilaya) {
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

async function checkAll() {
  const targetUrl = process.env.TARGET_URL;
  const tgToken = process.env.TG_TOKEN;
  const tgChatId = process.env.TG_CHAT_ID;

  if (!targetUrl || !tgToken || !tgChatId) {
    console.error(
      "❌ Missing required env vars: TG_TOKEN, TG_CHAT_ID, TARGET_URL",
    );
    process.exit(1);
  }

  const state = await readState();
  const notified = new Set(state.notified);

  console.log(
    `\n🔍 Scanning ${WILAYAS.length} wilayas at ${new Date().toISOString()}`,
  );

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    // Scan sequentially to avoid overwhelming the server
    const results = [];
    for (const wilaya of WILAYAS) {
      try {
        const available = await scanWilaya(browser, wilaya);
        results.push({ wilaya, available });
        console.log(`  ${available ? "✅" : "❌"} ${wilaya}`);
      } catch (err) {
        console.warn(`  ⚠️  Error scanning ${wilaya}: ${err.message}`);
        results.push({ wilaya, available: false });
      }
    }

    let changed = false;
    const newlyAvailable = [];

    for (const { wilaya, available } of results) {
      if (available && !notified.has(wilaya)) {
        newlyAvailable.push(wilaya);
        notified.add(wilaya);
        changed = true;
      } else if (!available && notified.has(wilaya)) {
        // Remove from notified so we can notify again if it becomes available
        notified.delete(wilaya);
        changed = true;
      }
    }

    // Send one Telegram message listing all newly available wilayas
    if (newlyAvailable.length > 0) {
      const lines = newlyAvailable.map((w) => `📍 <b>${w}</b>`).join("\n");

      await sendTelegram(
        `🎉 <b>حجز متوفر الآن!</b>\n\n${lines}\n\n🔗 <a href="${targetUrl}">سجّل الآن على adhahi.dz</a>\n🕐 ${new Date().toLocaleString("ar-DZ")}`,
      );
    } else {
      console.log("  ℹ️  No new availability.");
    }

    if (changed) {
      await writeState({ notified: [...notified] });
      console.log("📝 state.json updated.");
    }
  } finally {
    await browser.close();
  }
}

await checkAll();
