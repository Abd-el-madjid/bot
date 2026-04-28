import fs from "fs/promises";
import dotenv from "dotenv";
import { scanAllWilayas } from "./scraper.js";
import { sendTelegram } from "./telegram.js";

dotenv.config();

const WATCH_WILAYAS = [
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
    "الطارف",
    
];

const STATE_FILE = new URL("./state.json", import.meta.url);

async function readState() {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, "utf-8"));
  } catch {
    return { notified: [] };
  }
}

async function writeState(state) {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

async function main() {
  const targetUrl = process.env.TARGET_URL;
  if (!process.env.TG_TOKEN || !process.env.TG_CHAT_ID || !targetUrl) {
    console.error("❌ Missing env vars: TG_TOKEN, TG_CHAT_ID, TARGET_URL");
    process.exit(1);
  }

  console.log(`\n🔍 Scanning at ${new Date().toISOString()}`);

  const { available, unavailable, totalFound } = await scanAllWilayas();

  console.log(`📋 Total wilayas found in page: ${totalFound}`);

  if (totalFound === 0) {
    console.error("❌ Zero wilayas found — page structure may have changed.");
    await sendTelegram("⚠️ <b>تحذير:</b> لم يُعثر على أي ولاية في الصفحة.");
    process.exit(0);
  }

  // Filter to only watched wilayas
  const watchedAvailable = available.filter((name) =>
    WATCH_WILAYAS.some((w) => name.includes(w) || w.includes(name)),
  );

  console.log(`✅ Available (all site): ${available.join(", ") || "none"}`);
  console.log(
    `🎯 Available (watched):  ${watchedAvailable.join(", ") || "none"}`,
  );

  const state = await readState();
  const notified = new Set(state.notified);
  let changed = false;

  // Newly available → notify
  const newlyAvailable = watchedAvailable.filter((w) => !notified.has(w));
  if (newlyAvailable.length > 0) {
    const lines = newlyAvailable.map((w) => `📍 <b>${w}</b>`).join("\n");
    await sendTelegram(
      `🎉 <b>حجز متوفر الآن!</b>\n\n${lines}\n\n🔗 <a href="${targetUrl}">سجّل الآن على adhahi.dz</a>\n🕐 ${new Date().toLocaleString("ar-DZ")}`,
    );
    newlyAvailable.forEach((w) => notified.add(w));
    changed = true;
    console.log(`📨 Telegram sent for: ${newlyAvailable.join(", ")}`);
  }

  // No longer available → reset so we notify again if it comes back
  for (const w of [...notified]) {
    if (!watchedAvailable.includes(w)) {
      notified.delete(w);
      changed = true;
    }
  }

  if (changed) {
    await writeState({ notified: [...notified] });
    console.log("📝 state.json updated.");
  } else {
    console.log("ℹ️  No changes.");
  }
}

await main();
