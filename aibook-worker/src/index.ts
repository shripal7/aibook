// aiBook API — Cloudflare Worker. All book content (metadata, per-book data, media) is read
// from KV at request time, so adding a book needs no redeploy.

import { Hono } from "hono";
import { cors } from "hono/cors";

import { getBook, getMedia, getTitle, getTitles } from "./store";
import { answerChat, auditProof, visualizePassage } from "./rpg";
import { agentStatus, sendAgentMessage } from "./agents";
import { readStats, track } from "./analytics";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

const notFound = { error: "not found" } as const;

function defaultBeat(title: { reader_state?: { beat_position?: { beat_index: number } } | null } | null): number {
  return title?.reader_state?.beat_position?.beat_index ?? 1;
}

app.get("/", (c) =>
  c.json({
    name: "aiBook API",
    status: "ok",
    docs: "This host serves the aiBook JSON API and book media (all read from KV).",
    try: ["/api/health", "/api/titles", "/media/franklin/bible/franklin_portrait.png"],
  }),
);

app.get("/api/health", (c) => c.json({ status: "ok" }));

// ---- Catalog ----
app.get("/api/titles", async (c) => c.json(await getTitles(c.env)));

app.get("/api/titles/:id", async (c) => {
  const title = await getTitle(c.env, c.req.param("id"));
  return title ? c.json(title) : c.json(notFound, 404);
});

// ---- Personas (system_prompt / fallback_line stripped) ----
app.get("/api/titles/:id/personas", async (c) => {
  const book = await getBook(c.env, c.req.param("id"));
  if (!book) return c.json(notFound, 404);
  return c.json(
    book.personas.map((p) => ({
      id: p.id,
      label: p.label,
      chip_label: p.chip_label,
      intro_beat: p.intro_beat ?? null,
    })),
  );
});

// ---- Beats ----
app.get("/api/titles/:id/beats", async (c) => {
  const id = c.req.param("id");
  const book = await getBook(c.env, id);
  if (!book) return c.json(notFound, 404);
  track(c, "open", id); // opening a book fetches its beats
  return c.json(book.beats);
});

app.get("/api/titles/:id/beat-position", async (c) => {
  const title = await getTitle(c.env, c.req.param("id"));
  if (!title?.reader_state) return c.json(notFound, 404);
  return c.json(title.reader_state.beat_position);
});

// Stateless echo: spoiler gating uses the beat_index in each request body, not server state.
app.put("/api/titles/:id/beat-position", async (c) => {
  const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
  const beatIndex = (body as { beat_index?: unknown }).beat_index;
  if (typeof beatIndex !== "number" || !Number.isInteger(beatIndex)) {
    return c.json({ error: "beat_index (int) is required" }, 400);
  }
  track(c, "beat", c.req.param("id"), beatIndex); // which page/beat is being read
  return c.json({ beat_index: beatIndex, label: `Beat ${beatIndex}` });
});

// ---- Chat ----
app.post("/api/titles/:id/chat", async (c) => {
  const id = c.req.param("id");
  const book = await getBook(c.env, id);
  if (!book) return c.json(notFound, 404);
  const body = await c.req.json().catch(() => ({}) as Record<string, unknown>);
  const query = String((body as { query?: unknown }).query ?? "");
  const beatIndex = (body as { beat_index?: unknown }).beat_index;
  const beat = typeof beatIndex === "number" ? beatIndex : defaultBeat(await getTitle(c.env, id));
  track(c, "chat", id, beat);
  return c.json(answerChat(book, query, beat));
});

// ---- Visualize ----
app.post("/api/titles/:id/visualize", async (c) => {
  const id = c.req.param("id");
  const book = await getBook(c.env, id);
  if (!book) return c.json(notFound, 404);
  const body = (await c.req.json().catch(() => ({}))) as {
    passage_id?: string;
    target_beat?: number;
    beat_index?: number;
  };
  const beat = typeof body.beat_index === "number" ? body.beat_index : defaultBeat(await getTitle(c.env, id));
  track(c, "visualize", id, beat);
  return c.json(visualizePassage(book, beat, body.passage_id ?? null, body.target_beat ?? null));
});

app.get("/api/titles/:id/visual-bible", async (c) => {
  const book = await getBook(c.env, c.req.param("id"));
  if (!book) return c.json(notFound, 404);
  return c.json(book.visual_bible);
});

// ---- Recap quiz ----
app.get("/api/titles/:id/recap-quiz", async (c) => {
  const id = c.req.param("id");
  const book = await getBook(c.env, id);
  if (!book) return c.json(notFound, 404);
  track(c, "quiz", id);
  const questions = book.recap_quiz.questions.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    choices: q.choices,
    citation: q.citation,
  }));
  return c.json({ questions });
});

app.post("/api/titles/:id/recap-quiz/grade", async (c) => {
  const id = c.req.param("id");
  const book = await getBook(c.env, id);
  if (!book) return c.json(notFound, 404);
  const body = (await c.req.json().catch(() => ({}))) as {
    question_id?: string;
    response?: number | string;
  };
  const question = book.recap_quiz.questions.find((q) => q.id === body.question_id);
  if (!question) return c.json(notFound, 404);

  const correct = question.type === "mcq" ? body.response === question.answer_index : null;

  let citation: Record<string, unknown> = { ...question.citation };
  const beat = book.beats.find((b) => b.index === question.citation.beat_index);
  const match = beat?.citations.find((cc) => cc.passage_id === question.citation.passage_id);
  if (match) {
    citation = {
      ...citation,
      quote: match.quote,
      quote_token_len: match.quote_token_len,
      full_passage_text: match.full_passage_text,
    };
  }

  return c.json({
    correct,
    rationale: question.rationale,
    citation,
    model_answer: question.model_answer,
    answer_index: question.answer_index,
  });
});

// ---- Audit (seed-based; the live log accumulates client-side) ----
app.get("/api/titles/:id/audit", async (c) => {
  const book = await getBook(c.env, c.req.param("id"));
  if (!book) return c.json(notFound, 404);
  return c.json({ entries: [...book.audit_seed].reverse() });
});

app.get("/api/titles/:id/rpg/proof", async (c) => {
  const book = await getBook(c.env, c.req.param("id"));
  if (!book) return c.json(notFound, 404);
  return c.json(auditProof(book));
});

// ---- Agents ----
app.post("/api/titles/:id/agents/:agentType/message", async (c) => {
  const id = c.req.param("id");
  const book = await getBook(c.env, id);
  if (!book) return c.json(notFound, 404);
  const body = (await c.req.json().catch(() => ({}))) as { message?: string; beat_index?: number };
  const beat = typeof body.beat_index === "number" ? body.beat_index : defaultBeat(await getTitle(c.env, id));
  const result = await sendAgentMessage(c.env, book, c.req.param("agentType"), beat, String(body.message ?? ""));
  if (result) track(c, "agent", id, beat);
  return result ? c.json(result) : c.json(notFound, 404);
});

app.get("/api/agents/status", (c) => c.json(agentStatus(c.env)));

// ---- Reading analytics (aggregate; anonymous) ----
app.get("/api/stats", async (c) => c.json(await readStats(c.env)));

// ---- Media (served from KV) ----
const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

app.get("/media/*", async (c) => {
  const path = c.req.path.slice("/media/".length);
  const bytes = await getMedia(c.env, path);
  if (!bytes) return c.json(notFound, 404);
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return c.body(bytes, 200, {
    "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
    "Cache-Control": "public, max-age=3600",
  });
});

export default app;
