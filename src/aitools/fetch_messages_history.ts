// SPDX-License-Identifier: AGPL-3.0-or-later

import { discordMessageSchema } from '../schemas.ts';
import { discordMessageToAISchema } from '../utils.ts';
import { defineAITool } from './common.ts';

// TODO: Support reactions

export default defineAITool(
  {
    description: 'Discordの特定メッセージ周辺のメッセージ履歴を取得します',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '起点のメッセージまたはチャンネルのURL、またはチャンネルメンション (デフォルトでは現在のチャンネルの最後のメッセージ)' },
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
      description: '名前が数字(Message ID)で始まるプロパティはメッセージの内容、そうでないものは個別に説明があります。',
      properties: {
        channel: {
          type: 'object',
          description: 'メッセージが送信されたチャンネルに関する情報です。',
          properties: {
            id: { type: 'string', description: 'チャンネルID' },
            name: { type: 'string', description: 'チャンネル名' },
          },
        }
      },
      patternProperties: {
        '^.*$': discordMessageSchema,
      },
    },
  },
  async ({ url, limit, mode }, { client, msg }) => {
    try {
      let channel = msg.channel;
      let tMessageID = msg.id;
      if(url !== void 0) {
        const split = /https:\/\/(?:canary\.|ptb\.)?discord\.com\/channels\/(\d+)\/(\d+)(\/(\d+))/.exec(url);
        let channelID: string;
        if(!split) {
          const mention = /<#(\d+)>/.exec(url);
          if(!mention?.[1]) return [false, { error: "URL/チャンネルメンションのパース中にエラーが発生しました" }];
          channelID = mention[1];
        } else {
          const [_0, guildID, lChannelID, _1, messageID] = split;
          if(!guildID || !lChannelID) return [false, { error: 'URLの要素が不足しています' }];

          const _guild = await client.guilds.fetch(guildID);
          channelID = lChannelID;
          tMessageID = messageID;
        }
        channel = await client.channels.fetch(channelID) as (typeof msg)['channel'];
        if(!channel) return [false, { error: 'チャンネルを取得できませんでした'}];
        if(!channel.messages) return [false, { error: 'チャンネルが間違っています' }];
      }
      const messages = await channel.messages.fetch({
        ...{ [mode ?? 'around']: tMessageID },
        cache: false,
        limit: limit ?? 30,
      });
      return [true, {
        ...Object.fromEntries(
          await Promise.all(messages.map(async message => [message.id, await discordMessageToAISchema(message)]))
        ),
        channel: {
          id: channel.id,
          name: (channel as any).name,
        },
      }];
    } catch(err) {
      return [false, { error: 'エラーが発生しました\n' + (err instanceof Error ? err.name + ': ' + err.message : String(err)) }];
    }
  },
);
