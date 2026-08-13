/**
 * In-app support chat, mirroring BOI: plain REST (no websockets). With
 * ANTHROPIC_API_KEY set, replies come from Claude; without it, the endpoint
 * falls back to scripted answers so the feature still works. Chat history is
 * stored in Postgres.
 *
 *   POST /api/chat/ai            { message, sessionId? } -> { reply, sessionId }
 *   GET  /api/chat/messages/:id                          -> { messages }
 */
import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { chatMessages, chatSessions } from "../../shared/schema";
import { env } from "../env";

export const chatRouter = Router();

const SYSTEM_PROMPT =
  "You are a friendly customer-support assistant for a Lloyds banking app. " +
  "This is a training simulation with fake accounts, so never ask for or handle " +
  "real card numbers, passwords, or personal data. Keep answers short, clear, " +
  "and reassuring. If asked to move real money or do something only a real bank " +
  "can, explain that this is a demo app.";

const SCRIPTED: { match: RegExp; reply: string }[] = [
  { match: /balance/i, reply: "You can see each account's balance on the Home screen. Tap an account to view its full details and recent activity." },
  { match: /transfer|send money|payment/i, reply: "To send money, open an account, tap Pay & Transfer, choose or add a payee, enter the amount and confirm. The balance updates straight away." },
  { match: /payee/i, reply: "Add a payee from the Pay & Transfer screen: choose 'Pay someone new', enter their name, sort code and account number, then save." },
  { match: /card|pin/i, reply: "Card details and your PIN are under the Cards tab. You can reveal your PIN or view full card details there." },
  { match: /lost|stolen|fraud/i, reply: "If a card is lost or stolen, use Cards > Lost or Stolen Cards to freeze it immediately. (This is a demo, so no real card is affected.)" },
  { match: /hello|hi|hey|help/i, reply: "Hi! I'm here to help with the Lloyds app — balances, payments, payees or cards. What would you like to do?" },
];

function scriptedReply(message: string): string {
  for (const { match, reply } of SCRIPTED) {
    if (match.test(message)) return reply;
  }
  return "Thanks for your message. I can help with balances, sending money, payees and cards — could you tell me a bit more about what you need?";
}

async function claudeReply(
  history: { role: string; content: string }[],
): Promise<string | null> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: history.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      }),
    });
    if (!response.ok) {
      console.error("[chat] Anthropic error", response.status, await response.text());
      return null;
    }
    const data = (await response.json()) as {
      content?: { type: string; text?: string }[];
    };
    return data.content?.map((c) => c.text ?? "").join("").trim() || null;
  } catch (error) {
    console.error("[chat] Anthropic request failed:", error);
    return null;
  }
}

chatRouter.post("/chat/ai", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) {
    return res.status(400).json({ message: "A message is required" });
  }

  // Reuse the session if a valid id was supplied, otherwise start a new one.
  let sessionId: string | undefined =
    typeof req.body?.sessionId === "string" ? req.body.sessionId : undefined;
  if (sessionId) {
    const [row] = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId))
      .limit(1);
    if (!row) sessionId = undefined;
  }
  if (!sessionId) {
    const [row] = await db.insert(chatSessions).values({}).returning();
    sessionId = row.id;
  }

  await db.insert(chatMessages).values({ sessionId, role: "user", content: message });

  const history = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));

  const reply =
    (env.anthropicApiKey && (await claudeReply(history))) ||
    scriptedReply(message);

  await db
    .insert(chatMessages)
    .values({ sessionId, role: "assistant", content: reply });

  return res.json({ reply, sessionId });
});

chatRouter.get("/chat/messages/:sessionId", async (req, res) => {
  const messages = await db
    .select({
      role: chatMessages.role,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, String(req.params.sessionId)))
    .orderBy(asc(chatMessages.createdAt));
  return res.json({ messages });
});
