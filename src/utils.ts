// SPDX-License-Identifier: AGPL-3.0-or-later

import process from 'node:process';

export const getEnv = (name: string) => {
  const v = process.env[name];
  if(v === void 0) {
    throw new Error(`Env "${name} is not defined.`);
  } else {
    return v;
  }
}
