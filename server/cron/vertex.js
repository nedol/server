import {VertexAI} from '@google-cloud/vertexai';


export default async function generate_from_text_input(prompt) {

    const vertexAI = new VertexAI({project: 'firebase-infodesk', location: 'europe-west1'});
  
    const generativeModel = vertexAI.getGenerativeModel({
      model: 'gemini-1.5-flash-002',
    });
  
    // const prompt =
    //   "What's a good name for a flower shop that specializes in selling bouquets of dried flowers?";
  
    const resp = await generativeModel. generateContent(prompt);
    return await resp.response;
    // console.log(JSON.stringify(contentResponse));
  }