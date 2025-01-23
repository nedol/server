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
  if (!text) return '';

  // Удаляем лишние символы новой строки
  text = text.replace(/\r\n/g, ' ');

  // Разбиваем текст на предложения
  const sentences = text.split(/(?<=[.!?])\s+/);
  let translatedText = '';

  // Формируем группы из трёх предложений
  for (let i = 0; i < sentences.length; i += 3) {
    const chunkGroup = sentences.slice(i, i + 3).join(' ').trim();
    if (!chunkGroup || chunkGroup=='"') continue;

    let chunk = chunkGroup.replaceAll('"','');
    let res = '';

    // Проверяем наличие << >> и заменяем на безопасные символы
    const hasQuotes = chunk.includes('<<');
    if (hasQuotes) {
      chunk = chunk.replace(/<</g, '[').replace(/>>/g, ']');
    }

    // Попытка перевода через Google Translate API
    try {
      res = await translate(chunk, { to, from });
    } catch (error) {
      console.error('Translation error:', error);
      res = chunk; // Если перевод не удался, возвращаем оригинальный текст
    }

    // Восстанавливаем << >> после перевода
    if (hasQuotes) {
      res = res.replace(/\[(.*?)\]/g, '<<$1>>')                                                       
    }

    translatedText += `${res} `;
  }

  // Убираем лишние пробелы
  return translatedText.trim();
}