// SPDX-License-Identifier: AGPL-3.0-or-later

import { Message } from 'discord.js';
import process from 'node:process';
import { DiscordMessageSchema } from './schemas.ts';

export const getEnv = (name: string) => {
  const v = process.env[name];
  if(v === void 0) {
    throw new Error(`Env "${name} is not defined.`);
  } else {
    return v;
  }
};

export const formatJSTDate = (date: Date) => {
  // if (!(date instanceof Date) || isNaN(date)) {
  //   return "Invalid Date";
  // }

  const formatter = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Tokyo'
  });

  const formattedDateTime = formatter.format(date);

  const timeZoneOffset = '+09:00';

  return `${formattedDateTime} ${timeZoneOffset}`;
};

export const discordMessageToAISchema = async (m: Message): Promise<DiscordMessageSchema> => {
  return {
    content: m.content,
    url: m.url,
    timestamp: formatJSTDate(m.createdAt),
    author: {
      displayName: m.member?.displayName ?? m.author.displayName,
      id: m.author.id,
      globalName: m.author.globalName ?? m.author.displayName,
      username: m.author.username,
    },
    replies: m.reference ? {
      guildId: m.reference.guildId,
      channelId: m.reference.channelId,
      messageId: m.reference.messageId,
      type: m.reference.type,
    } : void 0,
  };
};
