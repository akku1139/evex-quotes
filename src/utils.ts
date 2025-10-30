// SPDX-License-Identifier: AGPL-3.0-or-later

import { Message } from 'discord.js';
import process from 'node:process';
import type { DiscordMessageResponse } from './schemas.ts';

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

export const discordMessageToAISchema = async (m: Message): Promise<DiscordMessageResponse> => {
  return {
    content: m.content,
    url: m.url,
    timestamp: formatJSTDate(m.createdAt),
    author: {
      displayName: m.member?.displayName ?? m.author.displayName,
      id: m.author.id,
      globalName: m.author.globalName ?? m.author.displayName,
      username: m.author.username,
      bot: m.author.bot,
      // TODO: primaryGuild
    },
    replies: m.reference ? {
      guildId: m.reference.guildId,
      channelId: m.reference.channelId,
      messageId: m.reference.messageId,
      type: m.reference.type,
    } : void 0,
  };
};

export const getCounter = () => {
  let count = 0;
  return {
    inc() { ++count; },
    get() { return count},
  };
};

export const timeSuffix = (sec: number): string => {
  if (sec < 0 || !Number.isFinite(sec)) {
    throw new Error('Invalid input');
  }

  const seconds = Math.round(sec);

  const MINUTE = 60;
  const HOUR = 60 * MINUTE;
  const THRESHOLD_MIN_SEC = 120;
  const THRESHOLD_HOUR_MIN = 120 * MINUTE;

  if (seconds < THRESHOLD_MIN_SEC) {
    return `${seconds} sec`;
  } else if (seconds < THRESHOLD_HOUR_MIN) {
    const minutes = seconds / MINUTE;
    return `${minutes.toFixed(1)} min`;
  } else {
    const hours = seconds / HOUR;
    return `${hours.toFixed(1)} hour`;
  }
};
