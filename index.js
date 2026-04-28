import cron from "node-cron";
import { scanWilaya } from "./scraper.js";
import { sendTelegram } from "./telegram.js";
import dotenv from "dotenv";

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

const notified = new Set();

async function checkAll() {
  console.log("Scanning...");

  for (const wilaya of WILAYAS) {
    const isAvailable = await scanWilaya(wilaya);

    if (isAvailable && !notified.has(wilaya)) {
      notified.add(wilaya);

      await sendTelegram(
        `🎉 حجز متوفر!\n📍 ${wilaya}\n🔗 ${process.env.TARGET_URL}`,
      );

      console.log("FOUND:", wilaya);
    } else {
      console.log("No:", wilaya);
    }
  }
}

// run every minute
cron.schedule("* * * * *", checkAll);

// first run immediately
checkAll();
