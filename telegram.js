import axios from "axios";

export async function sendTelegram(text) {
  if (!process.env.TG_TOKEN || !process.env.TG_CHAT_ID) {
    console.error("Missing TG_TOKEN or TG_CHAT_ID environment variables.");
    return;
  }

  try {
    const res = await axios.post(
      `https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`,
      {
        chat_id: process.env.TG_CHAT_ID,
        text,
        parse_mode: "HTML",
      },
    );

    if (!res.data.ok) {
      console.error("TG error:", res.data);
    }
  } catch (err) {
    console.error("TG request failed:", err.message);
  }
}
