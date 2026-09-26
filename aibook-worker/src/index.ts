// aiBook API — Cloudflare Worker port of the Flask backend.
// Serves the canned /api/titles surface; /media/* is served by Static Assets (wrangler.toml).

import { Hono } from "hono";
import { cors } from "hono/cors";

import { store } from "./store";
import { answerChat, auditProof, visualizePassage } from "./rpg";
import { agentStatus, sendAgentMessage } from "./agents";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

const notFound = { error: "not found" } as const;

function defaultBeat(titleId: string): number {
  return store.title(titleId)?.reader_state?.beat_position?.beat_index ?? 1;
}

// Friendly landing response so the bare origin isn't a bare 404.
app.get("/", (c) =>
  c.json({
    name: "aiBook API",
    status: "ok",
    docs: "This host serves the aiBook JSON API and book media.",
    try: ["/api/health", "/api/titles", "/media/franklin/bible/franklin_portrait.png"],
  }),
);

app.get("/api/health", (c) => c.json({ status: "ok" }));

// ---- Catalog ----
app.get("/api/titles", (c) => c.json(store.titles()));

app.get("/api/titles/:id", (c) => {
  const title = store.title(c.req.param("id"));
  return title ? c.json(title) : c.json(notFound, 404);
});

// ---- Personas (system_prompt / fallback_line stripped) ----
app.get("/api/titles/:id/personas", (c) => {
  const data = store.data(c.req.param("id"));
  if (!data) return c.json(notFound, 404);
  return c.json(
    data.personas.map((p) => ({
      id: p.id,
      label: p.label,
      chip_label: p.chip_label,
      intro_beat: p.intro_beat ?? null,
    })),
  );
});

// ---- Beats ----
app.get("/api/titles/:id/beats", (c) => {
  const data = store.data(c.req.param("id"));
  if (!data) return c.json(notFound, 404);
  return c.json(data.beats);
});

app.get("/api/titles/:id/beat-position", (c) => {
  const title = store.title(c.req.param("id"));
  if (!title?.reader_state) return c.json(notFound, 404);
  return c.json(title.reader_state.beat_position);
});

// Stateless echo: spoiler gating uses the beat_index in each request body, not server state.
app.put("/api/titles/:id/beat-position", async (c) => {
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
  const beatIndex = (body as { beat_index?: unknown }).beat_index;
  if (typeof beatIndex !== "number" || !Number.isInteger(beatIndex)) {
    return c.json({ error: "beat_index (int) is required" }, 400);
  }
  return c.json({ beat_index: beatIndex, label: `Beat ${beatIndex}` });
});

// ---- Chat ----
app.post("/api/titles/:id/chat", async (c) => {
  const id = c.req.param("id");
  const data = store.data(id);
  if (!data) return c.json(notFound, 404);
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>));
  const query = String((body as { query?: unknown }).query ?? "");
  const beatIndex = (body as { beat_index?: unknown }).beat_index;
  const beat = typeof beatIndex === "number" ? beatIndex : defaultBeat(id);
  return c.json(answerChat(id, data, query, beat));
});

// ---- Visualize ----
app.post("/api/titles/:id/visualize", async (c) => {
  const id = c.req.param("id");
  const data = store.data(id);
  if (!data) return c.json(notFound, 404);
  const body = (await c.req.json().catch(() => ({}))) as {
    passage_id?: string;
    target_beat?: number;
    beat_index?: number;
  };
  const beat = typeof body.beat_index === "number" ? body.beat_index : defaultBeat(id);
  return c.json(
    visualizePassage(id, data, beat, body.passage_id ?? null, body.target_beat ?? null),
  );
});

app.get("/api/titles/:id/visual-bible", (c) => {
  const data = store.data(c.req.param("id"));
  if (!data) return c.json(notFound, 404);
  return c.json(data.visual_bible);
});

// ---- Recap quiz ----
app.get("/api/titles/:id/recap-quiz", (c) => {
  const data = store.data(c.req.param("id"));
  if (!data) return c.json(notFound, 404);
  const questions = data.recap_quiz.questions.map((q) => ({
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
  const data = store.data(id);
  if (!data) return c.json(notFound, 404);
  const body = (await c.req.json().catch(() => ({}))) as {
    question_id?: string;
    response?: number | string;
  };
  const question = data.recap_quiz.questions.find((q) => q.id === body.question_id);
  if (!question) return c.json(notFound, 404);

  const correct = question.type === "mcq" ? body.response === question.answer_index : null;

  // Enrich the citation with quote text from the matching beat citation (_enrich_citation).
  let citation: Record<string, unknown> = { ...question.citation };
  const beat = store.beat(id, question.citation.beat_index);
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
app.get("/api/titles/:id/audit", (c) => {
  const data = store.data(c.req.param("id"));
  if (!data) return c.json(notFound, 404);
  return c.json({ entries: [...data.audit_seed].reverse() });
});

app.get("/api/titles/:id/rpg/proof", (c) => {
  const id = c.req.param("id");
  const data = store.data(id);
  if (!data) return c.json(notFound, 404);
  return c.json(auditProof(id, data));
});

// ---- Agents ----
app.post("/api/titles/:id/agents/:agentType/message", async (c) => {
  const id = c.req.param("id");
  const data = store.data(id);
  if (!data) return c.json(notFound, 404);
  const body = (await c.req.json().catch(() => ({}))) as {
    message?: string;
    beat_index?: number;
  };
  const beat = typeof body.beat_index === "number" ? body.beat_index : defaultBeat(id);
  const result = await sendAgentMessage(
    c.env,
    id,
    data,
    c.req.param("agentType"),
    beat,
    String(body.message ?? ""),
  );
  return result ? c.json(result) : c.json(notFound, 404);
});

app.get("/api/agents/status", (c) => c.json(agentStatus(c.env)));

export default app;
