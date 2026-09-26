// Live agent personas — port of backend/agents.py, RPG-honest.
//
// Ollama is replaced by Cloudflare Workers AI. The system prompt is still assembled only
// from the derived layer (beat narration + citation quotes), never raw text, so the audit
// guarantee holds. On any AI error we fall back to persona.fallback_line, mirroring the
// call_ollama None-on-error contract. The "opportunity" persona serves the canned snapshot.

import { SNIPPET_TOKEN_CAP, WORKERS_AI_MODEL, store, type TitleData } from "./store";
import { buildAuditEntry } from "./rpg";
import type { AuditEntry, ContextPackage, Env, PersonaConfig } from "./types";

export const OPPORTUNITY_PERSONA_ID = "opportunity";

export function buildAgentContext(titleId: string, beatIndex: number): string {
  const beat = store.beat(titleId, beatIndex);
  if (!beat) return "";
  const citationLines = beat.citations.map((c) => `- ${c.quote}`).join("\n");
  return (
    `Current beat: ${beat.title}\n` +
    `Narration: ${beat.narration}\n` +
    `Grounding quotes:\n${citationLines}`
  );
}

async function callWorkersAi(
  env: Env,
  systemPrompt: string,
  userMessage: string,
): Promise<string | null> {
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

function fetchOpportunities(data: TitleData, persona: PersonaConfig): [string, string] {
  // No live search on Workers — always serve the curated snapshot (or fallback line).
  if (data.opportunities === null) {
    return [persona.fallback_line, "fallback"];
  }
  const lines = data.opportunities.items.map(
    (item) => `- ${item.title} (${item.org}): ${item.note} — ${item.link}`,
  );
  const reply =
    `(live search unavailable — showing curated list as of ${data.opportunities.as_of})\n` +
    lines.join("\n");
  return [reply, "fallback_snapshot"];
}

export interface AgentResult {
  response: string;
  persona: string;
  request_id: string;
  audit_entry: AuditEntry;
}

export async function sendAgentMessage(
  env: Env,
  titleId: string,
  data: TitleData,
  agentType: string,
  beatIndex: number,
  message: string,
): Promise<AgentResult | null> {
  const persona = store.persona(titleId, agentType);
  if (!persona) return null;

  const context = buildAgentContext(titleId, beatIndex);
  const systemPrompt = `${persona.system_prompt}\n\nContext:\n${context}`;

  let reply: string;
  let status: string;
  let contextBytes: number;

  if (agentType === OPPORTUNITY_PERSONA_ID) {
    [reply, status] = fetchOpportunities(data, persona);
    contextBytes = 0;
  } else {
    const rawReply = await callWorkersAi(env, systemPrompt, message);
    status = rawReply !== null ? "ok" : "fallback";
    reply = rawReply !== null ? rawReply : persona.fallback_line;
    contextBytes = new TextEncoder().encode(systemPrompt).length;
  }

  const beat = store.beat(titleId, beatIndex);
  const passagesRetrieved = beat ? beat.citations.map((c) => c.passage_id) : [];
  const contextPackage: ContextPackage = {
    summaries_used: [],
    graph_nodes_used: [],
    passages_retrieved: passagesRetrieved,
    snippet_tokens_sent: 0,
    snippet_cap: SNIPPET_TOKEN_CAP,
  };
  const audit = buildAuditEntry(titleId, `agent:${agentType}`, message, beatIndex, contextPackage, false, {
    contextBytesSentToModel: contextBytes,
    agentCallStatus: status,
  });

  return { response: reply, persona: agentType, request_id: audit.request_id, audit_entry: audit };
}

export function agentStatus(env: Env) {
  return { ollama_reachable: Boolean(env.AI), model: WORKERS_AI_MODEL };
}
