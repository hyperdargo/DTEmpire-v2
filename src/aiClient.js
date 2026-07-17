import axios from "axios";
import { BASE_URL, API_KEY } from "./config/models.js";

const effectiveUrl = BASE_URL || "https://9router.ankitgupta.com.np";
const effectiveKey = API_KEY || "sk-148e8148fd72f567-r4bclf-90fd2c85";

console.log(`[src/aiClient] URL: ${effectiveUrl}, Key set: ${!!effectiveKey}`);

const client = axios.create({
  baseURL: effectiveUrl,
  timeout: 120000,
  headers: {
    "Authorization": `Bearer ${effectiveKey}`,
    "Content-Type": "application/json"
  }
});

export async function callQuickModel(prompt, model = "Discord") {
  const url = `/v1/chat/completions`;
  const start = Date.now();
  const { data } = await client.post(url, {
    model: model || "Discord",
    messages: [{ role: 'user', content: prompt }]
  });
  const elapsedMs = Date.now() - start;
  
  // Extract response text safely
  const responseText = data.choices?.[0]?.message?.content || data.response || data.text || data;
  return { response: responseText, elapsedMs, model };
}

export async function callTextModel(prompt, model = "Discord") {
  const url = `/v1/chat/completions`;
  const start = Date.now();
  const { data } = await client.post(url, {
    model: model || "Discord",
    messages: [{ role: 'user', content: prompt }]
  });
  const elapsedMs = Date.now() - start;
  
  const responseText = data.choices?.[0]?.message?.content || data.response || data.text || data;
  return { response: responseText, elapsedMs, model };
}
