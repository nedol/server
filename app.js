import { WebSocketServer } from 'ws';
import { WebSocket } from 'ws';
import https from 'https';
import express from 'express';
import http from 'http';
import Turn from 'node-turn';
import cron from 'node-cron';
import fs from 'fs';
import Translate from './server/Translate.js';

import { request } from 'undici';

import Email from './server/email.js';

import pkg_l from 'lodash';
const { find, findKey } = pkg_l;

import generate_news from './server/cron/cron_tasks.js'

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

let prom = new Promise((resolve, reject) => {
  CreatePool(resolve);
});

const pool = await prom;

global.rtcPool = {};

global.interval;
global.loop = function () {
  try {
    if (!global.interval)
      global.interval = setInterval(async () => {
        // Establish WebSocket connection
        const ws = new WebSocket('wss://kolmit-server.onrender.com');
        // const ws = new WebSocket('wss://192.168.2.10:3000');

        ws.on('open', () => {
          console.log('WebSocket connection established');
          ws.send(JSON.stringify({ message: 'Hello from client' }));
        });

        ws.on('message', (data) => {
          console.log('WebSocket message received:', data.toString());
        });

        ws.on('error', (error) => {
          console.error('WebSocket error:', error);
        });

        ws.on('close', () => {
          console.log('WebSocket connection closed');
        });

        setTimeout(() => {
          ws.close();
        }, 1000);

        let { statusCode, headers, trailers, body } = await request(
          `https://kolmit.onrender.com`
          // 'https://192.168.2.10:3000'
        );
        console.log('unidici response received', statusCode);

        // console.log('headers', headers);

        // for await (const data of body) {
        //   // console.log('data', data);
        // }

        //let resp = fetch('https://kolmit-service.onrender.com/?abonent=nedooleg@gmail.com');
      }, 1000 * 60 * 10);
  } catch (ex) {}
};

// global.loop();

// Настраиваем WebSocket сервер
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Новое WebSocket соединение');

  ws.on('message', (message) => {
    // console.log(`Получено сообщение: ${message}`);
    function handlePing() {
      if (msg.type === "ping") {
          console.log("Получен ping от "+ msg.operator);
         
          if ( ws.timeoutId) {
              clearTimeout( ws.timeoutId);
          }

          if(msg.status!== ws.status){
            ws.status = msg.status;
            if(msg.status=='close')
              BroadcastOperatorStatus(ws.q, 'close');
          }


        // Устанавливаем новый таймер
        ws.timeoutId = setTimeout(() => {

            console.log(`Оператор ${msg.operator} отключился от сети`);
            BroadcastOperatorStatus(ws.q, 'close');
   
        }, 7000);
      }
    }  
    const msg = JSON.parse(message);
    if(msg.type==="ping"){
      // Пример вызова функции
      handlePing();

      return;
    }
    else if (msg.par?.operator && msg.par?.abonent) {
      ws.q = msg.par;
      msg.par.ws = ws;
      SetParams(msg.par);
      handlePing();
    }

    HandleMessage(msg.par, ws);
    // ws.send(`Echo: ${message}`);
  });

  ws.on('close', () => {
    console.log('Соединение закрыто');
    BroadcastOperatorStatus(ws.q, 'close');
  });

});

server.listen(3000, "192.168.2.10",() => {
  console.log('Server is running on https://192.168.0.6:3000');
});
server.listen(3000,() => {
  console.log('Server is running on https://localhost:3000');
});

async function HandleMessage(q, ws) {
  // console.log(q);
  let resp = '';
  switch (q?.func) {
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
  if(!q)
    return;
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
        operator:q.operator,
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
  SendEmailForUpdates();
});

// Пример cron-задачи, которая запускается каждый день в полночь
cron.schedule('40 19 * * *', () => {

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
