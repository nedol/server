import { GoogleGenAI, Type } from "@google/genai";
import { config } from 'dotenv';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const utils = require('../../utils.js');

config();

let total_tokens = 0;

// Use the correct GoogleGenAI class from @google/genai
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const model_name = { 
  model: "gemini-2.5-flash",
  tts: "gemini-2.5-flash"
};

export default async function generate_from_text_input(prompt) {
  try {
    const response = await genAI.models.generateContent({
      model: model_name.model, 
      contents: prompt.user,
      config: {
        thinkingConfig: {
          thinkingBudget: 0, // Disables thinking
        },
      }
    });

    if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const generatedText = response.candidates[0].content.parts[0].text;
      
      // Try to clean and parse the response as JSON if it looks like JSON
      const cleanJson = utils.default.cleanAndParseJSON(generatedText);
      if (cleanJson) {
        return cleanJson; // Return the actual JSON object, not a string
      }
      
      return generatedText;
    } else {
      console.error("No text generated in the response.");
      return null;
    }
  } catch (error) {
    console.error("Error generating content with Gemini API:", error.message);
    console.error("Model:", model_name.model);
    console.error("API Key length:", process.env.GEMINI_API_KEY?.length || 0);
    console.error("Status:", error.status);
    console.error("Status Text:", error.statusText);
    
    return null;
  }
}

export async function GetEmbedding(text) {
  try {
    // Embedding functionality would need to be implemented differently with @google/genai
    console.warn("GetEmbedding function not yet implemented for @google/genai");
    return null;
  } catch (error) {
    console.error("Error getting embedding:", error);
    return null;
  }
}

export async function check_text_result(prompt) {
  try {
    const response = await genAI.models.generateContent({
      model: model_name.model, 
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingBudget: 0, // Disables thinking
        },
      }
    });

    if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const generatedText = response.candidates[0].content.parts[0].text;
      
      // Try to clean and parse the response as JSON if it looks like JSON
      const cleanJson = utils.default.cleanAndParseJSON(generatedText);
      if (cleanJson) {
        return JSON.stringify(cleanJson);
      }
      
      return generatedText;
    } else {
      console.error("No text generated in the response.");
      return null;
    }
  } catch (ex) {
    console.log("Error in check_text_result:", ex.message);
    return; 
  }
}