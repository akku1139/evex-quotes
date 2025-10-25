// SPDX-License-Identifier: AGPL-3.0-or-later

// disabled
// https://html.duckduckgo.com/robots.txt

import { defineAITool } from './common.ts';

export default defineAITool(
  {
    description: 'DuckDuckGoで検索をして、検索結果のHTMLを返します。',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '検索ワード' }
      },
      required: ['keyword'],
    } as const,
    responseJsonSchema: {
      type: 'object',
      properties: {
        html: { type: 'string', description: '検索結果のHTML' }
      },
      required: ['html'],
    } as const,
  },
  async ({ keyword }) => {
    const res = await fetch('https://html.duckduckgo.com/html/', {
      headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0 ',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ q: keyword }).toString(),
      method: 'POST',
    });

    if(!res.ok) return [false, { error: `HTTPステータスコード: ${res.status} (${res.statusText})` }];
    return [true, { html: await res.text() }];
  },
);
