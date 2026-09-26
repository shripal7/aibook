// KV-backed content store. Everything a book needs lives in KV, so adding a book is just
// writing KV keys (no redeploy). Keys:
//   meta:<id>        -> Title metadata JSON (catalog entry; exists for every title incl. locked)
//   book:<id>        -> BookData JSON (beats, chat_qa, visuals, visual_bible, recap_quiz,
//                       personas, opportunities, audit_seed, vault_bytes) — unlocked titles only
//   media:<path>     -> raw image bytes (path is what follows "/media/")

import type {
  AuditEntry,
  Beat,
  ChatQAData,
  OpportunitiesData,
  PersonaConfig,
  RecapQuizData,
  Title,
  VisualBible,
  VisualScene,
} from "./types";

export const SNIPPET_TOKEN_CAP = 60;
export const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

export interface BookData {
  vault_bytes: number;
  beats: Beat[];
  chat_qa: ChatQAData;
  visuals: VisualScene[];
  visual_bible: VisualBible;
  recap_quiz: RecapQuizData;
  personas: PersonaConfig[];
  opportunities: OpportunitiesData | null;
  audit_seed: AuditEntry[];
}

// Small in-isolate cache so a burst of requests doesn't re-read KV; TTL keeps new
// uploads visible within ~60s without a deploy.
const TTL_MS = 60_000;
interface Entry<T> {
  at: number;
  val: T;
}
const memo = new Map<string, Entry<unknown>>();

function getCached<T>(key: string): T | undefined {
  const e = memo.get(key);
  if (e && Date.now() - e.at < TTL_MS) return e.val as T;
  return undefined;
}
function setCached<T>(key: string, val: T): T {
  memo.set(key, { at: Date.now(), val });
  return val;
}

export async function listTitleIds(env: { CONTENT: KVNamespace }): Promise<string[]> {
  const cacheKey = "__ids";
  const cached = getCached<string[]>(cacheKey);
  if (cached) return cached;
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const res = await env.CONTENT.list({ prefix: "meta:", cursor });
    for (const k of res.keys) ids.push(k.name.slice("meta:".length));
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  return setCached(cacheKey, ids);
}

export async function getTitle(
  env: { CONTENT: KVNamespace },
  id: string,
): Promise<Title | null> {
  const key = "meta:" + id;
  const cached = getCached<Title>(key);
  if (cached) return cached;
  const val = (await env.CONTENT.get(key, "json")) as Title | null;
  return val ? setCached(key, val) : null;
}

export async function getTitles(env: { CONTENT: KVNamespace }): Promise<Title[]> {
  const ids = await listTitleIds(env);
  const metas = await Promise.all(ids.map((id) => getTitle(env, id)));
  return metas.filter((t): t is Title => t !== null);
}

export async function getBook(
  env: { CONTENT: KVNamespace },
  id: string,
): Promise<BookData | null> {
  const key = "book:" + id;
  const cached = getCached<BookData>(key);
  if (cached) return cached;
  const val = (await env.CONTENT.get(key, "json")) as BookData | null;
  return val ? setCached(key, val) : null;
}

export async function getMedia(
  env: { CONTENT: KVNamespace },
  path: string,
): Promise<ArrayBuffer | null> {
  return await env.CONTENT.get("media:" + path, "arrayBuffer");
}

export function beatOf(book: BookData, index: number): Beat | undefined {
  return book.beats.find((b) => b.index === index);
}

export function personaOf(book: BookData, id: string): PersonaConfig | undefined {
  return book.personas.find((p) => p.id === id);
}
