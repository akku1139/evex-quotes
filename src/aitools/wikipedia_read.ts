// SPDX-License-Identifier: AGPL-3.0-or-later

import { DEFAULT_UA } from '../def.ts';
import { defineAITool } from './common.ts';

export default defineAITool(
  {
    description: 'Wikipediaを検索します',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'ページタイトル' },
        // lang: { type: 'string', description: 'Wikipediaの言語' }
      },
      required: ['title'],
    },
    responseJsonSchema: {
      // type: 'object',
      // properties: {
      //   batchcomplete: { type: 'string' },
      //   query: {
      //     type: 'object',
      //     properties: {
      //       pages: {
              type: 'object',
              patternProperties: {
                "^.*$": {
                  type: 'object',
                  properties: {
                    ns: { type: 'number' },
                    title: { type: 'string', description: 'ページタイトル' },
                    pageid: { type: 'number' },
                    extract: { type: 'string', description: 'ページの内容' },
                    timestamp: { type: 'string' },
                  },
                },
              },
            // },
          // },
        // },
      // },
    },
  } as const,
  async ({ title }) => {
    const res = await fetch(
      `https://ja.wikipedia.org/w/api.php?action=query&prop=extracts&titles=${encodeURIComponent(title)}&explaintext=1&format=json`,
      {
        headers: {
          'User-Agent': DEFAULT_UA,
        },
        method: 'GET',
      }
    );

    if(!res.ok) return [false, { error: `HTTPステータスコード: ${res.status} (${res.statusText})` }];
    return [true, (await res.json() as any)['query']['pages'] ];
  },
);

