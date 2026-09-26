// Live agent personas — Workers AI with a canned fallback, RPG-honest. The system prompt is
// assembled only from the derived layer (beat narration + citation quotes), never raw text.

import { SNIPPET_TOKEN_CAP, WORKERS_AI_MODEL, beatOf, personaOf, type BookData } from "./store";
import { buildAuditEntry } from "./rpg";
import type { AuditEntry, ContextPackage, Env } from "./types";

export const OPPORTUNITY_PERSONA_ID = "opportunity";

export function buildAgentContext(book: BookData, beatIndex: number): string {
  const beat = beatOf(book, beatIndex);
  if (!beat) return "";
  const citationLines = beat.citations.map((c) => `- ${c.quote}`).join("\n");
  return (
    `Current beat: ${beat.title}\n` +
    `Narration: ${beat.narration}\n` +
    `Grounding quotes:\n${citationLines}`
  );
}

async function callWorkersAi(env: Env, systemPrompt: string, userMessage: string): Promise<string | null> {
  try {
    const result = (await env.AI.run(WORKERS_AI_MODEL, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    })) as { response?: string };
    const text = result?.response?.trim();
    return text ? text : null;
  } catch (e) {
    console.error("Workers AI call failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

export interface AgentResult {
  response: string;
  persona: string;
  request_id: string;
  audit_entry: AuditEntry;
}

export async function sendAgentMessage(
  env: Env,
  book: BookData,
  agentType: string,
  beatIndex: number,
  message: string,
): Promise<AgentResult | null> {
  const persona = personaOf(book, agentType);
  if (!persona) return null;

  const context = buildAgentContext(book, beatIndex);
  const systemPrompt = `${persona.system_prompt}\n\nContext:\n${context}`;

  let reply: string;
  let status: string;
  let contextBytes: number;

  if (agentType === OPPORTUNITY_PERSONA_ID) {
    if (book.opportunities === null) {
      reply = persona.fallback_line;
      status = "fallback";
    } else {
      const lines = book.opportunities.items.map(
        (item) => `- ${item.title} (${item.org}): ${item.note} — ${item.link}`,
      );
      reply =
        `(live search unavailable — showing curated list as of ${book.opportunities.as_of})\n` +
        lines.join("\n");
      status = "fallback_snapshot";
    }
    contextBytes = 0;
  } else {
    const rawReply = await callWorkersAi(env, systemPrompt, message);
    status = rawReply !== null ? "ok" : "fallback";
    reply = rawReply !== null ? rawReply : persona.fallback_line;
    contextBytes = new TextEncoder().encode(systemPrompt).length;
  }

  const beat = beatOf(book, beatIndex);
  const passagesRetrieved = beat ? beat.citations.map((c) => c.passage_id) : [];
  const contextPackage: ContextPackage = {
    summaries_used: [],
    graph_nodes_used: [],
    passages_retrieved: passagesRetrieved,
    snippet_tokens_sent: 0,
    snippet_cap: SNIPPET_TOKEN_CAP,
  };
  const audit = buildAuditEntry(book.vault_bytes, `agent:${agentType}`, message, beatIndex, contextPackage, false, {
    contextBytesSentToModel: contextBytes,
    agentCallStatus: status,
  });

  return { response: reply, persona: agentType, request_id: audit.request_id, audit_entry: audit };
}

export function agentStatus(env: Env) {
  return { ollama_reachable: Boolean(env.AI), model: WORKERS_AI_MODEL };
}
