// Reading analytics. Two sinks:
//  1) Workers Analytics Engine (env.AE) — precise, high-cardinality events queryable in
//     Cloudflare (dashboard / SQL API): event, book, beat, and the request signals below.
//  2) KV counters under the "stat:" prefix — approximate aggregates powering GET /api/stats,
//     viewable instantly with no API token.
//
// "Who" is anonymous — there is no login. We record coarse, IP-derived signals that Cloudflare
// provides (country, region, city, continent, timezone, ISP/ASN, colo), the browser language,
// device class, and a DAILY-ROTATING visitor hash for rough unique counts. We never store the
// raw IP address or other personal data.

import type { Context } from "hono";
import type { Env } from "./types";

export type ReadEvent = "open" | "beat" | "chat" | "visualize" | "agent" | "quiz";

interface Signals {
  country: string;
  region: string;
  city: string;
  continent: string;
  timezone: string;
  isp: string;
  asn: number;
  colo: string;
  httpProtocol: string;
  lang: string;
  device: string;
  visitor: string; // daily-rotating, non-reversible-ish hash of IP+date
}

// Tiny non-cryptographic hash (FNV-1a) — enough to bucket a visitor for the day without
// storing the IP. Rotated daily so it cannot be correlated across days.
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function deviceClass(ua: string): string {
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobile|iphone|android/.test(s)) return "mobile";
  if (/okhttp|cfnetwork|dart|python|curl|go-http/.test(s)) return "app/api";
  if (s) return "desktop";
  return "unknown";
}

function signals(c: Context<{ Bindings: Env }>): Signals {
  const cf = (c.req.raw as unknown as { cf?: Record<string, unknown> }).cf ?? {};
  const ua = c.req.header("user-agent") ?? "";
  const ip = c.req.header("cf-connecting-ip") ?? "";
  const day = new Date().toISOString().slice(0, 10);
  const langRaw = c.req.header("accept-language") ?? "";
  return {
    country: String(cf.country ?? ""),
    region: String(cf.region ?? cf.regionCode ?? ""),
    city: String(cf.city ?? ""),
    continent: String(cf.continent ?? ""),
    timezone: String(cf.timezone ?? ""),
    isp: String(cf.asOrganization ?? ""),
    asn: Number(cf.asn ?? 0) || 0,
    colo: String(cf.colo ?? ""),
    httpProtocol: String(cf.httpProtocol ?? ""),
    lang: (langRaw.split(",")[0] || "").trim(),
    device: deviceClass(ua),
    visitor: ip ? fnv1a(ip + "|" + day) : "",
  };
}

function bumpPromise(env: Env, key: string): Promise<void> {
  return (async () => {
    const full = "stat:" + key;
    const cur = parseInt((await env.CONTENT.get(full)) ?? "0", 10) || 0;
    await env.CONTENT.put(full, String(cur + 1));
  })();
}

export function track(
  c: Context<{ Bindings: Env }>,
  event: ReadEvent,
  bookId: string,
  beatIndex?: number,
): void {
  const env = c.env;
  const s = signals(c);
  const ua = (c.req.header("user-agent") ?? "").slice(0, 200);

  // KV counters (approximate) — done after the response via waitUntil.
  const ps: Promise<void>[] = [bumpPromise(env, `${bookId}:${event}`)];
  if (event === "beat" && typeof beatIndex === "number") ps.push(bumpPromise(env, `${bookId}:beat:${beatIndex}`));
  if (s.country) ps.push(bumpPromise(env, `${bookId}:country:${s.country}`));
  if (s.region) ps.push(bumpPromise(env, `${bookId}:region:${s.region}`));
  if (s.device) ps.push(bumpPromise(env, `${bookId}:device:${s.device}`));
  c.executionCtx.waitUntil(Promise.all(ps));

  // Analytics Engine (precise, rich) — best-effort; only active if the AE binding exists.
  try {
    env.AE?.writeDataPoint({
      indexes: [bookId],
      blobs: [
        event, bookId, s.country, s.region, s.city, s.continent, s.timezone,
        s.isp, s.colo, s.httpProtocol, s.lang, s.device, s.visitor, ua,
        typeof beatIndex === "number" ? String(beatIndex) : "",
      ],
      doubles: [typeof beatIndex === "number" ? beatIndex : 0, s.asn],
    });
  } catch {
    // analytics must never break a request
  }
}

interface BookStats {
  open: number; beat: number; chat: number; visualize: number; agent: number; quiz: number;
  beats: Record<string, number>;
  countries: Record<string, number>;
  regions: Record<string, number>;
  devices: Record<string, number>;
}

function emptyBook(): BookStats {
  return { open: 0, beat: 0, chat: 0, visualize: 0, agent: 0, quiz: 0,
           beats: {}, countries: {}, regions: {}, devices: {} };
}

/** Aggregate the "stat:" KV counters into a readable summary for GET /api/stats. */
export async function readStats(env: Env): Promise<Record<string, unknown>> {
  const books: Record<string, BookStats> = {};
  let cursor: string | undefined;
  do {
    const res = await env.CONTENT.list({ prefix: "stat:", cursor });
    for (const k of res.keys) {
      const parts = k.name.slice("stat:".length).split(":"); // <book>:<action>[:<extra>]
      const bookId = parts[0];
      const action = parts[1];
      const extra = parts[2];
      const count = parseInt((await env.CONTENT.get(k.name)) ?? "0", 10) || 0;
      const b = (books[bookId] ??= emptyBook());
      if (action === "beat" && extra !== undefined) b.beats[extra] = count;
      else if (action === "country" && extra !== undefined) b.countries[extra] = count;
      else if (action === "region" && extra !== undefined) b.regions[extra] = count;
      else if (action === "device" && extra !== undefined) b.devices[extra] = count;
      else if (action === "beat") b.beat = count;
      else if (action in b) (b as unknown as Record<string, number>)[action] = count;
    }
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  return { generated_at: new Date().toISOString(), books };
}
