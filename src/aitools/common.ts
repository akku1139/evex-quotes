// SPDX-License-Identifier: AGPL-3.0-or-later

import { Message, type Client } from 'discord.js';
import type { FromSchema, JSONSchema } from 'json-schema-to-ts';

export const defineAITool = <
  P extends Readonly<JSONSchema>,
  R extends Readonly<JSONSchema>,
  PT = FromSchema<P>,
  RT = FromSchema<R>,
>(
  data: { description: string, parametersJsonSchema: P, responseJsonSchema: R },
  execute: (
    args: PT,
    meta: { client: Client<true>, msg: Message }
  ) => Promise<[true, RT] | [false, { error: string }] | [false]>, // FIXME: returntype is not strict...?
) => ({
  ...data,
  responseJsonSchema: {
    oneOf: [
      data.responseJsonSchema,
      {
        type: 'object',
        properties: {
          error: { type: 'string', description: '関数の実行中にエラーが発生した場合に通知されます'},
        },
        required: ['error'],
      },
    ],
  } as const satisfies JSONSchema,
  execute,
});
