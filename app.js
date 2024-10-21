import { WebSocketServer } from 'ws';
import express from 'express';

import { json } from '@sveltejs/kit';

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
} from './server/db.js'; //src\lib\server\server.db.js

const app = express();

// Настраиваем HTTP сервер для Express (для WebSocket)
const server = app.listen(3001, () => {
  console.log('WebSocket сервер запущен на порту 3001');
});

// global.rtcPull = { user: {}, operator: {} };

let prom = new Promise((resolve, reject) => {
  CreatePool(resolve);
});

const pool = await prom;

global.rtcPool;
import { rtcPool_st } from './server/stores.js';
rtcPool_st.subscribe((data) => {
  global.rtcPool = data;
});

// const wsStore = {};

// Настраиваем WebSocket сервер
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Новое WebSocket соединение');

  ws.on('message', (message) => {
    // console.log(`Получено сообщение: ${message}`);
    const msg = JSON.parse(message);
    if (msg.par.operator && msg.par.abonent) {
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
          // global.rtcPool[q.abonent][q.operator].shift();
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
          }
        } catch (ex) {}
        //this.RemoveAbonent(q);
        break;
      }

      break;

    case 'quiz_users':
      resp = await BroadcastQuizUsers(q);
      break;

    case 'get_subscribers':
      if (q.type === 'dialog') {
        const dlg = await GetDialog({
          name: q.quiz,
          owner: q.abonent,
          level: q.level,
        });
        if (dlg.subscribe?.length > 0) {
          resp = {
            [q.type]: { quiz: q.quiz, subscribers: dlg.subscribe },
          };
          ws?.send(JSON.stringify({ resp }));
        }
      } else if (q.type === 'word') {
        const dlg = await GetWords({
          name: q.quiz,
          owner: q.abonent,
          level: q.level,
        });
        if (dlg.subscribe?.length > 0) {
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

async function BroadcastQuizUsers(q) {
  let qu = await UpdateQuizUsers(q);

  let remAr = [q];

  for (let operator in global.rtcPool[q.abonent]) {
    if (operator === q.rem || operator === q.add)
      //not to send to yourself
      continue;

    if (global.rtcPool[q.abonent][operator].ws)
      global.rtcPool[q.abonent][operator].ws.send(remAr);
  }
}
