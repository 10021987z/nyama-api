import { Injectable } from '@nestjs/common';

// TODO: remplacer par ioredis en production
interface CacheEntry {
  value: string;
  expiresAt: number;
}

@Injectable()
export class RedisService {
  private readonly store = new Map<string, CacheEntry>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const current = await this.get(key);
    const newValue = (current ? parseInt(current, 10) : 0) + 1;
    await this.set(key, String(newValue), ttlSeconds ?? 900);
    return newValue;
  }
}
