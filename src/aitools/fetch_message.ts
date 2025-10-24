// SPDX-License-Identifier: AGPL-3.0-or-later

import { defineAITool } from './common.ts';
import { type TextBasedChannel } from 'discord.js';

// TODO: Support reactions

export default defineAITool(
  {
    description: 'DiscordのメッセージURLからメッセージ内容を取得します',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'メッセージのURL' },
      },
      required: ['url'],
    } as const,
    responseJsonSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'メッセージの内容' },
        url: { type: 'string', description: 'メッセージのURL' },
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
          required: ['guildId', 'channelId', 'messageId', 'type'],
        },
      },
      required: ['content', 'url', 'author'],
    } as const,
  },
  async ({ url }, client) => {

    try {
      const split = /https:\/\/(?:canary\.|ptb\.)?discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/.exec(url);
      if(!split) return [true, { error: "URLのパース中にエラーが発生しました" }];

      const [_, guildID, channelID, messageID] = split;
      if(!guildID || !channelID || !messageID) return [true, { error: 'URLの要素が不足しています' }];

      const _guild = await client.guilds.fetch(guildID);
      const channel = await client.channels.fetch(channelID) as TextBasedChannel;
      if(!channel) return [true, { error: 'チャンネルを取得できませんでした'}];
      if(!channel.messages) return [true, { error: 'チャンネルが間違っています' }]
      const message = await channel.messages.fetch(messageID);
      return [true, {
        content: message.content,
        url: message.url,
        author: {
          displayName: message.author.displayName,
          id: message.author.id,
          globalName: message.author.globalName,
          username: message.author.username,
        },
        replies: message.reference,
      } as const];
    } catch(err) {
      return [true, { error: 'エラーが発生しました\n' + (err instanceof Error ? err.name + ': ' + err.message : String(err)) }];
    }
  },
);
