// SPDX-License-Identifier: AGPL-3.0-or-later

import { Client, GatewayIntentBits, type Snowflake, SlashCommandBuilder, type ApplicationCommandDataResolvable, MessageFlags, type ChatInputCommandInteraction, type OmitPartialGroupDMChannel, type Message } from 'discord.js';
import { type Chat, type GenerateContentResponse, GoogleGenAI, type Schema as GenAISchema, type SendMessageParameters, type Part as GenAIPart } from '@google/genai';
import { discordMessageToAISchema, getCounter, getEnv } from './utils.ts';
import { Logger } from './logger.ts';
import process from 'node:process';
import { aitools, executeTool } from './aitool.ts';
import { db } from './db.ts';
import { systemPrompt } from './def.ts';

// init log

const mainLogger = new Logger('main');
const commandLogger = new Logger('commands');
const aiLogger = new Logger('ai');
const nodeLogger = new Logger('node');

process.on('unhandledRejection', (reason, _promise) => {
  nodeLogger.error(String(reason));
});


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

const processAIResponse = async (
  res: GenerateContentResponse,
  msg: OmitPartialGroupDMChannel<Message>,
  fnCounter: ReturnType<typeof getCounter>,
):
  Promise<[true]
        | [false, SendMessageParameters]> => {
  if(!res.functionCalls || res.functionCalls.length === 0) return [true];

  const fnRes: Array<GenAIPart> = [];

  for(const fn of res.functionCalls) {
    if(fnCounter.get() > 30) {
      fnRes.push({
        functionResponse: {
          name: fn.name,
          response: { error: 'ツールの実行回数上限を超えました' },
        },
      });
      break;
    }
    const toolRes = await executeTool(fn, client as Client<true>, msg); // FIXME:
    await msg.channel.sendTyping();
    await msg.channel.send(`-# Calling function "${fn.name}"...`);
    fnRes.push({
      functionResponse: {
        name: fn.name,
        response: toolRes ? (
          toolRes[0] ? toolRes[1] : { error: 'functionの実行中にエラーが発生しました' }
        ) : { error: `function: ${fn.name} は存在しません` },
      },
    });
    fnCounter.inc();
  }

  return [false, {
    message: fnRes,
  }];
};

const processAIGenError = (e: unknown) => ({
  text: 'An error occurred while generating the response.\n```ts\n'
    + (e instanceof Error ? `${e.name}: ${e.message}` : String(e)) + '\n```',
} as GenerateContentResponse);

const model = 'gemini-2.5-flash-lite';

client.on('messageCreate', async m => {
  if(!m.author.bot && m.mentions.users.has(client.user!.id) && await db.inArray('aichannels', m.channelId)) {
    const chat: Chat = aichats.get(m.channelId) ?? (() => {
      const newChat = genai.chats.create({
        model,
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
      // message: m.content,
      message: JSON.stringify(await discordMessageToAISchema(m)),
    }).catch(processAIGenError);

    const fnCounter = getCounter();

    let ret = await processAIResponse(res, m, fnCounter);

    if(ret[0] === false) {
      let genLoopCount = 0;
      let genDone = false;

      while(genLoopCount < 10) {
        if(fnCounter.get() > 30) {
          break;
        }
        ++genLoopCount;
        res = await chat.sendMessage(ret[1]).catch(processAIGenError);
        ret = await processAIResponse(res, m, fnCounter);
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
    await m.reply(`${res.text}${res.text?.endsWith('\n') ? '' : '\n'}-# model: ${model}`);
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
    commandLogger.error(err instanceof Error ? err.stack ?? err.name + ': ' + err.message : String(err));
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
