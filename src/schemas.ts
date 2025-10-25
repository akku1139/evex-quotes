// SPDX-License-Identifier: AGPL-3.0-or-later

import type { JSONSchema, FromSchema } from 'json-schema-to-ts'

export const DiscordMessageSchema = {
  type: 'object',
  properties: {
    content: { type: 'string', description: 'メッセージの内容' },
    url: { type: 'string', description: 'メッセージのURL' },
    timestamp: { type: 'string', description: 'メッセージの送信時刻' },
    author: {
      type: 'object', description: 'メッセージ送信者',
      properties: {
        displayName: { type: 'string', description: '送信者の表示名' },
        id: { type: 'string', description: '送信者のユーザーID' },
        globalName: { type: 'string', description: '送信者のグローバル表示名' },
        username: { type: 'string', description: '送信者のユーザー名' },
      },
      required: ['displayName', 'id', 'globalName', 'username'],
    },
    replies: {
      type: 'object', description: 'メッセージのリプライ先情報',
      properties: {
        guildId: { type: 'string', description: 'ギルド(サーバー)ID' },
        channelId: { type: 'string', description: 'チャンネルID' },
        messageId: { type: 'string', description: 'メッセージID' },
        type: { type: 'number', description: '0: 通常メッセージ, 1: 転送されたメッセージ' },
      },
      required: ['channelId'],
    },
  },
  required: ['content', 'url', 'timestamp', 'author'],
} as const satisfies JSONSchema;
export type DiscordMessageSchema = FromSchema<typeof DiscordMessageSchema>;
