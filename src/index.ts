import { Client, GatewayIntentBits, Snowflake, SlashCommandBuilder, type ApplicationCommandDataResolvable, Interaction, MessageFlags, CacheType, ChatInputCommandInteraction } from 'discord.js';
import fs from 'node:fs/promises';
import { GoogleGenAI } from '@google/genai';
import { Mutex } from './mutex.js';
import { getEnv } from './utild.js';
import { Logger } from './logger.js';

// init log

const commandLogger = new Logger('commands');

// init db

const db = await (async () => {
  type DB = {
    channels: Array<Snowflake>
  };
  const dbPath = './data.json';

  const lock = new Mutex();

  const data = JSON.parse((await fs.readFile(dbPath)).toString()) as DB;

  // must be used in lock.job
  const sync = async () => await fs.writeFile(dbPath, JSON.stringify(data));

  return {
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
  }
})();

// init gemini

const GEMINI_API_KEY = getEnv('GEMINI_API_KEY');
const GOOGLE_CLOUD_PROJECT = getEnv('GOOGLE_CLOUD_PROJECT');
const GOOGLE_CLOUD_LOCATION = getEnv('GOOGLE_CLOUD_LOCATION');
const GOOGLE_GENAI_USE_VERTEXAI = getEnv('GOOGLE_GENAI_USE_VERTEXAI');

// init djs

const client = new Client({ intents: [GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

client.on('ready', readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}!`);
});

// commands

type InteractionCallback = (interaction: ChatInputCommandInteraction) => Promise<void>;
const commands: Record<string, [ApplicationCommandDataResolvable, InteractionCallback]> = {};
const addCommand = (cmd: SlashCommandBuilder, execute: InteractionCallback) => {
  commands[cmd.name] = [cmd, execute];
};

addCommand(new SlashCommandBuilder().setName('enableai').setDescription('enable AI feature in this channel'), async i => {
  i.reply('test');
});

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
