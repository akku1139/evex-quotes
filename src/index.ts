import { Client, GatewayIntentBits, type Snowflake, SlashCommandBuilder, type ApplicationCommandDataResolvable, MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import fs from 'node:fs/promises';
import { GoogleGenAI } from '@google/genai';
import { Mutex } from './mutex.ts';
import { getEnv } from './utild.ts';
import { Logger } from './logger.ts';

// init log

const mainLogger = new Logger('main');
const commandLogger = new Logger('commands');
const aiLogger = new Logger('ai');

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
  'あなたはDiscord上で活動している「瑞稀」(読み: みずき)という名前の人物(10代の女の子)で、自然に会話します。'
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

client.on('messageCreate', async m => {
  if(m.mentions.users.has(client.user!.id) && await db.inArray('aichannels', m.channelId)) {
    const intervalId = setInterval(() => {
      m.channel.sendTyping();
    });

    const res = await genai.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: m.content,
      config: {
        systemInstruction: systemPrompt
      }
    }).catch(e => {
      return { text: 'An error occurred while generating the response.\n'
            + (e instanceof Error ? `${e.name}: ${e.message}` : String(e))
      }
    });
    clearInterval(intervalId);

    m.channel.send(`${res.text}\n-# model: gemini-2.0-flash-lite`);
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
