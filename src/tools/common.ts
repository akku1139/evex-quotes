import { type Client } from 'discord.js';
import type { FromSchema, JSONSchema } from 'json-schema-to-ts';

export const defineAITool = <
  N extends string,
  P extends Readonly<JSONSchema>,
  R extends Readonly<JSONSchema>,
  PT = FromSchema<P>,
  RT = FromSchema<R>
>(
  name: N,
  data: { description: string, parametersJsonSchema: P, responseJsonSchema: R },
  execute: (args: PT, client: Client<true>) => Promise<[true, RT] | [true, { error: string }] | [false]>
) => ({
  [name]: {
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
  },
});
