import { config } from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Load environment variables
config();

console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
console.log('GEMINI_API_KEY length:', process.env.GEMINI_API_KEY?.length || 0);

if (process.env.GEMINI_API_KEY) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });
    console.log('Model initialized successfully');
  } catch (error) {
    console.error('Error initializing model:', error.message);
  }
} else {
  console.log('GEMINI_API_KEY is not set');
}