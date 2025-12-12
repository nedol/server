import OpenAI from "openai";
import { config } from 'dotenv';

import { logger } from '../../utils.js';

config();

// Add this import for the new utility function
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const utils = require('../../utils.js');

// List of fallback models in order of preference
const MODELS = [
  "openai/gpt-oss-120b:free",
  "mistralai/mistral-7b-instruct:free",// лучшая
  "kwaipilot/kat-coder-pro:free",
  "meta-llama/llama-3.3-70b-instruct:free",//1 слабая
  // "mistralai/mistral-7b-instruct:free",//0
  // "mistralai/mistral-nemo:free",//0
  "alibaba/tongyi-deepresearch-30b-a3b:free",// 0/1
  //"z-ai/glm-4.5-air:free",  "nvidia/nemotron-nano-9b-v2:free",//
  // "deepseek/deepseek-r1-distill-llama-70b:free",//0
  // "google/gemini-flash-1.5-8b",     
  // "google/gemini-2.0-flash-exp:free",
  //  "x-ai/grok-4.1-fast:free",
  
];

export default async function generate_from_text_input(prompt) {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

  // Try each model in order until one works
  for (const model of MODELS) {
    try {
      const openai = new OpenAI({
        baseURL: OPENROUTER_BASE_URL,
        apiKey: OPENROUTER_API_KEY,
        defaultHeaders: {
          "HTTP-Referer": "https://kolmit.onrender.com",
        },
      });

      const systemMessage = 
      `Formatting Rules:
      - Use Markdown for lists, tables, and styling.
      - Use '''code fences''' for all code blocks.
      - Format file names, paths, and function names with 'inline code' backticks.
      - **For all mathematical expressions, you must use dollar-sign delimiters. Use $...$ for inline math and $$...$$ for block math. Do not use (...) or [...] delimiters.**`

      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: systemMessage},
          { role: "user", content: prompt.user }
        ],
        model: model,
        // Added necessary parameters for better control and reliability
        temperature: 0.3,  // Controls randomness (0.0 = deterministic, 1.0 = creative)
        max_tokens: 2048,  // Maximum number of tokens in the response
        top_p: 1.0,       // Controls diversity via nucleus sampling
        frequency_penalty: 0.0,  // Reduces repetition
        presence_penalty: 0.0    // Encourages new topics/concepts
      });

      if (completion.choices[0]?.message?.content && completion.choices[0].message.content.trim() !== "") {
        // Get the raw response
        let adaptedArticle = completion.choices[0].message.content;
        
        // Try to parse the response as JSON
        let json_article;
        try {
          json_article = JSON.parse(adaptedArticle);
        } catch (parseError) {
          console.error('Adapted article content:', adaptedArticle);
          
          // Try to extract JSON from the response if it contains additional text
          try {
            // Use our new utility function to clean and parse JSON
            json_article = utils.default.cleanAndParseJSON(adaptedArticle);
            
            // If the utility function didn't work, fall back to the original approach
            if (!json_article) {
              // First, try to find and extract the result object specifically
              let resultObjectMatch = adaptedArticle.match(/"result"\s*:\s*(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/);
              if (resultObjectMatch) {
                // Create a complete JSON object with just the result
                json_article = { result: JSON.parse(resultObjectMatch[1]) };
              } else {
                // Try to find any complete JSON object containing "result"
                const jsonMatch = adaptedArticle.match(/\{[\s\S]*"result"[\s\S]*?:[\s\S]*?\{[\s\S]*\}[^}]*\}/);
                if (jsonMatch) {
                  json_article = JSON.parse(jsonMatch[0]);
                } else {
                  // Try to find balanced braces approach
                  const firstBrace = adaptedArticle.indexOf('{');
                  const lastBrace = adaptedArticle.lastIndexOf('}');
                  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    const jsonString = adaptedArticle.substring(firstBrace, lastBrace + 1);
                    json_article = JSON.parse(jsonString);
                  } else {
                    throw new Error('No JSON object found in response');
                  }
                }
              }
            }
          } catch (extractError) {
            console.error('Failed to extract JSON from adapted article:', extractError.message);
            // Continue with next model instead of returning null
            continue;
          }
        }
        
        // Validate the parsed JSON structure
        if (!json_article.result || !json_article.result.article) {
          console.error('Invalid JSON structure in adapted article:', json_article);
          // Continue with next model instead of returning null
          continue;
        }
        
        // Return both the validated content and the model name that was used
        return {
          content: adaptedArticle,
          model: model,
          validatedJson: json_article
        };
      } else {
        console.error(`Empty or whitespace-only response from model: ${model}`);
        continue; // Try next model
      }

    } catch (ex) {
      // Check if this is a rate limit error
      if (ex.response?.status === 429) {
        console.warn(`Rate limited on model: ${model}. Trying next model...`);
        continue; // Try next model
      }
      
      // For other errors, log and try next model
      console.error(`Error with model ${model}:`, ex.message);
      continue;
    }
  }

  // If all models failed
  console.error("All OpenRouter models failed");
  return null;
}