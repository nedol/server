import { config } from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Load environment variables
config();

async function listModels() {
  try {
    console.log('Attempting to list models...');
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Check if listModels method exists
    console.log('genAI object keys:', Object.keys(genAI));
    
    // Try to call listModels if it exists
    if (typeof genAI.listModels === 'function') {
      const models = await genAI.listModels();
      console.log('Available models:', JSON.stringify(models, null, 2));
    } else {
      console.log('listModels method not available');
      
      // Try some known model names
      const modelNames = [
        'gemini-pro',
        'gemini-1.0-pro',
        'gemini-1.5-pro-latest',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash-001',
        'gemini-1.5-pro-001',
        'gemini-1.5-flash-002',
        'gemini-1.5-pro-002'
      ];
      
      for (const modelName of modelNames) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          console.log(`Model ${modelName} initialized successfully`);
        } catch (error) {
          console.log(`Model ${modelName} failed:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error('Error listing models:', error);
  }
}

listModels();