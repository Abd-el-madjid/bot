import fs from "fs/promises";
import dotenv from "dotenv";
import { scanAllWilayas } from "./scraper.js";
import { sendTelegram } from "./telegram.js";

dotenv.config();

const WATCH_WILAYAS = [
  "قسنطينة", "ميلة", "سكيكدة", "أم البواقي",
  "قالمة", "سوق أهراس", "عنابة", "جيجل",
  "خنشلة", "باتنة", "بسكرة", "سطيف", "برج بوعريريج",
];

const STATE_FILE = new URL("./state.json", import.meta.url);
const INTERVAL_SEC = 30;     // check every 30 seconds
const TOTAL_MINUTES = 4.5;   // run for 4.5 min (GitHub job limit ~6 min)
const ITERATIONS = Math.floor((TOTAL_MINUTES * 60) / INTERVAL_SEC); // ~9 checks

async function readState() {
  try { return JSON.parse(await fs.readFile(STATE_FILE, "utf-8")); }
  catch { return { notified: [] }; }
}

async function writeState(state) {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCheck(notified) {
  const targetUrl = process.env.TARGET_URL;
  const { available, totalFound } = await scanAllWilayas();

  if (totalFound === 0) {
    console.log("  ⚠️  0 wilayas found — skipping");
    return false;
  }

  const watchedAvailable = available.filter(name =>
    WATCH_WILAYAS.some(w => name.includes(w) || w.includes(name))
  );

  console.log(`  ✅ Available (watched): ${watchedAvailable.join(", ") || "none"}`);

  const newlyAvailable = watchedAvailable.filter(w => !notified.has(w));

  if (newlyAvailable.length > 0) {
    const lines = newlyAvailable.map(w => `📍 <b>${w}</b>`).join("\n");
    await sendTelegram(
      `🎉 <b>حجز متوفر الآن!</b>\n\n${lines}\n\n🔗 <a href="${targetUrl}">سجّل الآن على adhahi.dz</a>\n🕐 ${new Date().toLocaleString("ar-DZ")}`
    );
    newlyAvailable.forEach(w => notified.add(w));
    console.log(`  📨 Telegram sent for: ${newlyAvailable.join(", ")}`);
    return true; // state changed
  }

  // Reset notified if no longer available
  let changed = false;
  for (const w of [...notified]) {
    if (!watchedAvailable.includes(w)) {
      notified.delete(w);
      changed = true;
    }
  }
  return changed;
}

async function main() {
  if (!process.env.TARGET_URL || !process.env.TG_TOKEN || !process.env.TG_CHAT_ID) {
    console.error("❌ Missing env vars");
    process.exit(1);
  }

  const state   = await readState();
  const notified = new Set(state.notified);

  console.log(`🚀 Starting loop: ${ITERATIONS} checks × every ${INTERVAL_SEC}s`);

  for (let i = 1; i <= ITERATIONS; i++) {
    console.log(`\n[${i}/${ITERATIONS}] ${new Date().toISOString()}`);

    try {
      const changed = await runCheck(notified);
      if (changed) {
        await writeState({ notified: [...notified] });
      }
    } catch (err) {
      console.warn(`  ⚠️  Error: ${err.message}`);
    }

    if (i < ITERATIONS) {
      console.log(`  ⏳ Waiting ${INTERVAL_SEC}s...`);
      await sleep(INTERVAL_SEC * 1000);
    }
  }

  // Final state save
  await writeState({ notified: [...notified] });
  console.log("\n✅ Loop complete.");
}

await main();