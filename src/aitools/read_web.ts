// SPDX-License-Identifier: AGPL-3.0-or-later

import { DEFAULT_UA } from '../def.ts';
import { defineAITool } from './common.ts';
import { getEnv } from '../utils.ts';

const READABILITY_ENDPOINT = new URL(getEnv('READABILITY_ENDPOINT')).toString();

export default defineAITool(
  {
    description: 'Readability.jsを使ってWebサイトを閲覧します。',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'WebページのURL' },
      },
      required: ['url'],
    } as const,
    responseJsonSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'ページタイトル' },
        content: { type: 'string', description: 'HTML形式のReadability.jsの出力' },
        textContent: { type: 'string', description: 'Readability.jsの出力' },
        length: { type: 'string', description: '記事の文字数' },
        excerpt: { type: 'string', description: 'ページの概要、抜粋' },
        byline: { type: 'string', description: '著者の情報' },
        dir: { type: 'string', description: 'コンテンツの方向性' },
        siteName: { type: 'string', description: 'サイトの名前' },
        lang: { type: 'string', description: 'ページの言語' },
        publishedTime: { type: 'string', description: '公開日' },
        http_status: { type: 'string', description: 'HTTPステータスコード' },
      },
      required: ['title', 'content', 'http_status'],
    } as const,
  },
  async ({ url }) => {
    const res = await fetch(`${READABILITY_ENDPOINT}?url=${encodeURIComponent(url)}`, {
      headers: {
          'User-Agent': DEFAULT_UA,
      },
      method: 'GET',
    });

    if(!res.ok) return [false, { error: `HTTPステータスコード: ${res.status} (${res.statusText})` }];
    return [true, await res.json()];
  },
);
