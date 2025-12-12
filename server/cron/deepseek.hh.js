import OpenAI from "openai";
import { config } from 'dotenv';
config();

import { InferenceClient } from '@huggingface/inference';

import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = 'Davlan/mbart50-finetuned-dutch-simplification';

export async function generate_from_text_input(prompt) {
  try {
    const client = new InferenceClient(process.env.HF_TOKEN);
    const output = await client.textGeneration({
      model: MODEL,
      inputs: prompt,
      parameters: {
        max_new_tokens: 512,
        temperature: 0.7,
        return_full_text: false
      }
    });

    return output.generated_text.trim();
  } catch (error) {
    console.error('Error in text generation:', error);
    // Fallback to a known working model
    try {
      const client = new InferenceClient(process.env.HF_TOKEN);
      const fallbackOutput = await client.textGeneration({
        model: 'google/flan-t5-base',
        inputs: prompt,
        parameters: {
          max_new_tokens: 512,
          temperature: 0.7,
          return_full_text: false
        }
      });

      return fallbackOutput.generated_text.trim();
    } catch (fallbackError) {
      console.error('Fallback model also failed:', fallbackError);
      throw fallbackError;
    }
  }
}