import { GoogleGenAI } from "@google/genai";
import { config } from 'dotenv';

config();

async function testGenAI() {
  try {
    console.log('Testing GoogleGenAI...');
    
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: "Write a short greeting in Dutch.",
      config: {
        thinkingConfig: {
          thinkingBudget: 0,
        },
      }
    });

    if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const generatedText = response.candidates[0].content.parts[0].text;
      console.log('Success! Response:', generatedText);
      return generatedText;
    } else {
      console.error("No text generated in the response.");
      return null;
    }
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
    return null;
  }
}

testGenAI();