import { defineAITool } from './common.ts';
import { type TextBasedChannel } from 'discord.js';

export default defineAITool(
  'fetch_message',
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
        // TODO: 投稿者を取得
      },
      required: ['content'],
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
      }];
    } catch(err) {
      return [true, { error: 'エラーが発生しました\n' + (err instanceof Error ? err.name + ': ' + err.message : String(err)) }];
    }
  },
);
