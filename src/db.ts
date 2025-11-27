// SPDX-License-Identifier: AGPL-3.0-or-later

import { Mutex } from './mutex.ts';
import fs from 'node:fs/promises';
import type { Snowflake } from 'discord.js';

type PickArrays<T> = {
  [K in keyof T as T[K] extends any[] ? K : never]: T[K];
};
type ArrayElement<A> = A extends readonly (infer E)[] ? E : never;

export const openDB = async <DB extends object>(dbName: string, init: DB) => {
  const dbPath = `./data/${dbName}.json`;

  const lock = new Mutex();

  let data = JSON.parse((await fs.readFile(dbPath)).toString()) as DB;

  // must be used in lock.job
  const sync = async () => await fs.writeFile(dbPath, JSON.stringify(data));

  return {
    async reset() {
      await lock.job(async () => {
        data = init;
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
        return (data[path] as Array<any>).includes(target); // 型の敗北
      });
    },
    async pushArray<P extends keyof PickArrays<DB>>(path: P, newData: ArrayElement<DB[P]>) {
      return await lock.job(async () => {
        const res = (data[path] as Array<any>).push(newData);
        await sync();
        return res;
      })
    }
  }
};

export const db = await openDB<{
  aichannels: Array<Snowflake>,
  aimainmemory: string,
}>('data', {
  aichannels: [],
  aimainmemory: '',
});

export const aiMemory = await openDB('aimemory', {});
