import pkg from 'moment';
const { moment } = pkg;

import pkg_l from 'lodash';
const { find, remove, findIndex, difference } = pkg_l;

import md5 from 'md5';
// import { writable } from 'svelte/store';

// import { tarifs } from './tarifs.json';

import postgres from 'postgres';

export let sql;

let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID } = process.env;

// import { redirect } from '@sveltejs/kit';
import Email from './email.js';

let conStr = {
  connectionStringSupabase:
    'postgresql://postgres.abzyzzvokjdnwgjbitga:NissanPathfinder@386/aws-0-eu-central-1.pooler.supabase.com:5432',
};

export async function CreatePool_(resolve) {
  sql = postgres(conStr.connectionStringSupabase, {
    host: 'aws-0-eu-central-1.pooler.supabase.com', // Postgres ip address[s] or domain name[s]
    port: 5432, // Postgres server port[s]
    database: 'postgres', // Name of database to connect to
    username: 'postgres.abzyzzvokjdnwgjbitga', // Username of database user
    password: 'NissanPathfinder@386', // Password of database user
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  });
  resolve(sql);
}

let conStrNeon = {
  connectionString:
    'postgresql://nedooleg:nHLhfQB0WS5Y@ep-polished-bush-a2n4g5y9-pooler.eu-central-1.aws.neon.tech:5432/neondb?sslmode=require',
};

export async function CreatePool(resolve) {
  sql = postgres(conStrNeon.connectionString, {
    host: 'ep-polished-bush-a2n4g5y9-pooler.eu-central-1.aws.neon.tech', // Postgres ip address[s] or domain name[s]
    port: 5432, // Postgres server port[s]
    database: 'neondb', // Name of database to connect to
    username: 'nedooleg', // Username of database user
    password: 'nHLhfQB0WS5Y', // Password of database user
  });
  resolve(sql);
}

function getHash(par) {
  return md5(par + par);
}

export function SendEmail(q, new_email) {
  let operator = new Email();
  const abonent = q.abonent;
  const mail = q.send_email;
  const hash = getHash(mail);
  let html =
    `<a href='https://kolmit.onrender.com/?abonent=${abonent}&user=${mail}'>` +
    {
      ru: '<h1>Присоединиться к сети Kolmit:</h1></a>',
      en: '<h1>Join Kolmit network:</h1></a>',
      fr: '<h1>Rejoindre le réseau Kolmit:</h1></a>',
    }[q.lang];

  operator.SendMail(
    `nedooleg@gmail.com`,
    mail,
    {
      ru: 'Новый пользователь сети Колмит',
      en: 'New Kolmit network user',
      fr: 'Le nouvel opérateur de Kolmi',
    }[q.lang],
    html,
    (result) => {
      console.log();
    }
  );
}

export function SendEmailTodayPublished(q) {
  let operator = new Email();
  const mail = q.send_email;
  const hash = getHash(mail);
  let html = q.html;
  let head = q.head;

  operator.SendMail(`nedooleg@gmail.com`, mail, head, html, (result) => {
    console.log();
  });
}

export async function CreateOperator(par) {
  try {
    // if (par.abonent === par.email) return false;
    let res = await sql` 
		UPDATE operators 
		SET
		name = ${par.name},
    email = ${par.email},
		operator = ${md5(par.email)}, 
		psw = ${md5(par.psw)}, 
		picture = ${par.picture} 
		WHERE email = ${par.email} AND abonent=${par.abonent}
		`;
    return {
      operator: md5(par.email),
      name: par.name,
      email: par.email,
      psw: md5(par.psw),
      lang: par.lang,
    };
  } catch (er) {
    console.log(er);
  }
}

export async function CreateSession(oper, suid) {
  let res = await sql` 
    SELECT create_session(${oper}, ${suid})
  `;
}

async function updateOper(q) {
  try {
    let res = await sql`UPDATE operators SET
		psw = ${q.psw}, picture=${q.picture}
		WHERE  operator=${q.email} AND abonent=${q.abonent}`;
  } catch (ex) {}
}

async function updateUsers(users, q) {
  let usrs = users;

  try {
    let res = await sql`UPDATE users SET
		users=${usrs}, 
		last=CURRENT_TIMESTAMP, 
		editor=${q.abonent || q.email}
		WHERE  operator=${q.abonent || q.email}`;
  } catch (ex) {}
  return JSON.stringify({ func: q.func, dep: users[0] });
}

export async function GetGroup(par) {
  //всех кто в группе, кроме себя
  const group = await sql`
			SELECT "group", abonent, role, operator, picture, lang, name
      	FROM operators
        WHERE operators.abonent=${par.abonent} 
        AND  operators.operator=${par.operator}
        AND operators.group=(
        SELECT "group" FROM operators
        WHERE operators.abonent=${par.abonent} 
        AND operator=${par.operator} AND psw=${par.psw}
      )`;

  if (group) {
    const timestamp = new Date().toISOString(); // Получаем текущую метку времени
    CreateSession(par.operator, md5(par.operator + timestamp));
  }

  const oper = await sql`
			SELECT 
			"group", abonent, role, operator, picture, lang, name
			FROM operators
			WHERE operators.abonent=${par.abonent} AND operator=${par.operator}
      `;

  return { group, oper };
}

export async function GetUsersEmail(owner, level) {
  const group = await sql`
    SELECT 
    name
    FROM groups
    WHERE owner=${owner} AND level=${level}
  `;

  const emails = await sql`
    SELECT 
    email, name, lang
    FROM operators
    WHERE "group"=${group[0].name}
    `;
  return emails;
}

export async function GetUsers(par) {
  let operators,
    admin = '';

  try {
    if (par.abonent) {
      operators = await sql`
			SELECT 
			*,
			operator as email
			FROM operators
			WHERE role<>'admin' AND operators.abonent=${par.abonent} AND
      operators.group = (
          SELECT operators.group
          FROM operators
          WHERE operators.operator=${par.operator} AND operators.abonent=${par.abonent} 
      )
      `;

      admin = await sql`
			SELECT 
			*,
			operator as email
			FROM operators
			WHERE role='admin' AND operators.abonent=${par.abonent}
			`;
    }
  } catch (ex) {
    console.log();
  }

  return { operators, admin };
}

export async function CheckOperator(q) {
  let result;

  // console.log(sql);

  if (q.psw && q.operator) {
    try {
      await sql`
			INSERT INTO operators (psw, operator, abonent,  name) VALUES(${q.psw}, ${q.operator}, 
			, ${q.name})`;
    } catch (ex) {}
  }

  if (q.operator) {
    if (q.abonent) {
      result = await sql`
			SELECT * FROM  operators WHERE operator=${q.operator} AND abonent=${q.abonent} AND psw=${q.psw}`;
    } else {
      result = result;
      await sql`
			SELECT * FROM  operators WHERE operator=${q.operator} AND abonent=${q.abonent} AND psw=${q.psw}`;
    }

    result = result;

    if (result[0]) {
      if (q.psw == result[0].psw) {
        return {
          func: q.func,
          check: true,
        };
      } else {
        return JSON.stringify({ func: q.func, check: false });
      }
    } else {
      return JSON.stringify({ func: q.func, check: false });
    }
  } else {
    result = await sql`
		SELECT * FROM  operators WHERE operator=${q.operator}`;

    return result;
  }
}

async function insertUsers(users, q) {
  let usrs = JSON.stringify(users);
  try {
    let res = await sql`
		INSERT INTO users
		(operator, users, last, editor) VALUES (${q.email},
		${usrs}, CURRENT_TIMESTAMP, ${q.email})`;
  } catch (ex) {}

  return JSON.stringify({ func: q.func, res: res });
}

export async function AddOperator(q) {
  let res = await sql`
	SELECT users 
	FROM users 
	INNER JOIN operators ON (operators.abonent = users.operator)
	WHERE operators.abonent=${q.abonent}`;

  let users = {};
  if (res[0]) {
    users = res[0].users;
  }

  try {
    let res = await sql`UPDATE users SET
		users=${users}, 
		last=CURRENT_TIMESTAMP, 
		editor=${q.email}
		WHERE  operator=${q.abonent}`;
  } catch (ex) {
    await sql`ROLLBACK;`;
    return JSON.stringify({ func: q.func, res: ex });
  }
  try {
    let res = await sql`INSERT INTO operators
		(operator, abonent, psw) VALUES (${q.email}, ${q.abonent}, ${q.psw})`;
  } catch (ex) {
    return JSON.stringify({ func: q.func, res: ex });
  }

  return JSON.stringify({ func: q.func, dep: users });
}

export async function ChangeDep(q) {
  let res = await sql`SELECT users 
	FROM operators as oper
	INNER JOIN users as usr ON (operators.abonent = users.operator)
	WHERE oper.abonent=${q.abonent} AND oper.operator=${
    q.operator || q.operator
  } AND oper.psw=${q.psw}`;

  if (res[0]) {
    let users = JSON.parse(res[0].users);
    let ind = findIndex(users, { id: String(q.dep.id) });
    if (ind === -1) return;
    users[ind] = q.dep;

    return updateUsers(users, q);
  }
}

export async function AddDep(q) {
  if (q.abonent) {
    let res = await sql`SELECT *, (SELECT users FROM users WHERE operator=${
      q.abonent || q.operator
    }) as users
		FROM  operators as oper
		WHERE oper.operator=${q.abonent || q.operator}  AND abonent=${
      q.abonent
    } AND psw=${q.psw}
		`;
    let users = [];
    if (res[0]) {
      users = JSON.parse(res[0].users);
      let ind = findIndex(users, { id: String(q.id) });
      if (ind === -1) return;
      users[q.id + 1] = {
        id: String(q.id + 1),
        alias: '',
        admin: {
          desc: '',
          name: '',
          role: 'admin',
          email: '',
          picture: { user_pic },
        },
        staff: [],
      };
      return updateUsers(users, q);
    }
    return rows[0];
  }
}

export async function RemDep(q) {
  let res = sql`SELECT users 
		FROM operators as oper
		INNER JOIN users as usr ON (operators.abonent = users.operator)
		WHERE oper.operator=${q.operator || q.abonent} AND oper.psw=${q.psw}`;

  if (res[0]) {
    let users = JSON.parse(res[0].users);
    remove(users, (n) => {
      return n.id === q.dep;
    });
    return updateUsers(users, q);
  }
}

export async function ChangeOperator(q) {
  const res = await sql`SELECT *, (SELECT users FROM users WHERE operator=${
    q.abonent || q.operator
  }) as users 
		FROM  operators as oper 
		WHERE oper.operator=${q.abonent || q.operator}  AND abonent=${
    q.abonent
  } AND psw=${q.psw}`;

  if (res[0]) {
    try {
      let users = [];
      users = JSON.parse(res[0].users);
      let dep = find(users, { id: q.dep_id });
      let user;
      if (q.data.role === 'admin') {
        user = dep['admin'];
      } else {
        let ind = findIndex(dep.staff, { id: q.data.id });
        user = dep.staff[ind];
      }

      if (q.data.alias) user.alias = q.data.alias;
      // if (q.data.picture) user.picture = q.data.picture;
      if (q.data.email) {
        if (q.data.email !== user.email) SendEmail(q, q.data.email);
        user.email = q.data.email;
      }
      if (q.data.name) user.name = q.data.name;
      if (q.data.desc) user.desc = q.data.desc;
    } catch (ex) {}

    return updateUsers(users, q);
  }
}

export async function RemoveOperator(q) {
  const res = sql`SELECT *, (SELECT users FROM users WHERE operator=?) as users ' +
		'FROM  operators as oper 
		'WHERE oper.operator=${q.abonent || q.operator}  AND abonent=${
    q.abonent
  } AND psw=${q.psw}`;
  try {
    let users = [];
    if (res[0]) {
      users = JSON.parse(res[0].users);
      let dep = find(users, { id: q.dep });
      let ind = findIndex(dep.staff, { id: q.id });
      dep.staff.splice(ind, 1);

      return updateUsers(users, q);
    }
  } catch (ex) {
    return;
  }
}

export async function GetListen(q) {
  try {
    let res = await sql`SELECT data FROM listen
		WHERE name= ${q.name} AND lang=${q.lang}`;
    //debugger;
    return { data: res[0].data };
  } catch (ex) {
    return JSON.stringify({ func: q.func, res: ex });
  }
}

export async function GetWords(q) {
  try {
    let res = await sql`SELECT data, context, subscribe  FROM word
		WHERE name=${q.name} AND owner=${q.owner} AND level=${q.level}`;
    return res[0];
  } catch (ex) {
    return JSON.stringify({ func: q.func, res: ex });
  }
}

export async function GetDialog(q) {
  try {
    let res = await sql`SELECT dialog, html, subscribe FROM dialogs
		WHERE name=${q.name} AND owner=${q.owner} AND level=${q.level}`;

    return {
      dialog: res[0].dialog,
      html: res[0].html || '',
      subscribe: res[0].subscribe,
    };
  } catch (ex) {
    return JSON.stringify({ func: q.func, res: ex });
  }
}

export async function GetPrompt(name) {
  let prompt = await sql`SELECT system, user FROM prompts
		WHERE name=${name}`;
  return {
    prompt: prompt[0],
  };
}

export async function getLevels(owner) {
  const levels = await sql`SELECT level FROM lessons WHERE owner=${owner}`;

  return levels.map((item) => {
    return item.level;
  });
}

export async function GetLessonsByDate() {
  // Начало дня ровно неделю назад (включая сегодняшнюю дату)
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - 7); // Перемещаем на 7 дней назад
  startOfWeek.setHours(0, 0, 0, 0); // Начало дня

  // Конец текущего дня
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999); // Конец дня

  return await sql`SELECT owner, data, level, lang 
    FROM lessons 
    WHERE timestamp BETWEEN ${startOfWeek} AND ${endOfDay} 
    ORDER BY level DESC`;
}

export async function GetLesson(q) {
  try {
    let res = '';
    if (q.operator !== q.owner) {
      res = await sql`
      SELECT lessons.data, lessons.level, lessons.lang 
        FROM lessons
        JOIN operators ON (operators.operator = ${q.operator} and operators.abonent=${q.owner})
        JOIN groups ON (groups.name = operators.group and groups.level=lessons.level)
        WHERE  groups.owner=${q.owner} AND lessons.owner=${q.owner}
        ORDER BY level desc`;
    } else if (q.level) {
      res =
        await sql`SELECT data, level, lang FROM lessons WHERE owner=${q.owner} AND level=${q.level}  ORDER BY level desc`;
    } else {
      res =
        await sql`SELECT data, level, lang FROM lessons WHERE owner=${q.owner}  ORDER BY level desc`;
    }
    //debugger;
    const levels = await getLevels(q.owner);

    const les = find(res, { level: q.level });

    return {
      data: les ? les.data : res[0].data,
      lang: les?.lang ? les.lang : res[0].lang,
      level: les?.level ? les.level : res[0].level,
      levels: levels,
    };
  } catch (ex) {
    return JSON.stringify({ func: q.func, res: ex });
  }
}

export async function UpdateQuizUsers(q) {
  let res;
  try {
    // Получаем текущие подписки в формате JSON

    if (q.type == 'dialog')
      res =
        await sql`SELECT subscribe FROM dialogs WHERE name = ${q.quiz} AND owner = ${q.abonent}`;
    else if (q.type == 'word')
      res =
        await sql`SELECT subscribe FROM word WHERE name = ${q.quiz} AND owner = ${q.abonent}`;

    // Извлекаем подписки, если пусто - создаем пустой массив
    let qu = res[0]?.subscribe || [];

    // Если нужно добавить новую подписку
    if (q.add) {
      qu.push(q.add);
    }
    // Если нужно удалить подписку
    else if (q.rem) {
      let index = qu.indexOf(q.rem); // находим индекс элемента
      if (index > -1) {
        // проверяем, что элемент найден
        qu.splice(index, 1); // удаляем элемент
      }
    }

    // Обновляем базу данных, преобразуя массив в JSON
    if (q.type == 'dialog')
      res = await sql`UPDATE dialogs 
                    SET subscribe = ${sql.json(
                      qu
                    )} -- используем JSON для PostgreSQL
                    WHERE name = ${q.quiz} AND owner = ${q.abonent}`;
    else if (q.type == 'word')
      res = await sql`UPDATE word 
                    SET subscribe = ${sql.json(
                      qu
                    )} -- используем JSON для PostgreSQL
                    WHERE name = ${q.quiz} AND owner = ${q.abonent}`;

    return qu;
  } catch (ex) {
    console.log(ex);
    throw ex; // чтобы ошибка могла быть обработана выше
  }
}

export async function GetDict(q) {
  try {
    let res = await sql`SELECT words FROM dicts
		WHERE type=${q.type} AND level= ${q.level}  AND owner=${q.owner}`;
    if (res[0]) return res[0].words;
    else return res;
  } catch (ex) {
    // debugger;
    return JSON.stringify({ func: q.func, res: ex });
  }
}

export async function WriteSpeech(q) {
  try {
    await sql.begin(async (sql) => {
      await sql`INSERT INTO speech (lang, key, text, data, quiz)
                VALUES (${q.lang}, ${q.key}, ${q.text}, ${q.data}, ${q.quiz})
                ON CONFLICT (key) 
                DO UPDATE SET 
                    lang = ${q.lang}, 
                    text = ${q.text}, 
                    data = ${q.data}, 
                    quiz = ${q.quiz}`;
    });
  } catch (ex) {
    console.log();
  }
}

export async function ReadSpeech(q) {
  try {
    let res = await sql`SELECT data FROM speech
		WHERE key= ${q.key} AND quiz IS NOT NULL`;
    if (res[0]) {
      return res[0].data;
    }
  } catch (ex) {
    return JSON.stringify('');
  }
}
