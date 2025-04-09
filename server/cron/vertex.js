import {VertexAI} from '@google-cloud/vertexai';

const vertexAI = new VertexAI({project: 'firebase-infodesk', location: 'europe-west1'});

const textModel =  'gemini-1.5-flash';//'gemini-1.5-flash-002'
const visionModel = 'gemini-1.5-flash';
const generativeModel = vertexAI.getGenerativeModel({
  model: textModel,
});

export default async function generate_from_text_input(prompt) {

    try{
      const resp = await generativeModel.generateContent(prompt);
      return resp.response.candidates[0].content.parts[0].text;
      // console.log(JSON.stringify(contentResponse));
    }catch(ex){
      console.log(ex);
      return; 
    }
  }
