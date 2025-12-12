import { config } from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Load environment variables
config();

async function testGemini() {
  try {
    console.log('Testing Gemini API...');
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Try gemini-1.0-pro which is a stable model
    const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
    
    const prompt = "Write a short greeting in Dutch.";
    
    console.log('Sending prompt:', prompt);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('Response:', text);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Full error:', error);
  }
}

testGemini();