// SPDX-License-Identifier: AGPL-3.0-or-later

import { Mutex } from './mutex.ts';
import fs from 'node:fs/promises';
import type { Snowflake } from 'discord.js';

type PickArrays<T> = {
  [K in keyof T as T[K] extends any[] ? K : never]: T[K];
};
type ArrayElement<A> = A extends readonly (infer E)[] ? E : never;

export const db = await (async () => {
  type DB = {
    aichannels: Array<Snowflake>
  };

  const dbPath = './data.json';

  const lock = new Mutex();

  let data = JSON.parse((await fs.readFile(dbPath)).toString()) as DB;

  // must be used in lock.job
  const sync = async () => await fs.writeFile(dbPath, JSON.stringify(data));

  return {
    async reset() {
      await lock.job(async () => {
        data = {
          aichannels: [],
        };
        await sync();
      });
    },

    async get<P extends keyof DB>(path: P) {
      return await lock.job(async () => {
        return data[path];
      });
    },
    async set<P extends keyof DB>(path: P, newData: DB[P]) {
      return await lock.job(async () => {
        data[path] = newData;
        await sync();
      });
    },

    async inArray<P extends keyof PickArrays<DB>>(path: P, target: ArrayElement<DB[P]>) {
      return await lock.job(async () => {
        return data[path].includes(target);
      });
    },
    async pushArray<P extends keyof PickArrays<DB>>(path: P, newData: ArrayElement<DB[P]>) {
      return await lock.job(async () => {
        const res = data[path].push(newData);
        await sync();
        return res;
      })
    }
  }
})();

