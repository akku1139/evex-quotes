// SPDX-License-Identifier: AGPL-3.0-or-later
import { Logger } from "./logger.ts";

export class RateLimiter<
  K extends string,
  T extends Record<K, number>,
> {
  #logger: Logger;
  #limits: T;
  #windowSeconds: number;
  #rateLimitStore: Map<string, number> = new Map();

  constructor(name: string, initialLimits: T, windowSeconds: number) {
    this.#logger = new Logger(`ratelimiter: ${name}`);
    this.#limits = initialLimits;
    this.#windowSeconds = windowSeconds;

    const baseInterval = windowSeconds * 1000;
    const minInterval = baseInterval * 0.6;
    const maxInterval = baseInterval * 0.9;

    const cleanupInterval = Math.floor(minInterval + (maxInterval - minInterval) * Math.random());

    setInterval(() => this.cleanupExpiredWindows(), cleanupInterval);

    this.#logger.info(`init done: { windowsize: ${this.#windowSeconds} sec, cleanupInterval: ${cleanupInterval/1000} sec }`);
  }

  #getCurrentWindowID(): number {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return Math.floor(nowInSeconds / this.#windowSeconds);
  }

  #createRateLimitKey(userID: string, resourceID: K): string {
    const windowID = this.#getCurrentWindowID();
    return `${encodeURIComponent(userID)}:${encodeURIComponent(resourceID)}:${windowID}`;
  }

  checkRateLimited(userID: string, resourceID: K): [false] | [true, number] {
    const limit = this.#limits[resourceID];

    const key = this.#createRateLimitKey(userID, resourceID);

    const currentCount = this.#rateLimitStore.get(key) ?? 0;
    const newCount = currentCount + 1;

    this.#rateLimitStore.set(key, newCount);

    if (newCount > limit) {
      this.#logger.warn(`rate limited: { userID: ${userID}, resource: ${resourceID}, count: ${newCount}/${limit} }`);

      const currentWindowId = this.#getCurrentWindowID();
      const currentTimestampSeconds = Math.floor(Date.now() / 1000);

      const windowEndTimestamp = (currentWindowId + 1) * this.#windowSeconds;

      const retryAfter = windowEndTimestamp - currentTimestampSeconds;

      return [true, retryAfter];
    }

    return [false];
  }

  cleanupExpiredWindows(): void {
    const currentWindowID = this.#getCurrentWindowID();

    const cutoffID = currentWindowID - 1;

    let deletedCount = 0;

    for (const key of this.#rateLimitStore.keys()) {
      const parts = key.split(':');
      const keyWindowID = Number(parts[2]);

      if (!isNaN(keyWindowID) && keyWindowID < cutoffID) {
        this.#rateLimitStore.delete(key);
        deletedCount++;
      }
    }
  }
}
