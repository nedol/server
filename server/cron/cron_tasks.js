import fetch from 'node-fetch';
// import  generate_from_text_input from './vertex.js'
import  generate_from_text_input from './deepseek.js'

import postToLinkedIn from './linkedin.js'

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
  UpdateDialog,
  ReadSpeech,
  WriteSpeech,
  getContext,
  saveContext
} from '../db.js';

const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Добавляем 0, если месяц < 10
    const day = String(date.getDate()).padStart(2, '0'); // Добавляем 0, если день < 10
    return `${year}-${month}-${day}`;
};

import { JSDOM } from 'jsdom';

const style = `
<style>
article {
  display: block;
  background: #f9f9f9;
  padding: 20px;
  margin: 20px auto;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  max-width: 800px;
  font-family: Arial, sans-serif;
  line-height: 1.6;
}

article p {
  margin-bottom: 15px;
  color: #333;
}

article p:last-child {
  margin-bottom: 0;
}

article subj {
  font-weight: bold;
  color: rgb(49, 49, 169);
}

article ver {
  color: #e74c3c;
  font-style: italic;
}

article dirobj {
  color: #3498db;
  font-weight: bold;
}

article tijd {
  color: #27ae60;
  font-style: italic;
}

article plaats {
  color: magenta;
  font-style: italic;
}

article extra, article adv {
  color: grey;
  font-style: italic;
}

article:hover {
  background: #ffffff;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease-in-out;
}
</style>`;

export default async function generate_news() {
  try {
    // Получить шаблон запроса для новостей
    // let data = await GetPrompt(`news.ru`);
    let data = await GetPrompt(`bricks.news.${lang}`);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate()-1);
    
    const date = formatDate(today);
    // const date = formatDate(yesterday);
    
    let prompt = data.prompt.system;
    const owners = [
      "3069991b34226dbb2c9d2c0bbbf398d0",
      "7d3176310799f12e680f58c11266fd17",
      "public"
    ]

    const inputs = [
      {name:`Antwerpen Nieuws (${date})`, url:'https://www.vrt.be/vrtnws/nl/regio/antwerpen'},
      {name:`Brasschaat Nieuws (${date})`, url:'https://www.vrt.be/vrtnws/nl/regio/antwerpen/brasschaat/'},
      {name:`Kapellen Nieuws (${date})`, url:'https://www.vrt.be/vrtnws/nl/regio/antwerpen/kapellen/'},
      // {name:`Wereld Nieuws (${date})`, url:'https://www.vrt.be/vrtnws/nl/'},
      // {name:`Belgisch Nieuws (${date})`, url:'https://www.vrt.be/vrtnws/nl/kies24/'}
    ];

    // Заменить плейсхолдер даты на текущую дату
    prompt = prompt.replace(/\$\{date\}/g, date);    

    let adapted = [];

    for (const input of inputs) {

      const articles = await getNews(date,input.url); 
         
      await adaptNews_(articles, input);
    }

    async function adaptNews_(articles, input) {  
      for (const owner of owners) {  
        const levels = await getLevels(owner);  
        for (const level of levels) {  
          if(level<80)
            continue;
          const adaptedArticles = [];  
          for (const article of articles) {  
            try {  
              if (article.content.includes('Контент не найден')) continue;  
              let adaptedArticle = await adaptNews(article, prompt, level, lang, 7);  
              adaptedArticle = adaptedArticle?.replace(/```html|```xml|```|\n/g, '');  
              if (adaptedArticle) {  
                adaptedArticles.push(adaptedArticle);  
                console.log(adaptedArticle);  
              }  
            } catch (ex) {  
              console.error('Ошибка при адаптации статьи:', ex);  
            }  
          }  
          if(adaptedArticles.length>0)
            await handleNews(articles, adaptedArticles, owner, input, level, lang);  
        }  
      }  
    }  


  console.log('News completed');

  } catch (error) {
    console.error("Ошибка при генерации новостей:", error);
  }
}



async function getNews(date, url, content = 'link', newsContent = [], browser = null, maxLinks = 10) {
  let isBrowserOwner = false;

  const formatDate = (date) => {
    const today = new Date(date);
    return `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
  };

  const extractLinks = async (page, currentDate) => {
    return await page.evaluate((currentDate) => {
      return [...new Set(
        Array.from(document.querySelectorAll(`a[href*="${currentDate}"]`)).map(h => h.href.trim())
      )];
    }, currentDate);
  };

  const extractArticleContent = async (page) => {
    return await page.evaluate(() => {
      const elements = document.querySelectorAll('.cmp-text');
      return elements.length
        ? Array.from(elements)
            .map(t => t.textContent.trim())
            .filter(text => text.length > 0)
            .join('\n')
        : 'Контент не найден';
    });
  };

  if (!browser) {
    browser = await puppeteer.launch({ headless: 'new' });
    isBrowserOwner = true;
  }

  let page;
  try {
    page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (content === 'link') {
      const links = await extractLinks(page, formatDate(date));
      const limitedLinks = links.slice(0, maxLinks).filter(link => !link.includes('/kijk/'));

      const results = await Promise.allSettled(
        limitedLinks.map(link => getNews(date, link, 'content', [], browser))
      );

      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled' && results[i].value.length > 0) {
          newsContent.push({
            link: limitedLinks[i],
            content: results[i].value[0].content,
          });
        } else {
          newsContent.push({ link: limitedLinks[i], content: 'Ошибка загрузки контента' });
        }
      }
    } else if (!url.includes('/kijk/')) {
      newsContent.push({ link: url, content: await extractArticleContent(page) });
    }
  } catch (error) {
    console.error('Ошибка при обработке страницы:', error);
  } finally {
    try {
      if (page && !page.isClosed()) {
        await page.close();
      }
    } catch (err) {
      console.error('Ошибка при закрытии страницы:', err);
    }

    try {
      if (isBrowserOwner && browser) {
        await browser.close();
      }
    } catch (err) {
      console.error('Ошибка при закрытии браузера:', err);
    }
  }

  return newsContent;
}


// Получить статьи
async function handleNews (original, content, owner, inputData, level, lang){
    // Сохранить результат

    console.log(content)
    
    await createBrickAndUpdateLesson({
      theme: "Nieuws", 
      name: inputData.name, 
      owner:  owner,
      html: content,
      level: level.level,
      type: 'news'
    });

    let dlg_propmt = await GetPrompt(`dialog.news.ru`);
    dlg_propmt = dlg_propmt.prompt.system ;

    content = content;

    dlg_propmt = dlg_propmt.replaceAll('${text}', "```"+JSON.stringify(content)+"```")
    .replaceAll('${lang}', lang)
    .replaceAll('${level}', level);

    // console.log(dlg_propmt);

    const dlg = await generate_from_text_input(dlg_propmt);

    await UpdateDialog({
      theme:"Nieuws",
      name: inputData.name, 
      dialog: dlg,
      owner:  owner,
      html: content,
      level: level.level,
      type:'news'
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
      // for (const sentence of sentences) {
      //   try {
      //     await tts_google(sentence, lang, owner, inputData.name);
      //   } catch (error) {
      //     console.error('Error processing sentence:', sentence, error);
      //   }
      // }
    }
}

async function adaptNews(article, prompt, level, lang = 'nl', qnty = 8) {
  if (!article) return null; // Явный возврат, если статьи нет

  // Форматируем prompt с подстановкой значений
  const formattedPrompt = prompt
    .replaceAll('${text}', '```' + JSON.stringify(article) + '```')
    .replaceAll('${lang}', lang)
    .replaceAll('${qnty}', qnty)
    .replaceAll('${level}', level.level);

  console.log(formattedPrompt)  

  // Проверяем наличие `generate_from_text_input`
  if (typeof generate_from_text_input !== 'function') {
    console.error('Функция generate_from_text_input не определена.');
    return null;
  }

  // Адаптация новостей
  return await generate_from_text_input(formattedPrompt);
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


