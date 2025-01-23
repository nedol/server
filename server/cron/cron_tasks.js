import fetch from 'node-fetch';
import  generate_from_text_input from './vertex.js'
import { config } from 'dotenv';
config();

import fs from 'fs';
import pkg_l from 'lodash';
const { find, findKey } = pkg_l;

import md5 from 'md5'
import path from 'path';
import { dirname, join } from 'path'; // Импортируем join вместе с dirname
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import * as googleTTS from 'google-tts-api';

const lang = 'nl'
import { Buffer } from 'buffer';

import puppeteer from 'puppeteer';
import { exec } from "child_process";
// import whisper from "whisper-node";

let news_content = []
let browser = ''

import {
	GetPrompt, 
  getLevels,
  createBrickAndUpdateLesson,
  ReadSpeech,
  WriteSpeech
} from '../db.js';

const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Добавляем 0, если месяц < 10
    const day = String(date.getDate()-1).padStart(2, '0'); // Добавляем 0, если день < 10
    return `${year}-${month}-${day}`;
};

import { JSDOM } from 'jsdom';


export default async function generate_news() {
  try {
    // Получить шаблон запроса для новостей
    let data = await GetPrompt('news');
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const date = formatDate(tomorrow);
    let prompt = data.prompt.system;
    const owners = ["3069991b34226dbb2c9d2c0bbbf398d0","7d3176310799f12e680f58c11266fd17"];

    for(const o in owners){

      const levels = await getLevels(owners[o]);

      const inputs = [
        {name:`Antwerpen Nieuws (${date})`, url:'https://www.vrt.be/vrtnws/nl/regio/antwerpen'},
        // {name:`Belgisch Nieuws (${date})`, url:'https://www.vrt.be/vrtnws/nl/'},
        // {name:`Belgisch Nieuws (${date})`, url:'https://www.vrt.be/vrtnws/nl/kies24/'}
      ];

      // Заменить плейсхолдер даты на текущую дату
      prompt = prompt.replace(/\$\{date\}/g, date);

      for (const input of inputs) {
        const articles = await getNews(input.url);
        for(const l in levels){
          try{
            await handleNews(articles,owners[o], input, prompt, levels[l], lang);  // Ensure each news item is processed sequentially
          }catch(ex){
            console.log()
          }
        }
      }
    }

  } catch (error) {
    console.error("Ошибка при генерации новостей:", error);
  }
}

async function getNews(url, content = 'link', newsContent = [], browser = null) {
  const feedUrl = url;

  // Открываем браузер, если он ещё не открыт
  if (!browser) {
    browser = await puppeteer.launch({ headless: true });
  }

  let page;
  try {
    page = await browser.newPage();
    await page.goto(feedUrl, { waitUntil: 'domcontentloaded' });

    if (content === 'link') {
      // Получение текущей даты в формате ГГГГ/ММ/ДД
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');

      // Формирование строки даты
      const currentDate = `${year}/${month}/${day}`;
      // Извлечение ссылок новостей
      const links = await page.evaluate((currentDate) => {
        return Array.from(document.querySelectorAll(`a[href*="${currentDate}"]`)).map(h => h.href.trim());
      }, currentDate);

      console.log('Найдено ссылок:', links);
      let cnt = 0;
      // Асинхронно обрабатываем каждую ссылку
      for (const link of links) {
        await getNews(link, 'content', newsContent, browser);
        if (cnt++ >= 7) break;  // Ограничение на количество ссылок
        
      }

      // Закрытие браузера, если это последний вызов
      try {
        if (browser.isConnected()) {
          await browser.close();
        }
      } catch (error) {
        console.error('Ошибка при закрытии браузера:', error);
      }

      return newsContent;

    } else {
      // Извлечение контента
      const content = await page.evaluate(() => {
        const arr = Array.from(document.querySelectorAll('.cmp-text'));
        return arr.map(t => t.innerHTML.replaceAll('“', '').replaceAll('”', '').trim());
      });

      newsContent.push({ url, content });
      // console.log(`Контент из ${url}:`, content);

      if (page) {
        try {
          await page.close(); // Закрытие страницы
        } catch (error) {
          console.error('Ошибка при закрытии страницы:', error);
        }
      }
    }

  } catch (error) {
    console.error('Ошибка при обработке страницы:', error);
  } finally {
    // Можно добавить дополнительные действия для очистки ресурсов, если необходимо
  }
}

async function handleNews (articles, owner, inputData,prompt, level, lang){
  // Получить статьи


  if (articles.length > 0) {
    // Получить контент статей
    const content = articles.map((item) => {
      if (item.content) return item.content;
    });

    const adaptedData = await adaptNews(prompt, content, level, lang);
    // Сохранить результат
    const htmlString = adaptedData.candidates[0].content.parts[0].text;

    createBrickAndUpdateLesson({
      theme: "Belgisch Nieuws", 
      name: inputData.name, 
      owner:  owner,
      html: htmlString,
      level: level.level,
      original: content
    });

    function extractParagraphs(htmlString) {
        const dom = new JSDOM(htmlString);
        const paragraphs = dom.window.document.querySelectorAll('p');
        
        // Convert NodeList to Array and extract text content
        return Array.from(paragraphs).map(p => p.textContent.trim());
    }
      

    // Extract paragraphs from the HTML string
    const paragraphs = extractParagraphs(htmlString);

    for (const text of paragraphs) {
      const sentences = text.split(/(?<=[.?!])\s/);
      
      // Process each sentence sequentially
      for (const sentence of sentences) {
        try {
          await tts_google(sentence, lang, owner, inputData.name);
        } catch (error) {
          console.error('Error processing sentence:', sentence, error);
        }
      }
    }

  } else {
    console.log("Нет новостей для отображения.");
  }
}

async function adaptNews (prompt, content, level = 'B1.1', lang = 'nl') {
  // Заменить плейсхолдер ${text} в prompt
  prompt = prompt.replaceAll('${text}', JSON.stringify(content))
                  .replaceAll('${lang}', lang)
                  .replaceAll('${level}', level.level);


    // Адаптировать статьи для B1.1 уровня и форматировать в HTML
    return await generate_from_text_input(prompt);
}


async function tts_google(text, lang, abonent, quiz) {
    try {
      // Генерируем md5-хеш для текста
      // const fileName = md5(text) + '.mp3';
      // const filePath = join(audioDir, fileName); // Полный путь к файлу
  
      // Проверяем наличие файла
      const resp =  await ReadSpeech({ key: md5(text) });
      if (resp?.data) {
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
  
      const ts = await processAudio('data:audio/mpeg;base64,' + url_b64[0].base64)
      .then((ts) => {
        console.log('Silence timestamps:', ts.result);
        if(ts)
          timestamps = ts
      })
      .catch((error) => {
        console.error('Error:', error);
      })  
  
      let base64 = '';
  
      url_b64.map((e) => {
        base64 += e.base64;
      });
  
      WriteSpeech({ lang: lang, key: md5(text), text: text, data: base64, quiz:quiz, timestamps:timestamps.result.segments[0].words });
  
      // Записываем аудиофайл в директорию
      // await fs.outputFile(filePath, Buffer.from(url, 'base64')); // Запись файла в папку audio
      // console.log(`Файл сохранён`);
  
      // Читаем содержимое только что сохранённого файла и возвращаем его в формате base64
      return  {audio:'data:audio/mpeg;base64,' + base64, ts:timestamps}

    } catch (error) {
      console.error('Error converting text to speech:', error);
    }
  }



  const transcribeAudio = (audioPath) => {
    
    return new Promise((resolve, reject) => {
      // Полный путь к whisper_transcribe.py
    const scriptPath = path.join(__dirname, '', 'whisper_transcribe.py');
      exec(`python "${scriptPath}" "${audioPath}"`, (error, stdout, stderr) => {
        if (error) {
          return reject(error); 
        }
  
        // Парсим результат JSON
        const result = JSON.parse(stdout.trim());
  
        // Получаем текст
        const text = result.text;
  
        // Получаем временные метки
        // const segments = result.segments.map(segment => ({
        //   start: segment.start,  // Начало сегмента
        //   end: segment.end,      // Конец сегмента
        //   text: segment.text     // Текст сегмента
        // }));
  
        resolve({ text, result});
      });
    });
  };
  

// Основная серверная функция
async function processAudio(base64Str) {

  const audioFilePath = path.resolve(__dirname, 'audio.mp3');
  const tempFilePath = path.resolve(__dirname, 'temp_output.mp3');

  try {
    // Удаляем временный файл, если он существует
    if (fs.existsSync(tempFilePath)) {
      await fs.promises.unlink(tempFilePath);  // Асинхронное удаление файла
    }

    // Конвертируем Base64 в аудиофайл
    await base64ToMpeg(base64Str, audioFilePath);

    // Пример использования транскрипции
    const { text, result } = await transcribeAudio(audioFilePath);

    console.log("Транскрипция:", text);
    console.log("Сегменты с временными метками:", result.segments[0].words);

    return { text, result };
    
  } catch (error) {
    console.error("Ошибка при обработке аудио:", error);
    throw error;  // Бросаем ошибку, если что-то пошло не так
  }
}

function base64ToMpeg(base64Str, filePath) {
  // Убираем префикс данных, если он есть (например, "data:audio/wav;base64,")
  const base64Data = base64Str.replace(/^data:audio\/mpeg;base64,/, '');
  
  // Декодируем строку Base64 в буфер
  const buffer = Buffer.from(base64Data, 'base64');
  
  // Записываем буфер в файл
  fs.writeFile(filePath, buffer, (err) => {
      if (err) {
          console.error('Ошибка записи файла:', err);
      } else {
          console.log('Файл сохранён:', filePath);
      }
  });
}


