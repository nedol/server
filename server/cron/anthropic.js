import { config } from 'dotenv';
config();
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

import Anthropic from '@anthropic-ai/sdk';


const anthropic = new Anthropic({
  apiKey: CLAUDE_API_KEY, // defaults to process.env["ANTHROPIC_API_KEY"]
});

const msg = await anthropic.messages.create({
  model: "claude-3-5-sonnet-20241022",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello, Claude" }],
});