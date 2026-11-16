// Secure proxy between the browser and Dify.ai. The API key never leaves the server.
const crypto = require("crypto");

const CORS = {
  "Access-Control-Allow-Origin": "*", // Replace * with your site URL in production
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "POST") return reply(405, { error: "Method not allowed." });

  const apiKey = process.env.DIFY_API_KEY;
  if (!apiKey) return reply(500, { error: "Chat is not configured yet. The DIFY_API_KEY environment variable is missing." });

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return reply(400, { error: "Invalid request body." }); }

  const query = typeof payload.query === "string" ? payload.query.trim() : "";
  if (!query) return reply(400, { error: "Please type a message." });
  if (query.length > 2000) return reply(400, { error: "Message is too long (2000 characters max)." });

  // Dify requires the same `user` for every message in a conversation.
  const rawUser = payload.user_id || event.headers["x-nf-client-connection-ip"] || "anonymous";
  const user = "shop-" + crypto.createHash("sha256").update(String(rawUser)).digest("hex").slice(0, 24);

  // Accepts https://api.dify.ai, https://api.dify.ai/v1 or your self-hosted URL.
  const base = (process.env.DIFY_API_URL || "https://api.dify.ai").replace(/\/+$/, "").replace(/\/v1$/, "");

  try {
    const res = await fetch(`${base}/v1/chat-messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        inputs: {},
        query,
        response_mode: "blocking",
        conversation_id: payload.conversation_id || "",
        user
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Dify error", res.status, data);
      return reply(res.status === 401 ? 500 : 502, {
        error: res.status === 401
          ? "The chat service rejected the API key. Check DIFY_API_KEY."
          : data.message || "The assistant is unavailable right now. Please try again."
      });
    }
    return reply(200, { answer: data.answer, conversation_id: data.conversation_id });
  } catch (err) {
    console.error("Proxy error", err);
    return reply(502, { error: "Could not reach the assistant. Please try again shortly." });
  }
};
