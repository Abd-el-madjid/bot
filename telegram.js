import axios from "axios";

export async function sendTelegram(text) {
  const token = process.env.TG_TOKEN;
  const chatId = process.env.TG_CHAT_ID;

  if (!token || !chatId) {
    console.error("Missing TG_TOKEN or TG_CHAT_ID");
    return;
  }

  try {
    const res = await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      },
    );

    if (!res.data.ok) {
      console.error("Telegram error:", res.data);
    } else {
      console.log("✅ Telegram message sent.");
    }
  } catch (err) {
    console.error("Telegram request failed:", err.message);
  }
}
