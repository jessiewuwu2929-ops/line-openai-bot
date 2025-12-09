import express from "express";
import crypto from "crypto";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

// 驗證 LINE 簽名
function validateLineSignature(body, signature) {
  const hmac = crypto
    .createHmac("sha256", LINE_CHANNEL_SECRET)
    .update(body)
    .digest("base64");
  return hmac === signature;
}

// LINE Webhook 入口
app.post("/webhook", async (req, res) => {
  const body = JSON.stringify(req.body);
  const signature = req.headers["x-line-signature"];

  if (!validateLineSignature(body, signature)) {
    console.log("signature error");
    return res.status(403).send("Invalid signature");
  }

  const events = req.body.events || [];
  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const userText = event.message.text;
      const replyToken = event.replyToken;

      const aiReply = await callOpenAI(userText);
      await replyToLine(replyToken, aiReply);
    }
  }

  res.status(200).send("OK");
});

// 呼叫 OpenAI Responses API
async function callOpenAI(text) {
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `請用繁體中文回答：${text}`,
      }),
    });

    const data = await response.json();
    console.log("OpenAI:", JSON.stringify(data));

    return (
      data.output?.[0]?.content?.[0]?.text ||
      "我暫時無法回應，請稍後再試。"
    );
  } catch (err) {
    console.error("OpenAI error:", err);
    return "我暫時無法回應，請稍後再試。";
  }
}

// 回訊息給 LINE
async function replyToLine(replyToken, replyText) {
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: replyText }],
    }),
  });

  const data = await response.text();
  console.log("LINE reply:", data);
}

app.get("/", (req, res) => {
  res.send("LINE Bot is running.");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
