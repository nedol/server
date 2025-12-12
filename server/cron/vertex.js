import {
  FunctionDeclarationSchemaType,
  HarmBlockThreshold,
  HarmCategory,
  VertexAI
} from '@google-cloud/vertexai';

const vertexAI = new VertexAI({project: 'firebase-infodesk', location: 'europe-west1'});

const textModel =  'gemini-2.0-flash';//'gemini-1.5-flash-002'



export default async function generate_from_text_input(prompt) {

    try{
      // Разделить по секциям
      const sections = prompt.system
        .split(/^## /gm) // делим по '## Заголовкам'
        .filter(Boolean)
        .map((section) => "## " + section.trim()); // добавляем '##' обратно и обрезаем пробелы

      const generativeModel = vertexAI.getGenerativeModel({
          model: textModel,
          // The following parameters are optional
          // They can also be passed to individual content generation requests
          safetySettings: [{category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE}],
          // generationConfig: {maxOutputTokens: 1028},
          systemInstruction: {
            role: 'system',
            parts: [ sections.map((text) => ({ text }))]
          },
      });
        
      const request = {
        contents: [{role: 'user', parts: [{text: prompt.user}]}],
      };
      const resp = await generativeModel.generateContent(request);
      return resp.response.candidates[0].content.parts[0].text;
      // console.log(JSON.stringify(contentResponse));
    }catch(ex){
      console.log(ex);
      return; 
    }
  }

export async function check_text_result(prompt) {

  try{
    const resp = await generativeModel.generateContent(prompt);
    return resp.response.candidates[0].content.parts[0].text;
    // console.log(JSON.stringify(contentResponse));
  }catch(ex){
    console.log(ex);
    return; 
  }
}
