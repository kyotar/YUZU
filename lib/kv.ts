import { createClient, type RedisClientType } from "redis";
import type { Post } from "./types";

export type { Post };

const postsKey = (sid: string) => `posts:${sid}`;
const itemKey = (id: string) => `posts:item:${id}`;

declare global {
  // eslint-disable-next-line no-var
  var __yuzuRedis: RedisClientType | undefined;
}

export async function getRedis(): Promise<RedisClientType> {
  return getClient();
}

async function getClient(): Promise<RedisClientType> {
  if (global.__yuzuRedis && global.__yuzuRedis.isOpen) return global.__yuzuRedis;
  const url = process.env.KV_REDIS_URL || process.env.REDIS_URL;
  if (!url) throw new Error("KV_REDIS_URL not set");
  const client: RedisClientType = createClient({ url });
  client.on("error", (e) => console.error("redis error", e));
  await client.connect();
  global.__yuzuRedis = client;
  return client;
}

export async function createPost(p: Post): Promise<void> {
  const r = await getClient();
  await r.hSet(itemKey(p.id), {
    id: p.id,
    text: p.text,
    createdAt: String(p.createdAt),
    emoji: p.emoji,
    blob: JSON.stringify(p.blob),
    sessionId: p.sessionId,
  });
  await r.zAdd(postsKey(p.sessionId), { score: p.createdAt, value: p.id });
}

export async function listPosts(sessionId: string, limit = 50): Promise<Post[]> {
  const r = await getClient();
  const ids = await r.zRange(postsKey(sessionId), 0, limit - 1, { REV: true });
  if (ids.length === 0) return [];

  const results = await Promise.all(
    ids.map(async (id) => {
      const raw = await r.hGetAll(itemKey(id));
      if (!raw || Object.keys(raw).length === 0) return null;
      return {
        id: String(raw.id ?? id),
        text: String(raw.text ?? ""),
        createdAt: Number(raw.createdAt ?? 0),
        emoji: String(raw.emoji ?? "🍑"),
        blob: parseBlob(raw.blob),
        sessionId: String(raw.sessionId ?? sessionId),
      } satisfies Post;
    }),
  );

  return results.filter((p): p is Post => p !== null);
}

function parseBlob(v: unknown): [string, string, string] {
  if (typeof v === "string") {
    try {
      const arr = JSON.parse(v);
      if (Array.isArray(arr) && arr.length === 3) return arr as [string, string, string];
    } catch {}
  }
  return [
    "48% 52% 42% 58% / 49% 64% 36% 51%",
    "52% 48% 58% 42% / 56% 44% 62% 38%",
    "44% 56% 46% 54% / 42% 58% 44% 56%",
  ];
}
