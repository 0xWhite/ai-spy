import { createClient } from "redis";

type AiSpyRedisClient = ReturnType<typeof createClient>;

declare global {
  var __aiSpyRedisClient: AiSpyRedisClient | undefined;
  var __aiSpyRedisConnectPromise: Promise<AiSpyRedisClient> | undefined;
}

export function isRedisConfigured() {
  return Boolean(process.env.REDIS_URL?.trim()) && process.env.NODE_ENV !== "test";
}

export async function getRedisClient() {
  if (!isRedisConfigured()) {
    throw new Error("REDIS_NOT_CONFIGURED");
  }

  if (globalThis.__aiSpyRedisClient?.isOpen) {
    return globalThis.__aiSpyRedisClient;
  }

  if (!globalThis.__aiSpyRedisConnectPromise) {
    const client = createClient({
      url: process.env.REDIS_URL,
    });

    globalThis.__aiSpyRedisConnectPromise = client
      .connect()
      .then(() => {
        globalThis.__aiSpyRedisClient = client;
        return client;
      })
      .catch((error) => {
        globalThis.__aiSpyRedisConnectPromise = undefined;
        globalThis.__aiSpyRedisClient = undefined;
        throw error;
      });
  }

  return globalThis.__aiSpyRedisConnectPromise;
}
