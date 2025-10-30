// SPDX-License-Identifier: AGPL-3.0-or-later

import { DEFAULT_UA } from '../def.ts';
import { defineAITool } from './common.ts';

export default defineAITool(
  {
    description: 'Wikipediaを検索します',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '検索クエリ' },
        // lang: { type: 'string', description: 'Wikipediaの言語' }
      },
      required: ['query'],
    },
    responseJsonSchema: {
      // type: 'object',
      // properties: {
      //   batchcomplete: { type: 'string' },
      //   continue: {
      //     type: 'object',
      //     properties: {
      //       sroffset: { type: 'number' },
      //       continue: { type: 'string' },
      //     },
      //   },
      //   query: {
          type: 'object',
          properties: {
            searchinfo: {
              type: 'object',
              properties: { totalhits: { type: 'number' } },
            },
            search: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ns: { type: 'number' },
                  title: { type: 'string', description: '得られた記事のタイトル' },
                  pageid: { type: 'number' },
                  size: { type: 'number' },
                  wordcount: { type: 'number' },
                  snippet: { type: 'string', description: '記事の要約' },
                  timestamp: { type: 'string' },
                },
              },
            },

        // },
      },
    },
  } as const,
  async ({ query }) => {
    const res = await fetch(
      `https://ja.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json`,
      {
        headers: {
          'User-Agent': DEFAULT_UA,
        },
        method: 'GET',
      }
    );

    if(!res.ok) return [false, { error: `HTTPステータスコード: ${res.status} (${res.statusText})` }];
    return [true, (await res.json() as any)['query'] ];
  },
);

