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
    const day = String(date.getDate()).padStart(2, '0'); // Добавляем 0, если день < 10
    return `${year}-${month}-${day}`;
};

import { JSDOM } from 'jsdom';

export default async function generate_news() {
  try {
    // Получить шаблон запроса для новостей
    let data = await GetPrompt(`news.${lang}`);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate()-1);
    const date = formatDate(today);
    let prompt = data.prompt.system;
    const owners = [/*"3069991b34226dbb2c9d2c0bbbf398d0",*/"7d3176310799f12e680f58c11266fd17"]

    for(const o in owners){

      const levels = await getLevels(owners[o]);

      const inputs = [
        {name:`Antwerpen Nieuws (${date})`, url:'https://www.vrt.be/vrtnws/nl/regio/antwerpen'},
        // {name:`Belgisch Nieuws (${date})`, url:'https://www.vrt.be/vrtnws/nl/'},
        // {name:`Belgisch Nieuws (${date})`, url:'https://www.vrt.be/vrtnws/nl/kies24/'}
      ];

      // Заменить плейсхолдер даты на текущую дату
      prompt = prompt.replace(/\$\{date\}/g, date);

      let adapted = []

      for (const input of inputs) {
        const articles = await getNews(input.url);
        for(const l in levels){
          for(const a in articles){
            try{
              adapted.push(await adaptNews(articles[a].content, prompt, levels[l], lang, 5));  // Ensure each news item is processed sequentially
              // break;
              
            }catch(ex){
              console.log()
            }
          }  
          handleNews(articles, adapted, owners[o], input, levels[l], lang);
        }
    
      }
    }

  } catch (error) {
    console.error("Ошибка при генерации новостей:", error);
  }
}

async function getNews(url, content = 'link', newsContent = new Set(), browser = null) {
  const feedUrl = url;
  let isBrowserOwner = false;

  if (!browser) {
    browser = await puppeteer.launch({ headless: 'new' });
    isBrowserOwner = true;
  }

  let page;
  try {
    page = await browser.newPage();
    await page.goto(feedUrl, { waitUntil: 'domcontentloaded' });

    if (content === 'link') {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const currentDate = `${year}/${month}/${day}`;

      const links = await page.evaluate((currentDate) => {
        return Array.from(document.querySelectorAll(`a[href*="${currentDate}"]`))
          .map(h => h.href.trim())
          .filter((value, index, self) => self.indexOf(value) === index); // Удаление дубликатов
      }, currentDate);

      console.log('Найдено ссылок:', links);
      await Promise.all(links.slice(0, 8).map(link => getNews(link, 'content', newsContent, browser)));
    } else {
      const content = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.cmp-text'))
          .map(t => t.textContent.trim())
          .filter(text => text.length > 0);
      });

      newsContent.add(JSON.stringify({ url, content })); // Добавление в Set для удаления дубликатов
    }
  } catch (error) {
    console.error('Ошибка при обработке страницы:', error);
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (error) {
        console.error('Ошибка при закрытии страницы:', error);
      }
    }

    if (isBrowserOwner) {
      try {
        if (browser.isConnected()) {
          await browser.close();
        }
      } catch (error) {
        console.error('Ошибка при закрытии браузера:', error);
      }
    }
  }

  return Array.from(newsContent).map(JSON.parse); // Преобразование обратно в массив
}

  // Получить статьи
  async function handleNews (original, content, owner, inputData, level, lang){
    // Сохранить результат
    
    createBrickAndUpdateLesson({
      theme: "Belgisch Nieuws", 
      name: inputData.name, 
      owner:  owner,
      html: content,
      level: level.level,
      original: original
    });

    function extractParagraphs(htmlString) {
        const dom = new JSDOM(htmlString);
        const paragraphs = dom.window.document.querySelectorAll('p');
        
        // Convert NodeList to Array and extract text content
        return Array.from(paragraphs).map(p => p.textContent.trim());
    }
      

    // Extract paragraphs from the HTML string
    const paragraphs = extractParagraphs(content);

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
}

async function adaptNews (article, prompt, level, lang='nl', qnty=5) {

    if (article.length > 0) {
      // Получить контент статей
      const content = article.map((item) => {
        if (item) return item;
      });
    
    // Заменить плейсхолдер ${text} в prompt
    prompt = prompt.replaceAll('${text}', "```"+JSON.stringify(content)+"```")
      .replaceAll('${lang}', lang)
      .replaceAll('${qnty}', qnty)
      .replaceAll('${level}', level.level);

    // Адаптировать статьи для B1.1 уровня и форматировать в HTML
    const adaptedData = await generate_from_text_input(prompt);
    return adaptedData.candidates[0].content.parts[0].text;
  }
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


