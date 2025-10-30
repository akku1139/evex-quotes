// SPDX-License-Identifier: AGPL-3.0-or-later

import { Message, type Client } from 'discord.js';
import { type FunctionCall } from '@google/genai';
import fetch_message from './aitools/fetch_message.ts'
import fetch_messages_history from './aitools/fetch_messages_history.ts';
import wikipedia_search from './aitools/wikipedia_search.ts';
import wikipedia_read from './aitools/wikipedia_read.ts';
// import search_duckduckgo_html from './aitools/search_duckducogo_html.ts'
import read_web from './aitools/read_web.ts';

export const aitools = {
  fetch_message,
  fetch_messages_history,
  wikipedia_search,
  wikipedia_read,
  // search_duckduckgo_html,
  read_web,
} as const;

const allAiTools = Object.keys(aitools) as Array<keyof typeof aitools>;

export const executeTool = async (
  fn: FunctionCall, client: Client<true>, msg: Message,
): Promise<undefined | [boolean] | [boolean, Record<string, any>]> => { // FIXME: returntype
  if(!allAiTools.includes(fn.name as any)) return;
  const name = fn.name as keyof typeof aitools;
  const execute = aitools[name].execute;
  const res = await execute(fn.args as any, { client, msg });
  if(res[1] !== void 0) return [true, res[1]];
  return [false];
};
