// SPDX-License-Identifier: AGPL-3.0-or-later

import { DEFAULT_UA } from '../def.ts';
import { defineAITool } from './common.ts';
import { getEnv } from '../utils.ts';

/* example code
import { Hono } from "hono";
import { Readability } from "@mozilla/readability";
import { Browser } from 'happy-dom';

const app = new Hono();
const readableCache = await caches.open("readable-cache");

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/readability", async c => {
  const url = c.req.query('url');
  if(!URL.canParse(url)) return c.text('url error', 400);
  const parsedURL = new URL(url);
  const cachedResponse = await readableCache.match(parsedURL);
  console.log('url:', url, 'cache:', !!cachedResponse);
  if(cachedResponse) return cachedResponse;
  const browser = new Browser();
  const page = browser.newPage();
  page.url = url;
  const httpRes = await fetch(url);
  console.log(`fetch result (${url}):`, httpRes.status, '(', httpRes.ok, ')');
  const text = await (httpRes).text();
  page.content = text;
  const reader = new Readability(page.mainFrame.document);
  const res = c.json({
    ...reader.parse(),
    http_status: httpRes.status,
    raw: text,
  });
  if(httpRes.ok) await readableCache.put(parsedURL, res.clone());
  return res;
});

Deno.serve(app.fetch);
*/
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
        http_status: { type: 'number', description: 'HTTPステータスコード' },
        raw: { type: 'string', description: 'ページの生データ' },
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
