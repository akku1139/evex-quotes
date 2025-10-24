// SPDX-License-Identifier: AGPL-3.0-or-later

import { type Client } from 'discord.js';
import { type FunctionCall } from '@google/genai';
import fetch_message from './aitools/fetch_message.ts'
// import search_duckduckgo_html from './aitools/search_duckducogo_html.ts'

export const aitools = {
  fetch_message,
  // search_duckduckgo_html,
} as const;

const allAiTools = Object.keys(aitools) as Array<keyof typeof aitools>;

export const executeTool = async (fn: FunctionCall, client: Client<true>) => {
  if(!allAiTools.includes(fn.name as any)) return;
  const name = fn.name as keyof typeof aitools;
  const execute = aitools[name].execute;
  return await execute(fn.args as any, client);
};
