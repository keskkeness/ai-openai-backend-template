import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Missing OPENAI_API_KEY in environment variables.");
}

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* -----------------------------
   SIMPLE IN-MEMORY RATE LIMIT
------------------------------ */

const requestLog = new Map();
const MAX_REQUESTS_PER_MINUTE = 10;

function checkRateLimit(ip) {
  const now = Date.now();

  if (!requestLog.has(ip)) {
    requestLog.set(ip, { count: 1, first: now });
    return true;
  }

  const data = requestLog.get(ip);

  if (now - data.first > 60000) {
    requestLog.set(ip, { count: 1, first: now });
    return true;
  }

  if (data.count >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }

  data.count++;
  return true;
}

/* -----------------------------
   HEALTH CHECK
------------------------------ */

app.get("/", (req, res) => {
  res.send("AI backend template running.");
});

/* -----------------------------
   GENERATE ENDPOINT
------------------------------ */

app.post("/generate", async (req, res) => {
  try {
    const ip = req.ip;

    if (!checkRateLimit(ip)) {
      return res.status(429).json({
        error: "Too many requests. Please try again later."
      });
    }

    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "Prompt must be a valid string."
      });
    }

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_output_tokens: 300,
      input: [
        {
          role: "system",
          content: "You are a helpful assistant. Keep responses structured and clear."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const output =
      response.output_text?.trim() ||
      "No response generated.";

    res.json({ result: output });

  } catch (error) {
    console.error("AI ERROR:", error);
    res.status(500).json({
      error: "Internal server error."
    });
  }
});

/* -----------------------------
   START SERVER
------------------------------ */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
