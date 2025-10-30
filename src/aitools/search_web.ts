// SPDX-License-Identifier: AGPL-3.0-or-later

import { DEFAULT_UA } from '../def.ts';
import { defineAITool } from './common.ts';
import { getEnv } from '../utils.ts';

/* example implementation
import { Hono } from "hono";
import { Browser } from 'happy-dom';

const app = new Hono();
const searchCache = await caches.open("search-cache");

app.get("/searchep", async c => {
  const url = new URL(`https://search.yahoo.co.jp/search?p=${encodeURIComponent(c.req.query('q'))}&ei=UTF-8`);
  const cachedResponse = await searchCache.match(url);
  console.log('url:', url.toString(), 'cache:', !!cachedResponse);
  if(cachedResponse) return cachedResponse;

  const browser = new Browser();
  const page = browser.newPage();
  page.url = url;
  const httpRes = await fetch(url);
  const text = await (httpRes).text();
  console.log(`fetch result (${url}):`, httpRes.status, '(', httpRes.ok, ')');
  page.content = text;
  const document = page.mainFrame.document;

  const res = c.json(
    [...Array.from(document.getElementById('web').getElementsByTagName('li')).map((e: any) => {
      return {
        title: e.getElementsByTagName('a')[0].innerText,
        summary: e.getElementsByTagName('div')[0]?.innerText,
        link: e.getElementsByTagName('a')[0].href,
      }
    })]
  );
  if(httpRes.ok) await searchCache.put(url, res.clone());
  return res;
});

Deno.serve(app.fetch);
*/
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
