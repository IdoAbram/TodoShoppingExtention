import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Redis } from "@upstash/redis";

/**
 * The small key-value surface the app needs. Backed by Upstash Redis, with an
 * in-memory fallback so `npm run dev` works before Redis is configured.
 */
export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  hgetMany(hash: string, fields: string[]): Promise<(string | null)[]>;
  hsetMany(hash: string, values: Record<string, string>): Promise<void>;
}

function upstashKV(url: string, token: string): KV {
  const redis = new Redis({ url, token, automaticDeserialization: false });
  return {
    async get(key) {
      return (await redis.get<string>(key)) ?? null;
    },
    async set(key, value, ttlSeconds) {
      if (ttlSeconds) await redis.set(key, value, { ex: ttlSeconds });
      else await redis.set(key, value);
    },
    async del(key) {
      await redis.del(key);
    },
    async hgetMany(hash, fields) {
      if (fields.length === 0) return [];
      const res = (await redis.hmget<Record<string, string | null>>(hash, ...fields)) ?? {};
      return fields.map((f) => {
        const v = res[f];
        return v === undefined || v === null ? null : String(v);
      });
    },
    async hsetMany(hash, values) {
      if (Object.keys(values).length === 0) return;
      await redis.hset(hash, values);
    },
  };
}

type MemoryState = {
  strings: Map<string, { value: string; expires?: number }>;
  hashes: Map<string, Map<string, string>>;
};

function memoryKV(state: MemoryState = { strings: new Map(), hashes: new Map() }, onChange?: () => void): KV {
  const { strings, hashes } = state;
  return {
    async get(key) {
      const e = strings.get(key);
      if (!e) return null;
      if (e.expires && e.expires < Date.now()) {
        strings.delete(key);
        return null;
      }
      return e.value;
    },
    async set(key, value, ttlSeconds) {
      strings.set(key, { value, expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined });
      onChange?.();
    },
    async del(key) {
      strings.delete(key);
      hashes.delete(key);
      onChange?.();
    },
    async hgetMany(hash, fields) {
      const h = hashes.get(hash);
      return fields.map((f) => h?.get(f) ?? null);
    },
    async hsetMany(hash, values) {
      let h = hashes.get(hash);
      if (!h) hashes.set(hash, (h = new Map()));
      for (const [k, v] of Object.entries(values)) h.set(k, v);
      onChange?.();
    },
  };
}

/** Local development without Redis: the memory store, saved to a JSON file so it survives restarts. */
const LOCAL_FILE = ".data/kv.json";

function fileKV(path: string): KV {
  const state: MemoryState = { strings: new Map(), hashes: new Map() };
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      strings: [string, { value: string; expires?: number }][];
      hashes: [string, [string, string][]][];
    };
    for (const [k, v] of raw.strings) state.strings.set(k, v);
    for (const [k, entries] of raw.hashes) state.hashes.set(k, new Map(entries));
  } catch {
    /* first run */
  }
  let timer: ReturnType<typeof setTimeout> | null = null;
  const persist = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(
        path,
        JSON.stringify({
          strings: [...state.strings],
          hashes: [...state.hashes].map(([k, h]) => [k, [...h]]),
        }),
      );
    }, 200);
  };
  return memoryKV(state, persist);
}

// Survive Next.js dev hot reloads.
const globalForKV = globalThis as unknown as { __kv?: KV };

export function getKV(): KV {
  if (globalForKV.__kv) return globalForKV.__kv;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (url && token) {
    globalForKV.__kv = upstashKV(url, token);
  } else if (process.env.VERCEL) {
    throw new Error(
      "Redis is not configured: add Upstash Redis to the Vercel project (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).",
    );
  } else {
    console.warn(`[kv] No Upstash Redis env vars — using local file storage (${LOCAL_FILE}).`);
    globalForKV.__kv = fileKV(LOCAL_FILE);
  }
  return globalForKV.__kv;
}

/** For tests. */
export function setKVForTesting(kv: KV | undefined) {
  globalForKV.__kv = kv;
}

export { memoryKV };
