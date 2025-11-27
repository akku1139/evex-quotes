// SPDX-License-Identifier: AGPL-3.0-or-later

import { MessageManager, Message, type Snowflake } from 'discord.js';
import process from 'node:process';
import type { DiscordMessageResponse, TinyDiscordMessageResponse } from './schemas.ts';

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

// とりあえず20メッセージでハードコーディング
// 戻り値の1つ目はlastが履歴に含まれていたとき
export const lastMessagesToTinyAISchema = async (mm: MessageManager, last: Snowflake): Promise<[boolean, Array<TinyDiscordMessageResponse>]> => {
  const lastBI = BigInt(last);
  const msgs = (await mm.fetch({ limit: 20 })).filter(msg => BigInt(msg.id) > lastBI).reverse();

  const r: Array<TinyDiscordMessageResponse> = [];
  let c: TinyDiscordMessageResponse|undefined = void 0;
  let lastAuthor: Snowflake = '';
  let lastReply: Snowflake = '';
  const u = new Set<Snowflake>();
  for(const m of msgs) {
    if(
      lastAuthor !== m[1].author.id
      || (m[1].reference?.messageId && (lastReply !== m[1].reference.messageId))
    ) {
      if(c) c.content = c.content.slice(0, -1);
      r.push(c as TinyDiscordMessageResponse); // 最初の要素は捨てるので問題なし
      c = void 0;
    }

    if(!c) {
      c = {
        content: '',
        ids: [],
        timestamp: formatJSTDate(m[1].createdAt),
        author: {
          username: m[1].author.username,
          ...(!u.has(m[1].author.id) && {
            id: m[1].author.id,
            displayName: m[1].member?.displayName ?? m[1].author.displayName,
            ...(m[1].author.bot && { bot: true }),
          })
        },
        ...(m[1].reference?.messageId && { replyID: m[1].reference.messageId }),
      };
      u.add(m[1].author.id);
    }

    c.content += m[1].reference?.type === 1 ? m[1].content.replace(/^/gm, '|> ') : m[1].content;
    c.content += '\n';
    c.ids.push(m[0]);

    lastAuthor = m[1].author.id;
  }
  r.push(c as TinyDiscordMessageResponse); // 多分ここでの型は保障されてる
  return [Array.from(msgs).length < 20, r.slice(1)];
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
