import OpenAI from "openai";
import { config } from 'dotenv';
config();

export default async function generate_from_text_input(prompt) {
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
  const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
  const MODEL_NAME = "deepseek-chat"; // Store model name for return

  try {
    const openai = new OpenAI({
      baseURL: DEEPSEEK_BASE_URL,
      apiKey: DEEPSEEK_API_KEY
    });

    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user }
      ],
      model: MODEL_NAME // Using the correct model name from DeepSeek API docs
    });

    const json_article = JSON.parse(completion.choices[0].message.content);

    if (completion.choices?.length > 0) {
      // Return both content and model name to match expected format
      return {
        content: completion.choices[0].message.content,
        model: MODEL_NAME,
        validatedJson: json_article
      };
    } else {
      console.error("No choices returned.");
      return null;
    }

  } catch (ex) {
    console.error("Error during completion:", ex);
    return null;
  }
}