import OpenAI from "openai";
import { config } from 'dotenv';
config();

import { HfInference } from '@huggingface/inference';


export async function generate_from_text_input_(prompt) {

  try{
    const client = new HfInference(process.env.HF_TOKEN);
    const output = await client.textGeneration({
      model: "CohereForAI/aya-101",
      inputs: prompt,
      provider: "hf-inference",
    });

    return  output;

    for await (const token of response) {
      if(token.choices[0]?.delta?.content)         
        console.log(token.choices[0]?.delta?.content)
    }

    return;

  }catch(ex){
    console.log(ex);
    return; 
  }
}

export default async function generate_from_text_input(prompt) {

    // console.log(prompt)

    try{
      const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: 'sk-c8b6d163e7a241c7a6cbae50babd181b'
      });

      const completion = await openai.chat.completions.create({
        messages: [{ role: "system", content: prompt }],
        model: "deepseek-chat",
      });

      //console.log(completion.choices[0].message.content);
      return completion.choices[0].message.content;
      
    }catch(ex){
      console.log(ex);
      return; 
    }
}



export  async function generate_from_text_input__(prompt) {

  // console.log(prompt)

  try{
    const output = await generator(prompt, {
      max_new_tokens: 100,
    });
    
    //console.log(chatCompletion.choices[0].message);

    return output
    
  }catch(ex){
    console.log(ex);
    return; 
  }
}