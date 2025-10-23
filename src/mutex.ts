// SPDX-License-Identifier: AGPL-3.0-or-later

type Resolver = () => void;

// TODO: avoid deadlock
export class Mutex {
  readonly #queue: Array<Resolver> = [];

  constructor() {
  }

  async job<T>(callback: () => Promise<T>): Promise<T> {
    const p = new Promise<void>(r => this.#queue.push(r));
    if(this.#queue.length > 1) {
      await p;
    }

    try {
      return await callback();
    } catch(err) {
      throw err;
    } finally {
      this.#queue.shift();
      this.#queue[0]?.();
    }
  }
}
