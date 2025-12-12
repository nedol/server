// import  generate_from_text_input from './vertex.js'
import generate_from_text_input from './openrouter.js'
// import  generate_from_text_input from './gemini.js'
// import  generate_from_text_input from './deepseek.js'
// import  generate_from_text_input from './hf.js'

import { logger, GetCefrScale, GetCefrLevelName } from '../../utils.js';

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
  GetGrammar,
  GetGrammarRegion,
  GetGrammarRegionToLevel,
  getLevels,
  GetLevelCriteria,
  GetLevelTopWords,
  createBrickAndUpdateLesson,
  UpdateDialog,
  ReadSpeech,
  WriteSpeech,
  SaveArticle
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
  
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const now = new Date();
    const hours = now.getHours();
    
    // Use yesterday's date if running before 18:00, otherwise use today's date
    const date = hours < 13 ? formatDate(yesterday) : formatDate(today);

    const owners = [
      // "3069991b34226dbb2c9d2c0bbbf398d0",
      // "7d3176310799f12e680f58c11266fd17",
      "public"
    ]

    function formatDayMonth(date) {
      const day = String(date.getDate()).padStart(2, '0'); // день с ведущим нулем
      const month = String(date.getMonth() + 1).padStart(2, '0'); // месяц с ведущим нулем
      return `${day}.${month}`; // формат: "дд.мм"
    }

    const inputs = [
      // {name:`De Standaard Nieuws (${date})`, url:'https://www.standaard.be/net-binnen/'}
      // {name:`Locale Nieuws (${date})`, url:'https://www.vrt.be/vrtnws/nl/regio/antwerpen'},
      // {name:`Brasschaat Nieuws (${date})`, url:'https://www.vrt.be/vrtnws/nl/regio/antwerpen/brasschaat/'},
      // {name:`Kapellen Nieuws (${date})`, url:'https://www.vrt.be/vrtnws/nl/regio/antwerpen/kapellen/'},
      { name: `Nieuws (${date})`, url: 'https://www.vrt.be/vrtnws/nl/' },
      // {name:`Belgisch Nieuws (${date})`, url:'https://www.vrt.be/vrtnws/nl/kies24/'}
    ];


    for (const input of inputs) {

      const articles = await getNews(date, input.url,20);

      await adaptNews_(articles, input);
    }

    async function adaptNews_(articles, input) {
      for (const owner of owners) {
        const levels = await getLevels(owner);
        for (let level of levels) {
          if (!level)// || level!==20)
            continue;

          let level_prompt = await GetPrompt(`news.adapt.${lang}.${level}`);
          let prompt = await GetPrompt(`news.adapt.${lang}`);

          const adaptedArticles = [];
          // Keep track of processed article hashes to avoid duplicates
          const processedArticleHashes = new Set();
          // Keep track of processed links to avoid duplicates
          const processedLinks = new Set();

          for (const article of articles) {
            try {
              if (article.content.includes('Контент не найден')) {
                console.log('Content not found for article:', article.link);
                continue;
              }
              
              // Check for error messages in content
              if (article.content.includes('Ошибка:')) {
                console.log('Error content found for article:', article.link, article.content);
                continue;
              }
              
              // Create a hash of the content to detect duplicates
              const contentHash = md5(article.content);
              if (processedArticleHashes.has(contentHash)) {
                console.log('Skipping duplicate article content:', contentHash);
                continue;
              }
              
              // Check if we've already processed this link
              if (processedLinks.has(article.link)) {
                console.log('Skipping duplicate article link:', article.link);
                continue;
              }

              const grammar = await GetGrammarRegion({ level: level});
              // const grammar = await GetGrammarRegionToLevel({ level: level});

              // Check if grammar[0].region exists before mapping
              const kolmit_scale = grammar.region

              const ruleNamesWithExamples = grammar.region.map(rule => ({
                rule_name: rule.rule_name,
                examples: rule.examples
              }));

              const top_words = await GetLevelTopWords(level, 20);

              let systemPrompt =  prompt.prompt.system.replaceAll(/\${level_prompt}/g, level_prompt.prompt.system);

              // Get the CEFR level name based on the numerical level
              const cefrLevelName = await GetCefrLevelName(level);

              const cefrScale = await GetCefrScale();

              // Форматируем prompt с подстановкой значений
              systemPrompt = systemPrompt
                .replaceAll('${text}', article.content )
                .replaceAll('${level}', level)
                .replaceAll('${top_words}', top_words.join(', '))
                .replaceAll('${cefr_scale}',  cefrScale)
                // .replaceAll('${cefr_level_name}', cefrLevelName)
                .replaceAll('${llang}', lang)
                .replaceAll('${langs}', 'ru')
                .replaceAll('${qnty}', 10)
                .replaceAll('${kolmit_scale}', JSON.stringify(ruleNamesWithExamples) || '')
                .replaceAll(/\$\{date\}/g, date);

              console.log(JSON.stringify(systemPrompt));

              let adaptedArticle = await adaptNews({ user: systemPrompt, system: '' }, article.content);
              
              if (adaptedArticle) {
                // At this point, adaptedArticle should already be validated JSON
                let json_article = adaptedArticle;
                
                // Validate the JSON structure before proceeding
                if (!json_article || !json_article.result) {
                  console.error('Invalid JSON structure: missing result property');
                  console.log('Received JSON:', JSON.stringify(json_article, null, 2));
                  continue;
                }
                
                if (!json_article.result.article) {
                  console.error('Invalid JSON structure: missing result.article property');
                  console.log('Received JSON structure:', JSON.stringify(json_article, null, 2));
                  continue;
                }
                
                if (!json_article.result.article.content || !Array.isArray(json_article.result.article.content)) {
                  console.error('Invalid JSON structure: missing or invalid article content');
                  console.log('Received JSON structure:', JSON.stringify(json_article, null, 2));
                  continue;
                }
                
                // POST-PROCESSING: Validate word frequency in generated content
                try {
                  // Import the validation function
                  const subtlexModule = await import('../subtlex.js');
                  
                  // Check if the module and function exist
                  if (!subtlexModule || typeof subtlexModule.validateTextFrequency !== 'function') {
                    throw new Error('validateTextFrequency is not a function or module not loaded properly');
                  }
                  
                  const { validateTextFrequency } = subtlexModule;
                  const levelThreshold = level * 50;
                  
                  console.log(`Validating word frequency for level ${level} (threshold: ${levelThreshold})`);
                  
                  // Check each sentence in the content
                  let validationIssues = [];
                  // Add validation for content array
                  if (json_article.result.article.content && Array.isArray(json_article.result.article.content)) {
                    for (let i = 0; i < json_article.result.article.content.length; i++) {
                      const sentence = json_article.result.article.content[i];
                      // Add validation for sentence
                      if (typeof sentence === 'string' && sentence.length > 0) {
                        const validationResult = await validateTextFrequency(sentence, levelThreshold);
                       
                        if (!validationResult.allWordsInTopN) {
                          const invalidWords = validationResult.invalidWords.map(w => `${w.word}(${w.rank || 'unknown'})`).join(', ');
                          validationIssues.push(`Sentence ${i+1}: ${invalidWords}`);
                        }
                      } else {
                        console.warn(`Warning: Skipping invalid sentence at index ${i}`, sentence);
                      }
                    }
                  } else {
                    console.warn('Warning: Article content is not a valid array', json_article.result.article.content);
                  }
                  
                  if (validationIssues.length > 0) {
                    console.warn(`⚠️  Words outside frequency range detected in generated content:`);
                    validationIssues.forEach(issue => console.warn(`  - ${issue}`));
                   
                    // Log the full article for review
                    console.warn('Full article content:');
                    if (json_article.result.article.content && Array.isArray(json_article.result.article.content)) {
                      json_article.result.article.content.forEach((sentence, idx) => {
                        console.warn(`  ${idx+1}. ${sentence}`);
                      });
                    }
                  } else {
                    console.log('✅ All words are within the allowed frequency range');
                  }
                } catch (validationError) {
                  console.warn('⚠️  Could not validate word frequency (validation module not available):', validationError.message);
                  console.warn('⚠️  Word frequency validation requires SUBTLEX-NL data. Ensure the subtlex database table is populated.');
                }

                //
                
                // Create a hash of the adapted content to detect duplicates
                // Clean the JSON before stringifying to remove any markdown code blocks

                const adaptedContentString = JSON.stringify(json_article);
                const adaptedContentHash = md5(adaptedContentString);
                
                if (processedArticleHashes.has(adaptedContentHash)) {
                  console.log('Skipping duplicate adapted article content:', adaptedContentHash);
                  continue;
                }
                
                // Mark this content and link as processed
                processedArticleHashes.add(contentHash);
                processedArticleHashes.add(adaptedContentHash);
                processedLinks.add(article.link);
                
                // Validate article structure before pushing
                if (json_article.result.article) {
                  adaptedArticles.push(json_article.result.article);
                } else {
                  console.error('Cannot push article: missing article structure');
                  continue;
                }

                // Validate content structure before mapping
                let content = [];
                if (json_article.result.article.content && Array.isArray(json_article.result.article.content)) {
                  content = json_article.result.article.content.map(element => {
                    return element; // или element.text, или другая обработка
                  });
                } else {
                  console.warn('Warning: Article content is not a valid array, using empty array');
                  content = [];
                }

                logger.logPrompt('text_'+(content.type || 'default'), systemPrompt);        
                logger.logPromptResult('text_'+(content.type || 'default'), json_article);

                console.log(JSON.stringify("Результат:"+JSON.stringify( json_article)));

                // Validate all required properties before saving
                if (json_article.result.article.name && 
                    json_article.result.article.content && 
                    json_article.result.article.type) {
                  await SaveArticle(
                    input.name,
                    json_article.result.article.name,
                    json_article.result.article.content,
                    level,
                    json_article.result.article.type,
                    article.link,
                    adaptNews.lastUsedModel // Add the model name
                  );
                } else {
                  console.error('Cannot save article: missing required properties', {
                    hasName: !!json_article.result.article.name,
                    hasContent: !!(json_article.result.article.content && Array.isArray(json_article.result.article.content)),
                    hasType: !!json_article.result.article.type
                  });
                  continue;
                }

                console.log('Successfully adapted article:', article.link);
              } else {
                console.log('No adapted content returned for article:', article.link);
              }

            } catch (ex) {
              console.error('Ошибка при адаптации статьи:', article.link, ex);
              // Continue with the next article instead of stopping the whole process
              continue;
            }
          }
          if (adaptedArticles.length > 0)
            await handleNews(articles, adaptedArticles, owner, input, level, lang);
        }

        break;//test
      }
    }


    console.log('News completed');

  } catch (error) {
    console.error("Ошибка при генерации новостей:", error);
  }
}

async function getNews(date, url,  maxLinks = 20, content = 'link', newsContent = [], browser = null) {
  let isBrowserOwner = false;

  const formatDate = (date) => {
    const today = new Date(date);
    return `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
  };

  const extractLinks = async (page, currentDate) => {
    // Wait a bit for dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    return await page.evaluate((currentDate) => {
      return [...new Set(
        Array.from(document.querySelectorAll(`a[href*="${currentDate}"]`))
          .map(h => h.href.trim())
          .filter(href => href && !href.includes('/kijk/'))
      )];
    }, currentDate);
  };

  const extractArticleContent = async (page) => {
    return await page.evaluate(() => {
      const selectors = [
        '.article__body',
        '.cmp-text',
        '.article-body',
        '.body-text',
        '.article-content',
        'article',
        'main',
        '[class*="content"]',
        '[class*="article"]',
        '[class*="body"]'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length) {
          const texts = Array.from(elements)
            .map(el => el.textContent.trim())
            .filter(text => text.length > 50);

          if (texts.length) {
            return texts.join('\n\n');
          }
        }
      }

      // Try to get content from VRT specific selectors
      const vrtSelectors = [
        '.vrt-article__body',
        '.article__text',
        '.text-body'
      ];
      
      for (const selector of vrtSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length) {
          const texts = Array.from(elements)
            .map(el => el.textContent.trim())
            .filter(text => text.length > 50);

          if (texts.length) {
            return texts.join('\n\n');
          }
        }
      }

      const bodyText = document.body.textContent.trim();
      return bodyText.length > 50 ? bodyText : 'Контент не найден';
    });
  };

  if (!browser) {
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    isBrowserOwner = true;
  }

  let page;
  try {
    page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);
    await page.setDefaultTimeout(60000);
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setJavaScriptEnabled(true);

    if (content === 'link') {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const links = await extractLinks(page, formatDate(date));
      const limitedLinks = links.slice(0, maxLinks);

      const results = await Promise.allSettled(
        limitedLinks.map(link => getNews(date, link, maxLinks, 'content', [], browser))
      );

      // Keep track of unique links to avoid duplicates
      const uniqueLinks = new Set();
      
      for (let i = 0; i < results.length; i++) {
        const link = limitedLinks[i];
        
        // Skip if we've already processed this link
        if (uniqueLinks.has(link)) {
          console.log('Skipping duplicate link:', link);
          continue;
        }
        
        uniqueLinks.add(link);
        
        if (results[i].status === 'fulfilled' && results[i].value.length > 0) {
          newsContent.push({
            link: link,
            content: results[i].value[0].content,
          });
        } else {
          newsContent.push({
            link: link,
            content: results[i].status === 'rejected'
              ? `Ошибка: ${results[i].reason.message}`
              : 'Контент не найден'
          });
        }
      }
    } else {
      // Try multiple navigation strategies for problematic URLs with increased timeouts
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      } catch (navigationError) {
        console.warn(`Primary navigation failed for ${url}, trying alternative method:`, navigationError.message);
        try {
          // Alternative navigation with longer timeout and different wait condition
          await page.goto(url, { waitUntil: 'load', timeout: 60000 });
        } catch (altNavigationError) {
          console.warn(`Alternative navigation failed for ${url}:`, altNavigationError.message);
          try {
            // Try with networkidle0 for more complete loading
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
          } catch (networkError) {
            console.warn(`Network idle navigation failed for ${url}:`, networkError.message);
            // Even if navigation "fails", try to extract content anyway
          }
        }
      }

      // Wait for page to load with multiple strategies
      try {
        await page.waitForSelector('body', { timeout: 30000 });
      } catch (e) {
        console.warn(`Body selector wait failed for ${url}:`, e.message);
      }

      // Try to handle cookie consent popups with more specific selectors
      try {
        await page.click('button[id*="accept"], button[class*="consent"], button[class*="cookie"], .cookie-banner button, #cookie-accept, .js-cookie-button', { timeout: 10000 });
        // Wait a bit after clicking
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) { 
        // Not all pages have cookie banners, so this is fine
        // This is debug info, not an error - only show for actual debugging
        // console.debug('No cookie consent popup found or error clicking it:', e.message);
      }

      const articleContent = await extractArticleContent(page);
      newsContent.push({ link: url, content: articleContent });
    }
  } catch (error) {
    console.error(`Ошибка при обработке ${url}:`, error);
    newsContent.push({ link: url, content: `Ошибка: ${error.message}` });
  } finally {
    try {
      if (page && !page.isClosed()) {
        await page.close();
      }
    } catch (err) {
      console.error('Ошибка при закрытии страницы:', err);
    }

    if (isBrowserOwner && browser) {
      try {
        await browser.close();
      } catch (err) {
        console.error('Ошибка при закрытии браузера:', err);
      }
    }
  }

  return newsContent;
}



async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 500;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 300);
    });
  });
}

async function getNewsStandaard(date, url, content = 'link', newsContent = [], browser = null, maxLinks = 10) {
  let isBrowserOwner = false;

  const extractLinks = async (page) => {
    await page.waitForSelector('a[href*="/cnt/"]', { timeout: 10000 });

    return await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/cnt/"]'));
      const links = anchors
        .map(a => a.href.startsWith('http') ? a.href : `https://www.standaard.be${a.getAttribute('href')}`)
        .filter((href, index, self) => self.indexOf(href) === index);
      return links;
    });
  };

  const extractArticleContent = async (page) => {
    return await page.evaluate(() => {
      const selectors = [
        '[class*="article__body"]',
        '[class*="article-body"]',
        '[class*="content"]',
        '.ds-c-article__body',
        'article',
        'main'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length) {
          const texts = Array.from(elements)
            .map(el => el.innerText.trim())
            .filter(text => text.length > 50);
          if (texts.length) {
            return texts.join('\n\n');
          }
        }
      }

      const bodyText = document.body.innerText.trim();
      return bodyText.length > 50 ? bodyText : 'Контент не найден';
    });
  };

  if (!browser) {
    browser = await puppeteer.launch({ headless: 'new' });
    isBrowserOwner = true;
  }

  let page;
  try {
    page = await browser.newPage();
    await page.setDefaultNavigationTimeout(60000);
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setJavaScriptEnabled(true);

    if (content === 'link') {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

      // Прокрутка страницы вниз
      await autoScroll(page);

      const links = await extractLinks(page);
      console.log(`Найдено ссылок: ${links.length}`);

      const limitedLinks = links.slice(0, maxLinks);
      const results = await Promise.allSettled(
        limitedLinks.map(link => getNewsStandaard(date, link, 'content', [], browser))
      );

      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled' && results[i].value.length > 0) {
          newsContent.push({
            link: limitedLinks[i],
            content: results[i].value[0].content,
          });
        } else {
          newsContent.push({
            link: limitedLinks[i],
            content: results[i].status === 'rejected'
              ? `Ошибка: ${results[i].reason.message}`
              : 'Контент не найден'
          });
        }
      }

    } else {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

      try {
        await page.click('button[id*="accept"], button[class*="consent"], button[class*="cookie"]', { timeout: 3000 });
      } catch (e) { }

      await page.waitForTimeout(1000);

      const articleContent = await extractArticleContent(page);
      newsContent.push({ link: url, content: articleContent });
    }

  } catch (error) {
    console.error(`Ошибка при обработке ${url}:`, error);
    newsContent.push({ link: url, content: `Ошибка: ${error.message}` });

  } finally {
    try {
      if (page && !page.isClosed()) {
        await page.close();
      }
    } catch (err) {
      console.error('Ошибка при закрытии страницы:', err);
    }

    if (isBrowserOwner && browser) {
      try {
        await browser.close();
      } catch (err) {
        console.error('Ошибка при закрытии браузера:', err);
      }
    }
  }

  return newsContent;
}



// Получить статьи
async function handleNews(original, content, owner, inputData, level, lang) {
  // Сохранить результат

  await createBrickAndUpdateLesson({
    theme: "Nieuws",
    name: inputData.name,
    owner: owner,
    content: JSON.stringify(content),
    level: level,
    type: 'news'
  });

  if (false) {

    let dlg_propmt = await GetPrompt(`dialog.news.${lang}`);
    dlg_propmt = dlg_propmt.prompt.system;

    content = content;

    dlg_propmt = dlg_propmt.replaceAll('${text}', "```" + JSON.stringify(content) + "```")
      .replaceAll('${lang}', lang)
      .replaceAll('${level}', level);

    // console.log(dlg_propmt);


    const dlg = await generate_from_text_input(dlg_propmt);

    if (dlg)
      await UpdateDialog({
        theme: "Nieuws",
        name: inputData.name,
        dialog: dlg,
        owner: owner,
        html: content,
        level: level,
        type: 'news'
      });
  }

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

async function adaptNews(prompt, text) {
  // Проверяем наличие `generate_from_text_input`
  if (typeof generate_from_text_input !== 'function') {
    console.error('Функция generate_from_text_input не определена.');
    return null;
  }
  // Адаптация новостей
  const result = await generate_from_text_input(prompt,text);
  
  // Handle the new return format which includes model information and validated JSON
  if (result && typeof result === 'object' && result.content) {
    // Store the model information for use in SaveArticle
    adaptNews.lastUsedModel = result.model;
    // Return the validated JSON directly
    return result.validatedJson || result.content;
  }
  
  // If result is a JSON string, parse it
  if (result && typeof result === 'string') {
    try {
      const parsed = JSON.parse(result);
      return parsed;
    } catch (e) {
      console.warn('Could not parse string result as JSON:', result);
      return result;
    }
  }
  
  return result;
}
// Add a property to store the last used model
adaptNews.lastUsedModel = null;

async function tts_google(text, lang, abonent, quiz) {
  try {
    // Генерируем md5-хеш для текста
    // const fileName = md5(text) + '.mp3';
    // const filePath = join(audioDir, fileName); // Полный путь к файлу

    // Проверяем наличие файла
    const resp = await ReadSpeech({ key: md5(text) });
    if (resp?.data) {
      console.log(`Файл уже существует`);

      return { audio: 'data:audio/mpeg;base64,' + resp.data, ts: resp.timestamps };
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
        if (ts)
          timestamps = ts
      })
      .catch((error) => {
        console.error('Error:', error);
      })

    let base64 = '';

    url_b64.map((e) => {
      base64 += e.base64;
    });

    WriteSpeech({ lang: lang, key: md5(text), text: text, data: base64, quiz: quiz, timestamps: timestamps.result.segments[0].words });

    // Записываем аудиофайл в директорию
    // await fs.outputFile(filePath, Buffer.from(url, 'base64')); // Запись файла в папку audio
    // console.log(`Файл сохранён`);

    // Читаем содержимое только что сохранённого файла и возвращаем его в формате base64
    return { audio: 'data:audio/mpeg;base64,' + base64, ts: timestamps }

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

      resolve({ text, result });
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

export { getNews };

