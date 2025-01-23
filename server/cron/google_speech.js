import * as googleTTS from 'google-tts-api';

import whisper from  whisper-node


import {
  WriteSpeech
} from '../db.js';

export default async function tts_google(text, lang, abonent, quiz) {
    try {
      // Генерируем md5-хеш для текста
      const fileName = md5(text) + '.mp3';
      const filePath = join(audioDir, fileName); // Полный путь к файлу
  
      // Проверяем наличие файла
      const resp =  await ReadSpeech({ key: md5(text) });
      if (resp.data) {
        console.log(`Файл уже существует`);
        
        return {audio:'data:audio/mpeg;base64,' + resp.data, ts:resp.timestamps};
      }
  
      const url_b64 = await googleTTS.getAllAudioBase64(text, {
        //getAudioUrl(text, {
        lang: lang,
        slow: false,
        host: 'https://translate.google.com',
        timeout: 10000,
      });
  
      let timestamps = []
  
      await processAudio('data:audio/mpeg;base64,' + url_b64[0].base64)
      .then((ts) => {
        console.log('Silence timestamps:', ts);
        timestamps = ts
      })
      .catch((error) => {
        console.error('Error:', error);
      })  
  
      let base64 = '';
  
      url_b64.map((e) => {
        base64 += e.base64;
      });
  
      WriteSpeech({ lang: lang, key: md5(text), text: text, data: base64, quiz:quiz, timestamps:timestamps });
  
      // Записываем аудиофайл в директорию
      // await fs.outputFile(filePath, Buffer.from(url, 'base64')); // Запись файла в папку audio
      console.log(`Файл сохранён`);

      transcribeAudio("audio.mp3")
      .then((text) => console.log("Transcription:", text))
      .catch((error) => console.error("Error:", error));
  
      // Читаем содержимое только что сохранённого файла и возвращаем его в формате base64
      return  {audio:'data:audio/mpeg;base64,' + base64, ts:timestamps}
    } catch (error) {
      console.error('Error converting text to speech:', error);
    }
  }
  
  const transcribeAudio = (audioPath) => {
    return new Promise((resolve, reject) => {
      exec(`python whisper_transcribe.py "${audioPath}"`, (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }
        resolve(stdout.trim());
      });
    });
  }