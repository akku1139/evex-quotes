import { Client, Events, GatewayIntentBits, Snowflake } from 'discord.js';
import process from 'node:process';
import fs from 'node:fs/promises';
import { GoogleGenAI } from '@google/genai';

// init db

const db = await (async () => {
  type DB = {
    channels: Array<Snowflake>
  };
  const dbPath = './data.json';

  let lock = false;
  const queue: Array<(v: unknown) => void> = []; // Promise resolve
  const data = JSON.parse((await fs.readFile(dbPath)).toString()) as DB;

  // internal
  const wait = async () => {
    const p = new Promise((resolve) => {
      queue.push(resolve);
    });
    queue[0](void 0);
    await p;
    return;
  };
  const release = () => {
    queue
  };


  const job = async <T>(fn: () => T): Promise<T> => {
    await wait();
    const res = fn();
    release();
    return res;
  };
  const sync = async () => await fs.writeFile(dbPath, JSON.stringify(data));

  return {
    async get<P extends keyof DB>(path: P) {
      return await job(() => {
        return data[path];
      });
    },
    async set<P extends keyof DB>(path: P, newData: DB[P]) {
      return await job(async () => {
        data[path] = newData;
        await sync();
      });
    },
  }
})();

// init gemini

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION;
const GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI;

// init djs

const client = new Client({ intents: [GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });

client.on(Events.ClientReady, readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}!`);
});

/*
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }
});
*/

client.login(process.env.DISCORD_TOKEN);
