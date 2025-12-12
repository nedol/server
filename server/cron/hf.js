// Hugging Face text generation with fallback to OpenRouter
import { config } from 'dotenv';
import openrouter_generate from './openrouter.js';
import OpenAI from "openai";

config();

export default async function generate_from_text_input(prompt, text) {
  try {
    text = "De implementatie van de nieuwe software vereist aanzienlijke investeringen en deskundige kennis. Het is essentieel dat de medewerkers adequaat worden opgeleid om alle functionaliteiten effectief te benutten.";
  
    // First try Hugging Face with default model
    const simplifiedText = await replace_words(prompt, "A2");
    return simplifiedText;
  } catch (error) {
    console.error('Hugging Face generation failed:', error.message);
    
    // Fallback to OpenRouter
    console.log('Falling back to OpenRouter...');
    try {
      const fallbackResult = await openrouter_generate({ user: prompt });
      if (fallbackResult && fallbackResult.content) {
        return fallbackResult.content;
      }
    } catch (fallbackError) {
      console.error('OpenRouter fallback also failed:', fallbackError.message);
    }
    
    // If both fail, throw the original error
    throw error;
  }
}

// Export a function for word replacement (simplification) using OpenRouter directly
export async function replace_words(prompt, level = "A1") {
  try {
    // Create a prompt for word replacement
//     const prompt = `Please simplify this Dutch text for ${level} language learners by replacing complex words with simpler alternatives. 
//     Keep the same meaning and structure, but use easier vocabulary. 
//     Do not shorten or summarize the text, just replace difficult words with simpler ones.
// Original text:
// ${inputText}

// Simplified text:`;
    
    // Use OpenRouter directly with a simple approach
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
    
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set. Please check your .env file.');
    }
    
    const openai = new OpenAI({
      baseURL: OPENROUTER_BASE_URL,
      apiKey: OPENROUTER_API_KEY,
      defaultHeaders: {
        "HTTP-Referer": "https://kolmit.onrender.com",
      },
    });
    
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "user", content: prompt.user }
      ],
      model: "mistralai/mistral-7b-instruct:free",
      temperature: 0.7,
      max_tokens: 1024,
    });
    
    if (completion.choices[0]?.message?.content) {
      return completion.choices[0].message.content.trim();
    } else {
      throw new Error('OpenRouter returned empty response');
    }
  } catch (error) {
    console.error('Word replacement failed:', error.message);
    throw error;
  }
}