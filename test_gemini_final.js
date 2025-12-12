import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from 'dotenv';

config();

// Test the updated gemini.js file
import generate_from_text_input from './server/cron/gemini.js';

async function testGeminiIntegration() {
  try {
    console.log('Testing Gemini integration...');
    
    const prompt = { user: "Write a short greeting in Dutch." };
    
    const result = await generate_from_text_input(prompt);
    
    if (result) {
      console.log('Success! Response:', result);
    } else {
      console.log('Failed to generate content');
    }
  } catch (error) {
    console.error('Error testing Gemini integration:', error);
  }
}

testGeminiIntegration();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model_name = { 
  model: "gemini-1.0-pro",
  tts: "gemini-1.0-pro"
};

async function testGenerateContent() {
  try {
    console.log('Testing generateContent with model:', model_name.model);
    
    const model = genAI.getGenerativeModel({ model: model_name.model });
    
    // Simple test prompt
    const prompt = { user: "Write a short greeting in Dutch." };
    
    console.log('Sending prompt.user:', prompt.user);
    
    const result = await model.generateContent(prompt.user);
    
    const response = await result.response;
    const text = response.text();
    
    console.log('Success! Response:', text.substring(0, 100) + '...');
    return text;
  } catch (error) {
    console.error("Error generating content:", error);
    console.error("Error details:", {
      message: error.message,
      status: error.status,
      statusText: error.statusText,
      errorDetails: error.errorDetails
    });
    return null;
  }
}

testGenerateContent();