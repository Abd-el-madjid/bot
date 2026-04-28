import fs from "fs/promises";
import dotenv from "dotenv";
import { chromium } from "playwright";
import { scanWilaya } from "./scraper.js";
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

async function checkAll() {
  const targetUrl = process.env.TARGET_URL;
  const tgToken = process.env.TG_TOKEN;
  const tgChatId = process.env.TG_CHAT_ID;

  if (!targetUrl || !tgToken || !tgChatId) {
    console.error(
      "Missing required env vars. Ensure TG_TOKEN, TG_CHAT_ID, and TARGET_URL are set.",
    );
    process.exit(1);
  }

  const state = await readState();
  const notified = new Set(state.notified);

  console.log("Scanning all wilayas in parallel...");

  const browser = await chromium.launch({ headless: true });
  try {
    const scanResults = await Promise.all(
      WILAYAS.map(async (wilaya) => ({
        wilaya,
        available: await scanWilaya(browser, wilaya),
      })),
    );

    let changed = false;

    for (const { wilaya, available } of scanResults) {
      if (available) {
        if (!notified.has(wilaya)) {
          await sendTelegram(`🎉 حجز متوفر!\n📍 ${wilaya}\n🔗 ${targetUrl}`);
          console.log("FOUND:", wilaya);
          notified.add(wilaya);
          changed = true;
        } else {
          console.log("Already notified:", wilaya);
        }
      } else {
        console.log("No:", wilaya);
        if (notified.delete(wilaya)) {
          changed = true;
        }
      }
    }

    if (changed) {
      await writeState({ notified: [...notified] });
      console.log("Updated state.json");
    } else {
      console.log("No state changes");
    }
  } finally {
    await browser.close();
  }
}

await checkAll();
