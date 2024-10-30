import pkg from 'lodash';
const { findIndex } = pkg;

// const translate = require('google-translate-api');
// import pkg from 'google-translate-api';
// const translate = require('google-translate-free')
// import pkg from '@iamtraction/google-translate';
// const {translate} = pkg;

import translate from 'translate';
// translate.engine = 'deepl'; // 'libre';// 'google'//
translate.key = '0834516e-29b0-45d1-812e-b903d5962e12:fx'; //'203cca0d-8540-4d75-8c88-d69ac40b6d57:fx';//process.env.DEEPL_API_KEY;

export async function Translate_(text, from, to) {

  translate(text, {from: from, to: to})
    .then((res) => {
      // console.log(res);
      return res.text;
    })
    .catch((err) => {
      console.error(err);
    });
}

export default async function Translate(text, from, to) {

    if (!text) return;
    translate.from = from;
    text = text.replace(/\r\n/g, '');

    // Разделение текста на предложения
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g);//text.split(/([.!?]\s+|$)/);//text.split(/[.!?]/);
    let translatedText = '';

    // Перевод каждой части текста (по 2 предложения)
    for (let i  in sentences ) {
      let chunk = sentences[i];//sentences.slice(i, i + 2).join('. '); // Объединение 10 предложений в одну часть
      if (!chunk)
        continue;
        
      let res;
      // try {

      //   chunk = chunk.replace('<<', '<');
      //   chunk = chunk.replace('>>', '>');
 
      //   translate.engine = 'deepl';
      //   res = await translate(chunk, to);

      //   res = res.replace(/\<(.*?)\>/g, '<<$1>>');
        
      // } catch (ex) {
      chunk = chunk.replace(/<</g, '<< ').replace(/>>/g, ' >>');
      //  chunk = chunk.replace(/<</g, '<').replace(/>>/g, '"');//инверсия 
        
      translate.engine = 'google';
      
      try {
     
          res = await translate(chunk, { to: to, from: from });
        } catch (error) {
          console.error('Translation error:', error);

          // text; // или другое подходящее значение по умолчанию
      }
      if (res) {
        res = res.replace(/«/g, '<<');
        res = res.replace(/»/g, '>>');
        res = res?.replace(/<<\s*(.*?)\s*>>/g,'<<$1>>');

      } else {
        res = text;
      }
       translatedText += (res + ' '); // Добавление переведенной части к полному тексту
    }

    return translatedText.trim(); // Удаление лишних пробелов в конце текста
    

}