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
      console.log('Success! Response:', result.substring(0, 100) + '...');
    } else {
      console.log('Failed to generate content');
    }
  } catch (error) {
    console.error('Error testing Gemini integration:', error);
  }
}

testGeminiIntegration();