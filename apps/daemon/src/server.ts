import Fastify from "fastify";
import { handleMessage } from "./handler.js";
import { startWhatsApp } from "./whatsapp.js";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true }));

app.post<{ Body: { text?: string } }>("/message", async (req, reply) => {
  const text = req.body?.text;
  if (!text) return reply.code(400).send({ error: "text is required" });
  return { reply: await handleMessage(text) };
});

await app.listen({ host: "127.0.0.1", port: 3001 });
startWhatsApp().catch((err) => app.log.error(err));
