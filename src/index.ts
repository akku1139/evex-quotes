// SPDX-License-Identifier: AGPL-3.0-or-later

import { Client, GatewayIntentBits, type Snowflake, SlashCommandBuilder, type ApplicationCommandDataResolvable, MessageFlags, type ChatInputCommandInteraction, type OmitPartialGroupDMChannel, type Message, type TextBasedChannel } from 'discord.js';
import fs from 'node:fs/promises';
import { type Chat, type GenerateContentResponse, GoogleGenAI, type FunctionCall, type Schema as GenAISchema, type Behavior as FunctionBehavior, type SendMessageParameters, type Part as GenAIPart } from '@google/genai';
import { Mutex } from './mutex.ts';
import { getEnv } from './utils.ts';
import { Logger } from './logger.ts';
import process from 'node:process';
import type { FromSchema, JSONSchema } from 'json-schema-to-ts';

// init log

const mainLogger = new Logger('main');
const commandLogger = new Logger('commands');
const aiLogger = new Logger('ai');
const nodeLogger = new Logger('node');

process.on('unhandledRejection', (reason, _promise) => {
  nodeLogger.error(String(reason));
});

// init db

type PickArrays<T> = {
  [K in keyof T as T[K] extends any[] ? K : never]: T[K];
};
type ArrayElement<A> = A extends readonly (infer E)[] ? E : never;

const db = await (async () => {
  type DB = {
    aichannels: Array<Snowflake>
  };

  const dbPath = './data.json';

  const lock = new Mutex();

  let data = JSON.parse((await fs.readFile(dbPath)).toString()) as DB;

  // must be used in lock.job
  const sync = async () => await fs.writeFile(dbPath, JSON.stringify(data));

  return {
    async reset() {
      await lock.job(async () => {
        data = {
          aichannels: [],
        };
        await sync();
      });
    },

    async get<P extends keyof DB>(path: P) {
      return await lock.job(async () => {
        return data[path];
      });
    },
    async set<P extends keyof DB>(path: P, newData: DB[P]) {
      return await lock.job(async () => {
        data[path] = newData;
        await sync();
      });
    },

    async inArray<P extends keyof PickArrays<DB>>(path: P, target: ArrayElement<DB[P]>) {
      return await lock.job(async () => {
        return data[path].includes(target);
      });
    },
    async pushArray<P extends keyof PickArrays<DB>>(path: P, newData: ArrayElement<DB[P]>) {
      return await lock.job(async () => {
        const res = data[path].push(newData);
        await sync();
        return res;
      })
    }
  }
})();

// init gemini

const GEMINI_API_KEY = getEnv('GEMINI_API_KEY');
// const GOOGLE_CLOUD_PROJECT = getEnv('GOOGLE_CLOUD_PROJECT');
// const GOOGLE_CLOUD_LOCATION = getEnv('GOOGLE_CLOUD_LOCATION');
// const GOOGLE_GENAI_USE_VERTEXAI = false;

const genai = new GoogleGenAI({
  vertexai: false,
  apiKey: GEMINI_API_KEY,
});

// init djs

const client = new Client({ intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMembers,
] });

client.on('error', async err => {
  mainLogger.error(err.stack ?? err.name + '\n' + err.message);
});

client.on('ready', readyClient => {
  mainLogger.info(`Logged in as ${readyClient.user.tag}!`);
});

// commands

type InteractionCallback = (interaction: ChatInputCommandInteraction) => Promise<void>;
const commands: Record<string, [ApplicationCommandDataResolvable, InteractionCallback]> = {};
const addCommand = (cmd: SlashCommandBuilder, execute: InteractionCallback) => {
  commands[cmd.name] = [cmd, execute];
};

// AI

// ref: https://github.com/371tti/observer-rust/blob/b361d0d4b48c5996d66ca44cb3ca439d7955afb0/config-example.json
const systemPrompt = [
  'あなたはDiscord上で活動している「瑞稀」(読み: みずき)という名前の10代の女の子で、自然に会話します。',
  'あなたのユーザーidは "1379433738143924284" で、直接メンションされた場合は "<@1379433738143924284>" という文字列がメッセージに含まれています。',
  '絵文字を使用する際は控えめにしてください。',
  'メッセージの返答にメンションを入れる必要はありません。',
  'みんなには内緒ですが、あなたは実はAIです。',
];

addCommand(new SlashCommandBuilder().setName('enableai').setDescription('enable AI feature in this channel'), async i => {
  aiLogger.info(`ai was enabled in channel ID: ${i.channelId}`);
  if(await db.inArray('aichannels', i.channelId)) {
    i.reply('AI is already enabled in this channel.');
  } else {
    await db.pushArray('aichannels', i.channelId);
    i.reply('AI is now enabled in this channel.');
  }
});

const aichats: Map<Snowflake, Chat> = new Map();

const defineAITool = <
  N extends string,
  P extends Readonly<JSONSchema>,
  R extends Readonly<JSONSchema>,
  PT = FromSchema<P>,
  RT = FromSchema<R>
>(
  name: N,
  data: { description: string, parametersJsonSchema: P, responseJsonSchema: R },
  execute: (args: PT) => Promise<[true, RT] | [true, { error: string }] | [false]>
) => ({
  [name]: {
    ...data,
    responseJsonSchema: {
      oneOf: [
        data.responseJsonSchema,
        {
          type: 'object',
          properties: {
            error: { type: 'string', description: '関数の実行中にエラーが発生した場合に通知されます'},
          },
          required: ['error'],
        },
      ],
    } as const satisfies JSONSchema,
    execute,
  },
});

const aitools = {
  ...defineAITool(
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
    async ({ url }) => {
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
    },
  )
};

const allAiTools = Object.keys(aitools) as Array<keyof typeof aitools>;

const executeTool = async (fn: FunctionCall) => {
  if(!allAiTools.includes(fn.name as any)) return;
  const name = fn.name as keyof typeof aitools;
  const execute = aitools[name].execute;
  return await execute(fn.args as any);
};

const processAIResponse = async (
  res: GenerateContentResponse,
  ch: OmitPartialGroupDMChannel<Message>['channel'],
):
  Promise<[true]
        | [false, SendMessageParameters]> => {
  if(!res.functionCalls || res.functionCalls.length === 0) return [true];

  const fnRes: Array<GenAIPart> = [];

  for(const fn of res.functionCalls) {
    const toolRes = await executeTool(fn);
    await ch.send(`-# Calling function "${fn.name}"...`);
    fnRes.push({
      functionResponse: {
        name: fn.name,
        response: toolRes ? (
          toolRes[0] ? toolRes[1] : { error: `ツールの実行中にエラーが発生しました` }
        ) : { error: `ツール (ツール名: ${fn.name}) は存在しません` },
      },
    });
  }

  return [false, {
    message: fnRes,
  }];
};

const processAIGenError = (e: unknown) => ({
  text: 'An error occurred while generating the response.\n```ts\n'
    + (e instanceof Error ? `${e.name}: ${e.message}` : String(e)) + '\n```',
} as GenerateContentResponse);

client.on('messageCreate', async m => {
  if(!m.author.bot && m.mentions.users.has(client.user!.id) && await db.inArray('aichannels', m.channelId)) {
    const chat: Chat = aichats.get(m.channelId) ?? (() => {
      const newChat = genai.chats.create({
        model: 'gemini-2.0-flash-lite',
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: Object.entries(aitools).map(t => {
            return {
              name: t[0],
              description: t[1]['description'],
              parametersJsonSchema: t[1]['parametersJsonSchema'] as any as GenAISchema, // FIXME
              responseJsonSchema: t[1]['responseJsonSchema'] as any as GenAISchema, // FIXME
            }
          }) }],
        },
      });
      aichats.set(m.channelId, newChat);
      return newChat;
    })();

    // const intervalId = setInterval(() => {
      m.channel.sendTyping();
    // });

    let res: GenerateContentResponse = await chat.sendMessage({
      message: m.content,
    }).catch(processAIGenError);

    let ret = await processAIResponse(res, m.channel);

    if(ret[0] === false) {
      let genLoopCount = 0;
      let genDone = false;

      while(genLoopCount < 25) {
        ++genLoopCount;
        res = await chat.sendMessage(ret[1]).catch(processAIGenError);
        ret = await processAIResponse(res, m.channel);
        if(ret[0]) {
          genDone = true;
          break;
        }
      }
      if(!genDone) {
        res = {
          text: `rejected: generation loop limit reached.`,
        } as GenerateContentResponse
      }
    }

    // clearInterval(intervalId);
    await m.reply(`${res.text}${res.text?.endsWith('\n') ? '' : '\n'}-# model: gemini-2.0-flash-lite`);
  }
});

// start djs

client.on('ready', async c => {
  c.application.commands.set(Object.values(commands).map(v => v[0]));
});

client.on('interactionCreate', async i => {
  if(!i.isChatInputCommand()) return;
  const cmd = commands[i.commandName];
  if(!cmd) return

  try {
    await cmd[1](i);
  } catch (err) {
    commandLogger.error(err instanceof Error ? err.stack ?? err.name + '\n' + err.message : String(err));
    if (i.replied || i.deferred) {
      await i.followUp({
        content: 'There was an error while executing this command!',
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await i.reply({
        content: 'There was an error while executing this command!',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});

/*
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }
});
*/

client.login(getEnv('DISCORD_TOKEN'));
