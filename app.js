import { WebSocketServer } from 'ws';
import express from 'express';

// import { json } from '@sveltejs/kit';

import pkg_l from 'lodash';
const { find, findKey } = pkg_l;

import { CreatePool, CreateOperator, CheckOperator, GetUsers } from './server/db.js'; //src\lib\server\server.db.js

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

const wsStore = {};

// Настраиваем WebSocket сервер
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Новое WebSocket соединение');

  ws.on('message', (message) => {
    console.log(`Получено сообщение: ${message}`);
    const msg = JSON.parse(message);
    if (msg.par.operator) wsStore[msg.par.operator] = ws;

    HandleMessage(msg.par);
    // ws.send(`Echo: ${message}`);
  });

  ws.on('close', () => {
    console.log('Соединение закрыто');
  });
});

async function HandleMessage(q) {
  console.log(q);
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
      const resp = await getOperators({
        operator: q.operator,
        abonent: q.abonent,
      });
      wsStore[q.operator].send(JSON.stringify({ resp }));

      break;

    case 'check':
      SetParams(q);

      if (q.type === 'user') {
        const item = global.rtcPool[q.type][q.abonent][q.operator][q.uid];

        const operators = { [q.operator]: {} };
        for (let uid in global.rtcPool['operator'][q.abonent]) {
          if (uid !== 'resolve')
            operators[q.operator][uid] = {
              type: q.type,
              abonent: q.abonent,
              operator: q.operator,
              uid: q.uid,
              status: global.rtcPool['operator'][q.abonent][uid].status,
            };
        }

        resp = {
          func: q.func,
          type: q.type,
          check: true,
          // operators: operators,
        };

        SendOperatorOffer(q);
        return new Response(JSON.stringify({ resp }));
      } else if (q.type === 'operator') {
        const res = cookies.get('kolmit.operator:' + q.abonent);
        let kolmit;
        if (res) {
          kolmit = JSON.parse(res);
          q.psw = kolmit.psw;
        }
        // console.log(q.operator)
        resp = await CheckOperator(q);
        console.log(resp);
      }

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
          const item = global.rtcPool[q.type][q.abonent][q.operator][q.uid];
          // if (item) item.status = 'call';
          BroadcastOperatorStatus(q, 'close');
          // global.rtcPool['operator'][q.abonent][q.operator].shift();
        }
        break;
      }
      if (q.status === 'close') {
        try {
          const item = global.rtcPool[q.type][q.abonent][q.operator][q.uid];
          if (item) {
            item.status = q.status;
            if (q.type === 'operator') BroadcastOperatorStatus(q, q.status);
            //delete global.rtcPool['operator'][q.abonent][q.operator];
          }
        } catch (ex) {}
        //this.RemoveAbonent(q);
        break;
      }

      break;
  }
}

export default HandleMessage;

function SetParams(q) {
  if (!global.rtcPool[q.type][q.abonent]) {
    global.rtcPool[q.type][q.abonent] = {};
  }

  if (!global.rtcPool[q.type][q.abonent][q.operator])
    global.rtcPool[q.type][q.abonent][q.operator] = [];

  let item;
  if (q.type === 'user') {
    item = global.rtcPool[q.type][q.abonent][q.operator][q.uid];
  } else item = global.rtcPool[q.type][q.abonent][q.operator][0];

  if (!item) {
    item = {};
    item.cand = [];
    global.rtcPool[q.type][q.abonent][q.operator][q.uid] = item;
  }

  item.uid = q.uid;
  item.status = q.status;
  item.abonent = q.abonent;
  item.operator = q.operator;

  if (q.desc) item.desc = q.desc;
  if (Array.isArray(q.cand)) {
    q.cand.forEach((cand, index) => {
      item.cand.push(cand);
    });
  } else if (q.cand) item.cand.push(q.cand);

  // ws.onclose = function (ev) {
  // 	if (q.type === 'operator') {
  // 		let item = _.find(global.rtcPool[q.type][q.abonent][q.operator], {
  // 			uid: q.uid
  // 		});
  // 		if (item) item.status = 'close';
  // 		that.BroadcastOperatorStatus(q, 'close');
  // 		const ind = _.findIndex(global.rtcPool[q.type][q.abonent][q.operator], {
  // 			uid: q.uid
  // 		});
  // 		global.rtcPool[q.type][q.abonent][q.operator].splice(ind, 1);
  // 	} else if ((q.type = 'user')) {
  // 		if (global.rtcPool[q.type][q.abonent]) {
  // 			that.SendUserStatus(q);
  // 			const index = _.findIndex(global.rtcPool[q.type][q.abonent][q.operator], {
  // 				uid: q.uid
  // 			});
  // 			global.rtcPool[q.type][q.abonent][q.operator].splice(index, 1);
  // 		}
  // 	}
  // };
}

async function BroadcastOperatorStatus(q, check) {
  try {
    let type = q.type === 'operator' ? 'user' : 'operator';

    for (let operator in global.rtcPool['operator'][q.abonent]) {
      if (operator === q.operator)
        //not to send to yourself
        continue;
      for (let uid in global.rtcPool['operator'][q.abonent][operator]) {
        let item = global.rtcPool[q.type][q.abonent][operator][uid];
        let offer = ''; //find(operators[q.operator], { status: 'offer' });
        if (
          item.status === 'offer' &&
          // && item.abonent === q.operator
          item.uid !== q.uid
        ) {
          const users = await GetUsers({
            abonent: q.abonent,
            operator: q.operator,
          });
          const oper = find(users.operators, { operator: q.operator });
          wsStore[operator].send(
            JSON.stringify({
              func: q.func,
              type: type,
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
    }

    // operators = '';
  } catch (ex) {
    console.log(ex);
  }
}

function SendOperatorOffer(q) {
  if (
    global.rtcPool['operator'] &&
    global.rtcPool['operator'][q.abonent] &&
    global.rtcPool['operator'][q.abonent][q.operator]
  ) {
    for (let uid in global.rtcPool['operator'][q.abonent][q.operator]) {
      if (
        global.rtcPool['operator'][q.abonent][q.operator][uid].status ===
        'offer'
      ) {
        let operator = {
          abonent: q.abonent,
          operator: q.operator,
          uid: uid,
          status: global.rtcPool['operator'][q.abonent][q.operator][uid].status,
          desc: global.rtcPool['operator'][q.abonent][q.operator][uid].desc,
          cand: global.rtcPool['operator'][q.abonent][q.operator][uid].cand,
        };

        if (q.type === 'user') {
          let item = global.rtcPool['user'][q.abonent][q.operator][q.uid];
          socket?.send(JSON.stringify([{ operator: operator }]));
        }
      }
    }
  }
}

async function HandleCall(q) {
  let remAr = [];
  if (q.type === 'user') {
    if (q.desc || q.cand) {
      remAr.push({
        func: q.func,
        desc: q.desc,
        cand: q.cand,
        abonent: q.abonent,
        user: q.operator,
        // "abonent": q.operator
      });
      if (!global.rtcPool['operator'][q.abonent][q.target]) return;
      let item = global.rtcPool['operator'][q.abonent][q.target][q.oper_uid];

      if (item) {
        wsStore[q.target].send(JSON.stringify(remAr[0]));
      }
    } else {
      let item = global.rtcPool['operator'][q.abonent][q.user];

      if (item) {
        let oper_offer_key = findKey(
          global.rtcPool['operator'][q.abonent][q.user],
          {
            status: 'offer',
          }
        );

        let oper_offer =
          global.rtcPool['operator'][q.abonent][q.user][oper_offer_key];

        if (oper_offer) {
          remAr.push({
            func: q.func,
            abonent: q.abonent,
            uid: q.uid,
            oper_uid: oper_offer.uid,
            desc: oper_offer.desc,
            cand: oper_offer.cand,
          });
          wsStore[q.operator].send(JSON.stringify(remAr[0]));
          // console.log('HandleCall to user', remAr.length);
          return;
        }
      }
    }
  }
}

async function getOperators(q, func) {
  const users = await GetUsers(q);
  let operators = { [q.operator]: {} };
  for (let oper in global.rtcPool['operator'][q.abonent]) {
    const user = find(users.operators, { operator: oper });

    operators[oper] = {
      type: q.type,
      abonent: q.abonent,
      operator: oper,
      status: global.rtcPool['operator'][q.abonent][oper][oper].status,
      picture: user?.picture,
      name: user?.name,
    };
  }

  return operators;
}
