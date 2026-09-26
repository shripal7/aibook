// Rights-Preserving Grounding core. Pure functions over a book's derived layer — the audit
// entry is computed from exactly what each request assembled, never hardcoded. Stateless: the
// entry is returned to the client, which accumulates the per-session log.

import { SNIPPET_TOKEN_CAP, type BookData } from "./store";
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

function matchQa(book: BookData, query: string): QAEntry | null {
  const tokens = tokenize(query);
  let best: QAEntry | null = null;
  let bestScore = 0;
  for (const entry of book.chat_qa.qa) {
    const score = entry.match_keywords.reduce((acc, kw) => acc + (tokens.has(kw) ? 1 : 0), 0);
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
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function buildAuditEntry(
  vaultBytes: number,
  action: string,
  query: string | null,
  beatIndex: number,
  contextPackage: ContextPackage,
  spoilerGateApplied: boolean,
  opts: { contextBytesSentToModel?: number | null; agentCallStatus?: string | null } = {},
): AuditEntry {
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

export function answerChat(book: BookData, query: string, beatPosition: number): ChatResult {
  const entry = matchQa(book, query);
  const emptyPackage: ContextPackage = {
    summaries_used: [],
    graph_nodes_used: [],
    passages_retrieved: [],
    snippet_tokens_sent: 0,
    snippet_cap: SNIPPET_TOKEN_CAP,
  };

  if (entry === null) {
    const audit = buildAuditEntry(book.vault_bytes, "chat", query, beatPosition, emptyPackage, false);
    return {
      answer: book.chat_qa.fallback.answer,
      citations: [],
      spoiler_gated: false,
      request_id: audit.request_id,
      audit_entry: audit,
    };
  }

  const gated = beatPosition < entry.min_beat_index;
  if (gated) {
    const audit = buildAuditEntry(book.vault_bytes, "chat", query, beatPosition, emptyPackage, true);
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
  const audit = buildAuditEntry(book.vault_bytes, "chat", query, beatPosition, contextPackage, false);
  return {
    answer: entry.answer,
    citations,
    spoiler_gated: false,
    request_id: audit.request_id,
    audit_entry: audit,
  };
}

function findScene(
  book: BookData,
  passageId: string | null,
  targetBeat: number | null,
): VisualScene | null {
  if (passageId) {
    const byPassage = book.visuals.find((s) => s.passage_id === passageId);
    if (byPassage) return byPassage;
  }
  if (targetBeat !== null) {
    const byBeat = book.visuals.find((s) => s.beat_index === targetBeat);
    if (byBeat) return byBeat;
  }
  return book.visuals.length > 0 ? book.visuals[0] : null;
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
  book: BookData,
  beatPosition: number,
  passageId: string | null,
  targetBeat: number | null,
): VisualizeResult {
  const scene = findScene(book, passageId, targetBeat);
  const chars = new Map(book.visual_bible.characters.map((c) => [c.id, c]));
  const settings = new Map(book.visual_bible.settings.map((s) => [s.id, s]));
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
        name: book.visual_bible.style.medium,
        reference_image: book.visual_bible.style.palette_swatch,
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
  const audit = buildAuditEntry(book.vault_bytes, "visualize", null, beatPosition, contextPackage, gated);

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

export function auditProof(book: BookData) {
  const totalRawBytesSent = book.audit_seed.reduce((acc, e) => acc + e.raw_text_bytes_sent_to_model, 0);
  return {
    raw_text_sealed: true,
    total_requests: book.audit_seed.length,
    total_raw_bytes_sent: totalRawBytesSent,
    raw_text_bytes_available_in_vault: book.vault_bytes,
    snippet_cap: SNIPPET_TOKEN_CAP,
  };
}
