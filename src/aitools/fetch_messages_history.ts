// SPDX-License-Identifier: AGPL-3.0-or-later

import { discordMessageSchema } from '../schemas.ts';
import { discordMessageToAISchema } from '../utils.ts';
import { defineAITool } from './common.ts';
import { type TextBasedChannel } from 'discord.js';

// TODO: Support reactions

export default defineAITool(
  {
    description: 'Discordの特定メッセージ周辺のメッセージ履歴を取得します',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '起点のメッセージURL (デフォルトでは現在のチャンネルの最後のメッセージ)' },
        limit: { type: 'number', description: '取得するメッセージの個数', default: 30 },
        mode: {
          type: 'string',
          enum: ['after', 'before', 'around'],
          description: 'メッセージ取得モード。指定したメッセージから (after: 新しい, before: 古い, around: 周辺) を取得します。',
          default: 'around',
        },
      },
    } as const,
    responseJsonSchema: {
      type: 'object',
      patternProperties: {
        '^.*$': discordMessageSchema,
      },
    },
  },
  async ({ url, limit, mode }, { client, msg }) => {
    try {
      let channel: TextBasedChannel = msg.channel;
      let messageID = msg.id;
      if(url !== void 0) {
        const split = /https:\/\/(?:canary\.|ptb\.)?discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/.exec(url);
        if(!split) return [false, { error: "URLのパース中にエラーが発生しました" }];

        const [_, guildID, channelID, messageID] = split;
        if(!guildID || !channelID || !messageID) return [false, { error: 'URLの要素が不足しています' }];

        const _guild = await client.guilds.fetch(guildID);
        channel = await client.channels.fetch(channelID) as TextBasedChannel;
        if(!channel) return [false, { error: 'チャンネルを取得できませんでした'}];
        if(!channel.messages) return [false, { error: 'チャンネルが間違っています' }];
      }
      const messages = await channel.messages.fetch({
        ...{ [mode ?? 'around']: messageID },
        cache: false,
        limit: limit ?? 30,
      });
      return [true, Object.fromEntries(
        await Promise.all(messages.map(async message => [message.id, await discordMessageToAISchema(message)]))
      )];
    } catch(err) {
      return [false, { error: 'エラーが発生しました\n' + (err instanceof Error ? err.name + ': ' + err.message : String(err)) }];
    }
  },
);
