import { type Client } from 'discord.js';
import { type FunctionCall } from '@google/genai';
import fetch_message from './tools/fetch_message.ts'

export const aitools = {
  fetch_message,
};

const allAiTools = Object.keys(aitools) as Array<keyof typeof aitools>;

export const executeTool = async (fn: FunctionCall, client: Client<true>) => {
  if(!allAiTools.includes(fn.name as any)) return;
  const name = fn.name as keyof typeof aitools;
  const execute = aitools[name].execute;
  return await execute(fn.args as any, client);
};
