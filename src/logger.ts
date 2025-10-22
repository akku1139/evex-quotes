import { WebhookClient } from 'discord.js';
import { getEnv } from './utild.js';

const loglevel = ['log', 'info', 'warn', 'error', 'debug'] as const;
type Loglevel =  typeof loglevel[number];

const LOG_WEBHOOK = getEnv('LOG_WEBHOOK')

export class Logger {
  webhook: WebhookClient;
  name: string;

  info!: (msg: string) => void;
  warn!: (msg: string) => void;
  error!: (msg: string) => void;
  debug!: (msg: string) => void;

  constructor(name: string) {
    this.webhook = new WebhookClient({
      url: LOG_WEBHOOK,
    });
    this.name = name;

    for(const l of loglevel) {
      this[l] = (msg: string) => this.log(l, msg);
    }
  }

  fmt(level: string, msg: string) {
    const now = new Date();

    const pad = (num: number) => String(num).padStart(2, '0');

    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());

    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    const paddedLevel = level.toUpperCase().padEnd(8, ' ');

    return `[${timestamp}] [${paddedLevel}] ${this.name}: ${msg}`;
  }

  log(level: Loglevel, msg: string) {
    const data = this.fmt(level, msg);

    console[level](data);
    this.webhook.send('```\n' + data + '\n```').catch(e => console.error(`An error occurred while sending a log to the webhook.`, e));
  }

  //subLogger(name: string) {
  //}
}
