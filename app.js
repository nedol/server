import { WebSocketServer } from 'ws';
import express from 'express';
import Turn from 'node-turn';
import cron from 'node-cron';

import Translate from './server/Translate.js';

// import { json } from '@sveltejs/kit';

import Email from './server/email.js';

import pkg_l from 'lodash';
const { find, findKey } = pkg_l;

import {
  CreatePool,
  CreateOperator,
  CheckOperator,
  UpdateQuizUsers,
  GetUsers,
  GetDialog,
  GetWords,
  GetLessonsByDate,
  GetUsersEmail,
  SendEmailTodayPublished,
} from './server/db.js'; //src\lib\server\server.db.js

if (!global.turn_server) {
  global.turn_server = new Turn({
    // set options
    authMech: 'long-term',
    listeningPort: 3000,
  });
  global.turn_server.start();
  global.turn_server.addUser('username', 'password');
  global.turn_server.log();
  console.log('Turn server started on ' + global.turn_server.listeningPort);
}

const app = express();

// Настраиваем HTTP сервер для Express (для WebSocket)
const server = app.listen(process.env.PORT || 3000, () => {
  console.log('WebSocket сервер запущен на порту 3000');
});

// global.rtcPull = { user: {}, operator: {} };

let prom = new Promise((resolve, reject) => {
  CreatePool(resolve);
});

const pool = await prom;

global.rtcPool = {};

// Настраиваем WebSocket сервер
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Новое WebSocket соединение');

  ws.on('message', (message) => {
    // console.log(`Получено сообщение: ${message}`);
    const msg = JSON.parse(message);
    if (msg.par?.operator && msg.par?.abonent) {
      msg.par.ws = ws;
      SetParams(msg.par);
    }

    HandleMessage(msg.par, ws);
    // ws.send(`Echo: ${message}`);
  });

  ws.on('close', () => {
    console.log('Соединение закрыто');
  });
});

async function HandleMessage(q, ws) {
  // console.log(q);
  let resp = '';
  switch (q.func) {
    case 'operator':
      if (q.email && q.psw) {
        const par = await CreateOperator(q);
        if (par) {
          cookies.set(
            'kolmit.operator:' + q.abonent,
            JSON.stringify({
              name: par.name,
              operator: par.operator,
              abonent: q.abonent,
              psw: par.psw,
              email: q.email,
              lang: par.lang,
            }),
            {
              path: '/',
              maxAge: 60 * 60 * 24 * 400,
            }
          );

          resp = JSON.stringify({
            func: par.func,
            name: q.name,
            operator: q.operator,
            abonent: q.abonent,
            lang: q.lang,
          });
        }
      }
      break;

    case 'operators':
      resp = await getOperators({
        operator: q.operator,
        abonent: q.abonent,
      });
      global.rtcPool[q.abonent][q.operator].ws.send(JSON.stringify({ resp }));

      break;

    case 'offer':
      try {
        SetParams(q);
        BroadcastOperatorStatus(q, 'offer');

        // const operators = await getOperators(q, 'offer');
        // let resp = {
        //   operators: operators,
        // };
      } catch (ex) {
        console.log();
      }

      break;

    case 'call':
      HandleCall(q);

      break;

    case 'status':
      SetParams(q);
      if (q.status === 'call') {
        if (q.type === 'operator') {
          const item = global.rtcPool[q.abonent][q.operator];
          // if (item) item.status = 'call';
          BroadcastOperatorStatus(q, 'close');
          global.rtcPool[q.abonent][q.operator].shift();
        }
        break;
      }
      if (q.status === 'close') {
        try {
          const item = global.rtcPool[q.abonent][q.operator];
          if (item) {
            item.status = q.status;
            BroadcastOperatorStatus(q, q.status);
            //delete global.rtcPool[q.abonent][q.operator];
            global.rtcPool[q.abonent][q.operator].shift();
          }
        } catch (ex) {}
        //this.RemoveAbonent(q);
        break;
      }

      break;

    case 'quiz_users':
      resp = await BroadcastQuizUsers(q, ws);
      break;

    case 'get_subscribers':
      if (q.type === 'dialog') {
        const dlg = await GetDialog({
          name: q.quiz,
          owner: q.abonent,
          level: q.level,
        });
        if (dlg?.subscribe?.length > 0) {
          resp = {
            [q.type]: {
              quiz: q.quiz,
              subscribers: dlg.subscribe,
            },
          };
          ws?.send(JSON.stringify({ resp }));
        }
      } else if (q.type === 'word') {
        const dlg = await GetWords({
          name: q.quiz,
          owner: q.abonent,
          level: q.level,
        });
        if (dlg?.subscribe?.length > 0) {
          resp = {
            [q.type]: { quiz: q.quiz, subscribers: dlg.subscribe },
          };
          ws?.send(JSON.stringify({ resp }));
        }
      }
      break;
  }
}

function SetParams(q) {
  if (!global.rtcPool[q.abonent]) {
    global.rtcPool[q.abonent] = {};
  }

  const item = global.rtcPool[q.abonent][q.operator] || {};

  if (q.status) item.status = q.status;
  item.ws = q.ws;

  if (q.desc) item.desc = q.desc;
  if (!item.cand) item.cand = [];
  if (Array.isArray(q.cand)) {
    q.cand.forEach((cand, index) => {
      item.cand.push(cand);
    });
  } else if (q.cand) item.cand.push(q.cand);

  global.rtcPool[q.abonent][q.operator] = item;

  // ws.onclose = function (ev) {
  // 	if (q.type === 'operator') {
  // 		let item = _.find(global.rtcPool[q.abonent][q.operator], {
  // 			uid: q.uid
  // 		});
  // 		if (item) item.status = 'close';
  // 		that.BroadcastOperatorStatus(q, 'close');
  // 		const ind = _.findIndex(global.rtcPool[q.abonent][q.operator], {
  // 			uid: q.uid
  // 		});
  // 		global.rtcPool[q.abonent][q.operator].splice(ind, 1);
  // 	} else if ((q.type = 'user')) {
  // 		if (global.rtcPool[q.abonent]) {
  // 			that.SendUserStatus(q);
  // 			const index = _.findIndex(global.rtcPool[q.abonent][q.operator], {
  // 				uid: q.uid
  // 			});
  // 			global.rtcPool[q.abonent][q.operator].splice(index, 1);
  // 		}
  // 	}
  // };
}

async function BroadcastOperatorStatus(q, check) {
  try {
    for (let operator in global.rtcPool[q.abonent]) {
      if (operator === q.operator)
        //not to send to yourself
        continue;

      let item = global.rtcPool[q.abonent][operator];
      let offer = ''; //find(operators[q.operator], { status: 'offer' });
      if (
        item.status === 'offer'
        // && item.abonent === q.operator
        // item.uid !== q.uid
      ) {
        const users = await GetUsers({
          abonent: q.abonent,
          operator: q.operator,
        });
        const oper = find(users.operators, { operator: q.operator });
        global.rtcPool[q.abonent][operator].ws.send(
          JSON.stringify({
            func: q.func,
            abonent: q.abonent,
            operator: q.operator,
            uid: q.uid,
            status: check,
            picture: oper.picture,
            name: oper.name,
          })
        );
      }
    }

    // operators = '';
  } catch (ex) {
    console.log(ex);
  }
}

async function HandleCall(q) {
  let remAr = [];

  if (q.desc || q.cand) {
    remAr.push({
      func: q.func,
      desc: q.desc,
      cand: q.cand,
      abonent: q.abonent,
      user: q.operator,
      // "abonent": q.operator
    });
    if (!global.rtcPool[q.abonent][q.target]) return;
    let item = global.rtcPool[q.abonent][q.target];

    if (item) {
      global.rtcPool[q.abonent][q.target].ws.send(JSON.stringify(remAr[0]));
    }
  } else {
    let item = global.rtcPool[q.abonent][q.user];

    if (item.status === 'offer') {
      remAr.push({
        func: q.func,
        abonent: q.abonent,
        target: q.user,
        desc: item.desc,
        cand: item.cand,
      });
      global.rtcPool[q.abonent][q.operator].ws.send(JSON.stringify(remAr[0]));
      // console.log('HandleCall to user', remAr.length);
    }
  }
}

async function getOperators(q, func) {
  const users = await GetUsers(q);
  let operators = { [q.operator]: {} };
  for (let oper in global.rtcPool[q.abonent]) {
    const user = find(users.operators, { operator: oper });

    operators[oper] = {
      type: q.type,
      abonent: q.abonent,
      operator: oper,
      status: global.rtcPool[q.abonent][oper].status,
      picture: user?.picture,
      name: user?.name,
    };
  }

  return operators;
}

async function BroadcastQuizUsers(q, ws) {
  let qu = await UpdateQuizUsers(q);

  let remAr = [q];

  for (let operator in global.rtcPool[q.abonent]) {
    if (operator === q.rem || operator === q.add)
      //not to send to yourself
      continue;

    global.rtcPool[q.abonent][operator].ws.send(JSON.stringify(remAr));
  }
}

// Пример cron-задачи, которая запускается каждый день в полночь
cron.schedule('* 23 * * *', () => {
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
  
  console.log('Задача выполняется в 23 часа.', formattedDateTime);
  // Здесь можно вызвать нужные функции или выполнить операции
  SendEmailForUpdates();
});

// SendEmailForUpdates();

async function SendEmailForUpdates() {
  const email = new Email();

  const res = await GetLessonsByDate({
    date: new Date().toISOString().split('T')[0],
  });

  function filterTodayPublished(data) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Устанавливаем время на начало текущего дня
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // Время на начало следующего дня

    const result = [];

    data.module.themes.forEach((theme) => {
      theme.lessons.forEach((lesson) => {
        lesson.quizes.forEach((quiz) => {
          if (quiz.published) {
            const quizDate = new Date(quiz.published);
            if (quizDate >= today && quizDate < tomorrow) {
              quiz.theme = theme;
              result.push(quiz);
            }
          }
        });
      });
    });

    return result;
  }

  res.map(async (res) => {
    const emailAr = await GetUsersEmail(res.owner, res.level);
    emailAr.map(async (user) => {
      // let user = emailAr[0];
      const quizes = filterTodayPublished(res.data);
      let html = await generateEmailTemplate(
        res.owner,
        user.name,
        quizes,
        user.lang
      );
      if (quizes.length > 0)
        SendEmailTodayPublished({
          send_email: 'kolmit.be@gmail.com',
          lang: user.lang,
          html: html,
          head: await Translate('Обновления в Kolmit', 'ru', user.lang),
        });
    });
  });
}

async function generateEmailTemplate(owner, userName, quizes, lang) {
  let head = await Translate(`Новости и обновления`, 'ru', lang);

  let content =
    (await Translate(
      `<p>Здравствуйте, <strong>${userName}</strong>!</p>
      <p>Мы рады сообщить вам о последних обновлениях и новых упражнениях в Kolmit. Проверьте, что нового доступно для вас!</p>

      <div class="updates">
          <h2>Добавленные или обновленные упражнения:</h2>
          <ul>
              ${quizes
                .map(
                  (quiz) => `
                  <li><strong>Тема:</strong> ${quiz.theme.name.nl}<br>
                  <li><strong>Название:</strong> ${quiz.name.nl}<br>
                  <strong>Грамматика:</strong> ${quiz.grammar}</li>
              `
                )
                .join('')}
          </ul>
      </div>
      <p>Зайдите в Kolmit, чтобы попробовать новые упражнения и улучшить свои навыки!</p>
      `,
      'ru',
      lang
    )) +
    `<a href='https://kolmit.onrender.com/?abonent=${owner}' class="button">` +
    (await Translate('Перейти в приложение Kolmit', 'ru', lang)) +
    `</a>`;

  let contact = await Translate(
    'Если у вас возникли вопросы, свяжитесь с нами по адресу ',
    'ru',
    lang
  );

  // HTML-шаблон с placeholder для динамической вставки данных
  const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Kolmit Updates</title>
        <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f9; color: #333; margin: 0; padding: 0; }
            .container { width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); }
            .header { background-color: #4075a6; color: #ffffff; padding: 20px; text-align: center; border-top-left-radius: 8px; border-top-right-radius: 8px; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 20px; }
            .content h2 { font-size: 18px; color: #4075a6; }
            .content p { line-height: 1.6; }
            .updates { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .updates ul { padding: 0; list-style-type: none; }
            .updates li { padding: 10px 0; border-bottom: 1px solid #ddd; }
            .updates li:last-child { border-bottom: none; }
            .footer { text-align: center; font-size: 12px; color: #666; padding: 20px; border-top: 1px solid #eaeaea; }
            .button { display: inline-block; padding: 10px 20px; background-color:  #ffffff; color: blue; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 10px; }
            .button:hover { background-color: #4075a6; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Kolmit: ${head}</h1>
            </div>
            <div class="content">
            ${content}
            </div>
            <div class="footer">
                <p>${contact} <a href="mailto:kolmit.be@gmail.com">kolmit.be@gmail.com</a></p>
                <p>Kolmit © 2024</p>
            </div>
        </div>
    </body>
    </html>`;

  return htmlTemplate;
}
