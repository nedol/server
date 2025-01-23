import md5 from 'md5';
import postgres from 'postgres';


import pkg_l from 'lodash';
const { find, remove, findIndex, difference } = pkg_l;

let sql;

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

export async function SetSQL(sql_) {
  sql = sql_;
}

export async function CreateAdmin(par) {
  try {
    let res = await sql`INSERT INTO admins
			(name , email, operator, psw, lang)
			VALUES(${par.name},${par.email},${md5(par.email)},${md5(par.psw)},${par.lang})
			ON CONFLICT ( email)
			DO NOTHING
			`;

    return {
      name: par.name,
      email: par.email,
      operator: md5(par.email),
      psw: md5(par.psw),
      lang: par.lang,
    };
  } catch (ex) {
    console.log();
  }
}

export async function GetGroups(par) {
  let groups, operators, admin;
  try {
    operators = await sql`
      SELECT *
      FROM operators
      WHERE role <> 'admin' AND operators.abonent = ${par.abonent}`;

    admin = await sql`
      SELECT *
      FROM operators
      WHERE role = 'admin' AND operators.abonent = ${par.abonent}`;

    groups = await sql`
      SELECT groups.name::text 
      FROM groups
      INNER JOIN operators ON (operators.abonent = groups.owner)
      WHERE operators.operator = ${par.abonent} 
      AND operators.role = 'admin' 
      AND operators.psw = ${par.psw}`;
  } catch (ex) {
    console.log(ex);
  }
  return { groups, operators, admin };
}


export async function DeleteUser(par) {
  let resp;
  try {
    resp = await sql`UPDATE operators SET "group"='public', abonent='public' 
    WHERE operator=${par.operator} AND abonent=${par.abonent}`;
  } catch (ex) {
    console.log(ex);
  }
  return { resp };
}

export async function AddUser(q) {
  try {
    let operator = md5(q.email);
    let resp = await sql`INSERT INTO operators
			("group", role, operator , email, abonent , name, lang )
			VALUES(${q.class_name}, ${q.role},${operator}, ${q.email}, ${q.abonent}, ${q.name}, ${q.lang})
			ON CONFLICT (operator, abonent)
			DO NOTHING`;
    if (resp.count > 0) {
      SendEmail({ send_email: q.email, abonent: q.abonent, lang: q.lang, name:q.name });
    }
    return { resp };
  } catch (ex) {
    return JSON.stringify({ func: q.func, resp: ex });
  }
}

export async function UpdateLesson(q) {
  try {
    let levels = await getLevels(q.owner);
    levels.map((item) => {
      if (q.levels.indexOf(item) === -1) removeModule(item);
    });

    let res = await sql`INSERT INTO lessons
			(level , owner, data, lang, timestamp )
			VALUES(${q.level},${q.owner},${JSON.parse(q.data)}, ${q.lang}, NOW())
			ON CONFLICT (level, owner, lang)
			DO UPDATE SET
			owner = EXCLUDED.owner,
			level = EXCLUDED.level,
      lang = EXCLUDED.lang,
			data = EXCLUDED.data,
      timestamp = NOW()`;
    return { res };
  } catch (ex) {
    return JSON.stringify({ func: q.func, res: ex });
  }
}

async function removeModule(item) {
  return await sql`DELETE FROM lessons WHERE level=${item}`;
}

export async function UpdateDialog(q) {
  try {
    let res = await sql`INSERT INTO dialogs
			(name , dialog, owner, html, level,timestamp)
			VALUES(${q.new_name},${q.data},${q.owner},${q.data.html || ''}, ${q.level}, NOW() )
			ON CONFLICT (name, owner, level)
			DO UPDATE SET
			name = EXCLUDED.name,
      html = EXCLUDED.html,
			dialog = EXCLUDED.dialog,
      timestamp = NOW()`;
    return { res };
  } catch (ex) {
    return JSON.stringify({ func: q.func, res: ex });
  }
}

export async function UpdateListen(q) {
  try {
    let res = await sql`INSERT INTO listen
			(owner, name , data, lang,timestamp)
			VALUES(${q.owner},${q.new_name},${q.data},${q.lang}, NOW() )
			ON CONFLICT (name, lang, owner)
			DO UPDATE SET
			data = EXCLUDED.data, 
      timestamp = NOW() `;
    return { res };
  } catch (ex) {
    return JSON.stringify({ func: q.func, res: ex });  }
}

export async function UpdateWords(q) {
  try {
    let res = await sql`INSERT INTO word
			(name , data, owner, level,context,timestamp)
			VALUES(${q.new_name},${q.data},${q.owner}, ${q.level}, ${q.context},NOW())
			ON CONFLICT (name, owner, level)
			DO UPDATE SET
			name = EXCLUDED.name,
      level = EXCLUDED.level,
			data = EXCLUDED.data,
      context = EXCLUDED.context,
      timestamp = NOW()`;
    return { res };
  } catch (ex) {
    return JSON.stringify({ func: q.func, res: ex });
  }
}

export async function GetPrompt(prompt = '', quiz_name= '', owner= '', level= '', theme= '') {
  let prompt_res, words_res, gram_res, gram;
  try {
    if(prompt)
      prompt_res = await sql`SELECT * FROM prompts WHERE name=${prompt}`;
    if(quiz_name)
      words_res = await sql`SELECT * FROM word WHERE name=${quiz_name}`;
    if(owner && level){
      gram_res = await sql`SELECT * FROM grammar WHERE owner=${owner} AND level=${level}`;
      gram = find(gram_res[0].data, { theme: theme });
    }
  } catch (ex) {
    console.log(JSON.stringify({ res: ex }));
  }
  return {
    prompt: prompt_res[0],
    words: words_res,
    grammar: gram,
  };
}
