import { WebSocketServer } from 'ws';
import { WebSocket } from 'ws';
import https from 'https';
import express from 'express';

import cron from 'node-cron';
import fs from 'fs';
import Translate from './server/Translate.js';

import { request } from 'undici';

import Email from './server/email.js';


import generate_news from './server/cron/cron_tasks.js'

import {
  GetLessonsByDate,
  GetUsersEmail,
  SendEmailTodayPublished,
} from './server/db.js'; //src\lib\server\server.db.js

// if (!global.turn_server) {
//   global.turn_server = new Turn({
//     // set options
//     authMech: 'long-term',
//     еingPort: 3000,
//   });
//   global.turn_server.start();
//   global.turn_server.addUser('username', 'password');
//   global.turn_server.log();
//   console.log('Turn server started on ' + global.turn_server.tingPort);
// }


const app = express();

const server = https.createServer({
  cert: fs.readFileSync('./cert.pem'),
  key: fs.readFileSync('./key.pem'),
}, app);


// Настраиваем HTTP сервер для Express (для WebSocket)
// const server = app.(process.env.PORT || 3000, '0.0.0.0',() => {
//   console.log('WebSocket сервер запущен на порту 3000');
// });

// global.rtcPull = { user: {}, operator: {} };


// Пример cron-задачи, которая запускается каждый день в полночь
cron.schedule('45 22 * * 7', () => {
  /* 
  0 — минуты (0-я минута часа)
  0 — час (полночь)
  * — день месяца (каждый день)
  * — месяц (каждый месяц)
  * — день недели (каждый день недели)
  * 
  * Каждые 5 минут: *\/5 * * * *
    Каждую субботу в полдень: 0 12 * * 6
    Каждый час: 0 * * * *
*/
  const now = new Date();
  const formattedDateTime =
    now.getFullYear() +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(now.getDate()).padStart(2, '0') +
    ' ' +
    String(now.getHours()).padStart(2, '0') +
    ':' +
    String(now.getMinutes()).padStart(2, '0');

  console.log('Задача выполняется в 22 часа 45 минут.', formattedDateTime);
  // Здесь можно вызвать нужные функции или выполнить операции
  // SendEmailForUpdates();
});

// Пример cron-задачи, которая запускается каждый день в полночь
cron.schedule('45 21 * * *', () => {

  const now = new Date();
  const formattedDateTime =
    now.getFullYear() +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(now.getDate()).padStart(2, '0') +
    ' ' +
    String(now.getHours()).padStart(2, '0') +
    ':' +
    String(now.getMinutes()).padStart(2, '0');

  console.log('Задача выполняется в ', formattedDateTime);
  // Здесь можно вызвать нужные функции или выполнить операции
  generate_news();
});

generate_news();
// SendEmailForUpdates();


async function SendEmailForUpdates() {
  const email = new Email();
  const today = new Date().toISOString().split('T')[0];
  const res = await GetLessonsByDate({ date: today });

  async function filterTodayPublished(data) {
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999); // Конец сегодняшнего дня

    const weekStart = new Date();
    weekStart.setDate(todayEnd.getDate() - 7); // Начало недели
    weekStart.setHours(0, 0, 0, 0); // Начало дня

    return data.module.themes.flatMap((theme) =>
      theme.lessons.flatMap((lesson) =>
        lesson.quizes
          .filter(
            (quiz) =>
              quiz.published &&
              new Date(quiz.published) >= weekStart &&
              new Date(quiz.published) <= todayEnd
          )
          .map((quiz) => ({ ...quiz, theme }))
      )
    );
  }

  await Promise.all(
    res.map(async (res) => {
      const emailAr = 
        // [{email: 'nedooleg@gmail.com', name: 'Oleg', lang: 'uk'}]
      await GetUsersEmail(res.owner, res.level);//['nedooleg@gmail.com']//
      const quizes = await filterTodayPublished(res.data);

      if (quizes.length > 0) {
        await Promise.all(
          emailAr.map(async (user) => {
            const html = await generateEmailTemplate(
              res.owner,
              user.name,
              quizes,
              user.lang
            );
            await SendEmailTodayPublished({
              send_email: user.email,
              lang: user.lang,
              html: html,
              head: await Translate('Обновления в Kolmit', 'ru', user.lang),
            });
          })
        );
      }
    })
  );
}

async function generateEmailTemplate(owner, userName, quizes, lang) {
  const head = await Translate(`Новости и обновления`, 'ru', lang);
  const introText = await Translate(
    `<p>Здравствуйте, <strong>${userName}</strong>!</p>
     <p>Мы рады сообщить вам о последних обновлениях и новых упражнениях в Kolmit. Проверьте, что нового доступно для вас!</p>`,
    'ru',
    lang
  );

  const head_2 = await Translate(
    'Добавленные или обновленные упражнения',
    'ru',
    lang
  );


  async function getGrammar(quiz){
    if(quiz.theme.grammar) 
      return `<strong>${await Translate('Грамматика', 'ru', lang)}:</strong> ${
          await quiz.theme.grammar
        }</li>}`  
    else
        return ''
  } 


  // Ожидаем завершения всех переводов внутри updateList
  const updateList = (
    await Promise.all(
      quizes.map(
        async (quiz) => `
      <li><strong>${await Translate('Тема изучения', 'ru', lang)}:</strong> ${
          quiz.theme.name.nl
        }<br>
      <strong>${await Translate('Название', 'ru', lang)}:</strong> ${
          quiz.name.nl
        }<br>
        ${await getGrammar(quiz)}`
      )
    )
  ).join(''); // Преобразуем результат в строку

  const appLink = `<a href='https://kolmit.onrender.com/?abonent=${owner}' class="button">${await Translate(
    'Перейти в приложение Kolmit',
    'ru',
    lang
  )}</a>`;
  const contact = await Translate(
    'Если у вас возникли вопросы, свяжитесь с нами по адресу ',
    'ru',
    lang
  );

  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Kolmit Updates</title>
      <style>
          body { 
              font-family: Arial, sans-serif; 
              background-color: #f4f4f9; 
              color: #333; 
              margin: 0; 
              padding: 0; 
          }
          .container { 
              width: 100%; 
              max-width: 600px; 
              margin: 0 auto; 
              background-color: #ffffff; 
              padding: 30px; 
              border-radius: 12px; 
              box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1); 
          }
          .header { 
              background-color: #3a7ecf; 
              color: #ffffff; 
              padding: 25px; 
              text-align: center; 
              border-top-left-radius: 12px; 
              border-top-right-radius: 12px; 
          }
          .header h1 { 
              margin: 0; 
              font-size: 26px; 
              font-weight: bold; 
          }
          .content { 
              padding: 25px; 
          }
          .content h2 { 
              font-size: 22px; 
              color: #3a7ecf; 
              margin-top: 0; 
              margin-bottom: 15px; 
          }
          .content p { 
              line-height: 1.8; 
              font-size: 16px; 
          }
          .updates { 
              background-color: #f1f9ff; 
              padding: 20px; 
              border-radius: 8px; 
              margin: 20px 0; 
          }
          .updates ul { 
              padding: 0; 
              list-style-type: none; 
          }
          .updates li { 
              padding: 15px 0; 
              border-bottom: 1px solid #d1e8ff; 
              font-size: 18px; 
              line-height: 1.6; 
          }
          .updates li:last-child { 
              border-bottom: none; 
          }
          .footer { 
              text-align: center; 
              font-size: 14px; 
              color: #666; 
              padding: 25px; 
              border-top: 1px solid #eaeaea; 
          }
          .button { 
              display: inline-block; 
              padding: 12px 24px; 
              background-color: #3a7ecf; /* Основной цвет кнопки */
              color: #ffffff !important; /* Белый цвет текста с приоритетом */
              text-decoration: none; 
              border-radius: 6px; 
              font-weight: bold; 
              margin-top: 20px; 
              box-shadow: 0 4px 8px rgba(58, 126, 207, 0.3); 
              transition: background-color 0.3s ease, box-shadow 0.3s ease;
          }

          .button:hover { 
              background: linear-gradient(135deg, #336fb1, #3a7ecf); /* Градиент при наведении */
              color: #ffffff !important; 
              box-shadow: 0 6px 12px rgba(58, 126, 207, 0.4); /* Усиленная тень */
          }
      </style>


    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Kolmit: ${head}</h1>
        </div>
        <div class="content">
          ${introText}
          <div class="updates">
            <h2>${head_2}:</h2>
            <ul>${updateList}</ul>
          </div>
          ${appLink}
        </div>
        <div class="footer">
          <p>${contact} <a href="mailto:kolmit.be@gmail.com">kolmit.be@gmail.com</a></p>
          <p>Kolmit © 2024</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
