// Rights-Preserving Grounding core — faithful port of backend/rpg.py.
//
// Divergence from Flask: there is no process-global audit log (a Worker is stateless).
// buildAuditEntry returns the computed entry; every generative route returns it in the
// response body as `audit_entry`, and the Android client accumulates the log per session.
// The audit is still computed from exactly what each request assembled — never hardcoded.

import { SNIPPET_TOKEN_CAP, store, type TitleData } from "./store";
import type {
  AuditEntry,
  Citation,
  ConditionedOnRef,
  ContextPackage,
  QAEntry,
  VisualScene,
} from "./types";

const WORD_RE = /[a-z']+/g;

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().match(WORD_RE) ?? []);
}

function matchQa(data: TitleData, query: string): QAEntry | null {
  const tokens = tokenize(query);
  let best: QAEntry | null = null;
  let bestScore = 0;
  for (const entry of data.chat_qa.qa) {
    const score = entry.match_keywords.reduce(
      (acc, kw) => acc + (tokens.has(kw) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

function newRequestId(): string {
  return `req-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
}

function now(): string {
  // Matches Python "%Y-%m-%dT%H:%M:%SZ" (seconds precision, trailing Z).
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function buildAuditEntry(
  titleId: string,
  action: string,
  query: string | null,
  beatIndex: number,
  contextPackage: ContextPackage,
  spoilerGateApplied: boolean,
  opts: {
    contextBytesSentToModel?: number | null;
    agentCallStatus?: string | null;
  } = {},
): AuditEntry {
  const title = store.title(titleId);
  const vaultBytes = title?.rights ? title.rights.vault_bytes : 0;
  return {
    ts: now(),
    request_id: newRequestId(),
    action,
    query,
    beat_index: beatIndex,
    context_package: contextPackage,
    raw_full_text_sent: false,
    raw_text_bytes_available_in_vault: vaultBytes,
    raw_text_bytes_sent_to_model: 0,
    spoiler_gate: { applied: spoilerGateApplied },
    context_bytes_sent_to_model: opts.contextBytesSentToModel ?? null,
    agent_call_status: opts.agentCallStatus ?? null,
  };
}

export interface ChatResult {
  answer: string;
  citations: Citation[];
  spoiler_gated: boolean;
  request_id: string;
  audit_entry: AuditEntry;
}

export function answerChat(
  titleId: string,
  data: TitleData,
  query: string,
  beatPosition: number,
): ChatResult {
  const entry = matchQa(data, query);

  const emptyPackage: ContextPackage = {
    summaries_used: [],
    graph_nodes_used: [],
    passages_retrieved: [],
    snippet_tokens_sent: 0,
    snippet_cap: SNIPPET_TOKEN_CAP,
  };

  if (entry === null) {
    const audit = buildAuditEntry(titleId, "chat", query, beatPosition, emptyPackage, false);
    return {
      answer: data.chat_qa.fallback.answer,
      citations: [],
      spoiler_gated: false,
      request_id: audit.request_id,
      audit_entry: audit,
    };
  }

  const gated = beatPosition < entry.min_beat_index;
  if (gated) {
    const audit = buildAuditEntry(titleId, "chat", query, beatPosition, emptyPackage, true);
    return {
      answer:
        `That's beyond where you've read (currently beat ${beatPosition}). ` +
        "I can revisit this once you reach that point in the book.",
      citations: [],
      spoiler_gated: true,
      request_id: audit.request_id,
      audit_entry: audit,
    };
  }

  const summariesUsed = entry.supporting_layer.filter((s) => s.startsWith("sum-"));
  const graphNodesUsed = entry.supporting_layer.filter((s) => !s.startsWith("sum-"));
  const citations = entry.citations;
  const contextPackage: ContextPackage = {
    summaries_used: summariesUsed,
    graph_nodes_used: graphNodesUsed,
    passages_retrieved: citations.map((c) => c.passage_id),
    snippet_tokens_sent: citations.reduce((acc, c) => acc + c.quote_token_len, 0),
    snippet_cap: SNIPPET_TOKEN_CAP,
  };
  const audit = buildAuditEntry(titleId, "chat", query, beatPosition, contextPackage, false);
  return {
    answer: entry.answer,
    citations,
    spoiler_gated: false,
    request_id: audit.request_id,
    audit_entry: audit,
  };
}

function findScene(
  data: TitleData,
  passageId: string | null,
  targetBeat: number | null,
): VisualScene | null {
  if (passageId) {
    const byPassage = data.visuals.find((s) => s.passage_id === passageId);
    if (byPassage) return byPassage;
  }
  if (targetBeat !== null) {
    const byBeat = data.visuals.find((s) => s.beat_index === targetBeat);
    if (byBeat) return byBeat;
  }
  return data.visuals.length > 0 ? data.visuals[0] : null;
}

export interface VisualizeResult {
  image: string | null;
  prompt_shown: string | null;
  caption: string | null;
  conditioned_on: ConditionedOnRef[];
  spoiler_gated: boolean;
  request_id: string;
  audit_entry: AuditEntry;
}

export function visualizePassage(
  titleId: string,
  data: TitleData,
  beatPosition: number,
  passageId: string | null,
  targetBeat: number | null,
): VisualizeResult {
  const scene = findScene(data, passageId, targetBeat);

  const chars = new Map(data.visual_bible.characters.map((c) => [c.id, c]));
  const settings = new Map(data.visual_bible.settings.map((s) => [s.id, s]));
  const conditionedOn: ConditionedOnRef[] = [];
  for (const ref of scene ? scene.conditioned_on : []) {
    if (chars.has(ref)) {
      const c = chars.get(ref)!;
      conditionedOn.push({ id: c.id, kind: "character", name: c.name, reference_image: c.reference_image });
    } else if (settings.has(ref)) {
      const s = settings.get(ref)!;
      conditionedOn.push({ id: s.id, kind: "setting", name: s.name, reference_image: s.reference_image });
    } else if (ref === "style") {
      conditionedOn.push({
        id: "style",
        kind: "style",
        name: data.visual_bible.style.medium,
        reference_image: data.visual_bible.style.palette_swatch,
      });
    }
  }

  const sceneBeat = scene ? scene.beat_index : targetBeat ?? beatPosition;
  const gated = sceneBeat > beatPosition;

  const graphNodesUsed = (scene ? scene.conditioned_on : []).filter((ref) => ref !== "style");
  const contextPackage: ContextPackage = {
    summaries_used: [],
    graph_nodes_used: graphNodesUsed,
    passages_retrieved: scene ? [scene.passage_id] : [],
    snippet_tokens_sent: 0,
    snippet_cap: SNIPPET_TOKEN_CAP,
  };
  const audit = buildAuditEntry(titleId, "visualize", null, beatPosition, contextPackage, gated);

  return {
    image: scene ? scene.image : null,
    prompt_shown: scene ? scene.prompt_shown : null,
    caption: scene ? scene.caption : null,
    conditioned_on: conditionedOn,
    spoiler_gated: gated,
    request_id: audit.request_id,
    audit_entry: audit,
  };
}

export function auditProof(titleId: string, data: TitleData) {
  const title = store.title(titleId);
  const totalRawBytesSent = data.audit_seed.reduce(
    (acc, e) => acc + e.raw_text_bytes_sent_to_model,
    0,
  );
  const vaultBytes = title?.rights ? title.rights.vault_bytes : 0;
  return {
    raw_text_sealed: true,
    total_requests: data.audit_seed.length,
    total_raw_bytes_sent: totalRawBytesSent,
    raw_text_bytes_available_in_vault: vaultBytes,
    snippet_cap: SNIPPET_TOKEN_CAP,
  };
}
