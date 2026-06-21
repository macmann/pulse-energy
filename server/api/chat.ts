import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { SYSTEM_PROMPT, getHouseholdContext } from '../lib/systemPrompt.ts';
import { selectModel } from '../lib/modelRouter.ts';
import { createTools } from '../tools/index.ts';
import type { Request, Response } from 'express';

export async function chatHandler(req: Request, res: Response): Promise<void> {
  // Guard: require an API key
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({
      error: 'OpenAI API key not configured. Set OPENAI_API_KEY in your .env file.',
    });
    return;
  }

  try {
    const { messages, householdId = 'HH-1001' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Missing or invalid "messages" array in request body.' });
      return;
    }

    const modelId = selectModel(messages);
    const tools = createTools(householdId);
    const householdContext = getHouseholdContext(householdId);

    const result = streamText({
      model: openai(modelId),
      system: SYSTEM_PROMPT + '\n\n' + householdContext,
      messages,
      tools,
      maxSteps: 5,
    });

    result.pipeDataStreamToResponse(res);
  } catch (err) {
    console.error('[chat] Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error processing chat request.' });
    }
  }
}
