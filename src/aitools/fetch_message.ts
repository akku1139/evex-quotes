// SPDX-License-Identifier: AGPL-3.0-or-later

import { discordMessageSchema } from '../schemas.ts';
import { discordMessageToAISchema } from '../utils.ts';
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
    responseJsonSchema: discordMessageSchema,
  },
  async ({ url }, { client }) => {
    try {
      const split = /https:\/\/(?:canary\.|ptb\.)?discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/.exec(url);
      if(!split) return [false, { error: "URLのパース中にエラーが発生しました" }];

      const [_, guildID, channelID, messageID] = split;
      if(!guildID || !channelID || !messageID) return [false, { error: 'URLの要素が不足しています' }];

      const _guild = await client.guilds.fetch(guildID);
      const channel = await client.channels.fetch(channelID) as TextBasedChannel;
      if(!channel) return [false, { error: 'チャンネルを取得できませんでした'}];
      if(!channel.messages) return [false, { error: 'チャンネルが間違っています' }];
      const message = await channel.messages.fetch(messageID);
      return [true, await discordMessageToAISchema(message)];
    } catch(err) {
      return [false, { error: 'エラーが発生しました\n' + (err instanceof Error ? err.name + ': ' + err.message : String(err)) }];
    }
  },
);
