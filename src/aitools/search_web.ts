// SPDX-License-Identifier: AGPL-3.0-or-later

import { DEFAULT_UA } from '../def.ts';
import { defineAITool } from './common.ts';
import { getEnv } from '../utils.ts';

const SEARCH_ENDPOINT = new URL(getEnv('SEARCH_ENDPOINT')).toString();

export default defineAITool(
  {
    description: 'Readability.jsを使ってWebサイトを閲覧します。',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '検索クエリ (スペース区切り、Google検索と同じ構文が使用可能)' },
      },
      required: ['query'],
    } as const,
    responseJsonSchema: {
      type: 'object',
      properties: {
        response: {
          type: 'array',
          description: '検索レスポンス',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'ページタイトル' },
              summary: { type: 'string', description: 'ページの概要' },
              link: { type: 'string', description: 'ページのURL' },
            },
            required: ['title', 'summary', 'link'],
          }
        },
      },
      required: ['response'],
    } as const,
  },
  async ({ query }) => {
    const res = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`, {
      headers: {
          'User-Agent': DEFAULT_UA,
      },
      method: 'GET',
    });

    if(!res.ok) return [false, { error: `HTTPステータスコード: ${res.status} (${res.statusText})` }];
    return [true, { response: await res.json() }];
  },
);
