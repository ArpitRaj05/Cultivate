'use server';
/**
 * @fileOverview High-performance focus strategist providing short, tactical advice.
 * 
 * - focusStrategist - Main entry point for generating focus advice.
 * - FocusStrategistInput - Schema for user message.
 * - FocusStrategistOutput - Schema for concise tactical reply.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FocusStrategistInputSchema = z.object({
  message: z.string().describe('The user\'s message about study, focus, attention, or planning.'),
});
export type FocusStrategistInput = z.infer<typeof FocusStrategistInputSchema>;

const FocusStrategistOutputSchema = z.object({
  reply: z.string().describe('A high-quality, concise response in 4-5 lines focusing on the best tactical solution.'),
});
export type FocusStrategistOutput = z.infer<typeof FocusStrategistOutputSchema>;

export async function focusStrategist(input: FocusStrategistInput): Promise<FocusStrategistOutput> {
  return focusStrategistFlow(input);
}

const prompt = ai.definePrompt({
  name: 'focusStrategistPrompt',
  input: {schema: FocusStrategistInputSchema},
  output: {schema: FocusStrategistOutputSchema},
  prompt: `You are the Focus Strategist. Your goal is to help users master their focus, attention, and study planning.

Provide the best possible advice in exactly 4-5 lines. 
Keep it neat, clean, and highly actionable.
Avoid medical jargon unless necessary.
Focus only on practical execution.
DO NOT provide "Reality Checks" or "Flowcharts".
Deliver direct, high-quality tactical advice only.
Use a clean, organized format that is easy to read at a glance.

User Inquiry: {{{message}}}`,
});

const focusStrategistFlow = ai.defineFlow(
  {
    name: 'focusStrategistFlow',
    inputSchema: FocusStrategistInputSchema,
    outputSchema: FocusStrategistOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) throw new Error('Failed to generate strategist response.');
    return output;
  }
);
