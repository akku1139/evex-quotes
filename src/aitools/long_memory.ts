// SPDX-License-Identifier: AGPL-3.0-or-later

import { defineAITool } from './common.ts';
import { db } from '../db.ts';

export default defineAITool(
  {
    description: 'システムプロンプトに自動で挿入される長期記憶を上書き設定します。これまでの記憶も適宜マージするように。',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '保存する内容' },
      },
      required: ['content'],
    },
    responseJsonSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', description: '上手く保存できたかどうか' },
      },
      required: ['ok'],
    },
  } as const,
  async ({ content }) => {
    db.set('aimainmemory', content);
    return [true, { ok: true }];
  },
);
