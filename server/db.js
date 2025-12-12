import { config } from 'dotenv';
config();

import pkg from 'moment';
const { moment } = pkg;

import pkg_l from 'lodash';
const { find, remove, findIndex, difference } = pkg_l;

import md5 from 'md5';
// import { writable } from 'svelte/store';

import  {GetEmbedding} from './cron/gemini.js'

// import postgres from 'postgres';

import {Pool} from 'pg';

let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID } = process.env;

// Log environment variables (without sensitive data) for debugging
console.log('Database config:', {
  user: process.env.RNDRUSER ? 'SET' : 'NOT SET',
  host: process.env.RNDRHOST ? 'SET' : 'NOT SET',
  database: process.env.RNDRDATABASE ? 'SET' : 'NOT SET',
  password: process.env.RNDRPASSWORD ? 'SET' : 'NOT SET',
  port: 5432
});

export const pool = new Pool({
  user: process.env.RNDRUSER,
  host: process.env.RNDRHOST,
  database: process.env.RNDRDATABASE,
  password: process.env.RNDRPASSWORD,
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  },
  // Add connection timeout
  connectionTimeoutMillis: 5000,
  // Add idle timeout
  idleTimeoutMillis: 30000,
  // Add max connections
  max: 10
});

// Add connection event listeners for better error handling
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Handle the error appropriately
});

pool.on('connect', (client) => {
  console.log('Connected to PostgreSQL database');
});

pool.on('remove', () => {
  console.log('Client removed from pool');
});

// Test the database connection
async function testConnection() {
  let client;
  try {
    client = await pool.connect();
    console.log('Database connection test successful');
    const result = await client.query('SELECT NOW()');
    console.log('Database time:', result.rows[0].now);
  } catch (err) {
    console.error('Database connection test failed:', err.message);
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Run the connection test
// testConnection();

function getHash(par) {
  return md5(par + par);
}


export async function GetGrammar(data) {
  try {
    console.log('GetGrammar called with params:', data);
    
    // Import the JSON data from the file
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const jsonFilePath = path.join(process.cwd(), 'server', 'nt2.json');
    
    let grammarRules;
    try {
      const jsonData = await fs.readFile(jsonFilePath, 'utf8');
      grammarRules = JSON.parse(jsonData);
    } catch (fileError) {
      // If file doesn't exist, load from database
      console.log('nt2.json file not found, loading from database instead');
      let client;
      try {
        client = await pool.connect();
        const result = await client.query('SELECT data FROM nt2 LIMIT 1');
        if (result.rows.length > 0 && result.rows[0].data) {
          grammarRules = result.rows[0].data;
        } else {
          // If no data in database, load from nt2.1.json file and populate database
          console.log('No data in database, loading from nt2.1.json and populating database');
          const backupJsonFilePath = path.join(process.cwd(), 'server', 'nt2.1.json');
          const jsonData = await fs.readFile(backupJsonFilePath, 'utf8');
          grammarRules = JSON.parse(jsonData);
          await populateNt2Table(grammarRules);
        }
      } catch (dbError) {
        console.error('Error loading from database:', dbError);
        throw dbError;
      } finally {
        if (client) client.release();
      }
    }
    
    // Get data by sequential index (data.level as 1-based level, convert to 0-based array index)
    const ruleIndex = data.level - 1;
    
    if (ruleIndex < 0 || ruleIndex >= grammarRules.length) {
      console.log(`Level ${data.level} (index ${ruleIndex}) is out of bounds. Array length: ${grammarRules.length}`);
      return [];
    }
    
    const rule = grammarRules[ruleIndex];
    
    // Map the JSON structure to match GrammarRow interface (without kolmit_level)
    const result = [{
      cefr: rule.cefr_level,
      rule_name: rule.rule_name,
      description: rule.description,
      rule_text: rule.rule_text,
      examples: rule.examples,
    }];
    
    console.log(`GetGrammar result from JSON (level ${data.level}, index ${ruleIndex}):`, result);
    return result;
  } catch (ex) {
    console.error('Error in GetGrammar:', ex);
    // logError('GetGrammar', ex, { data });
    return [];
  }
}

// Helper function to populate nt2 table from JSON data
async function populateNt2Table(grammarRules) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS nt2 (
        id SERIAL PRIMARY KEY,
        data JSONB
      )
    `);
    
    // Insert or update data
    await client.query(
      `INSERT INTO nt2 (data) VALUES ($1)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [JSON.stringify(grammarRules)]
    );
    
    await client.query('COMMIT');
    console.log('nt2 table populated successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error populating nt2 table:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function GetGrammarRegionToLevel(data) {
  try {
    // White list of allowed files (important for security!)
    const allowedFiles = ["nt2.json", "nt2_3.json"];
    const fileName = data.file || "nt2.json";
    
    if (!allowedFiles.includes(fileName)) {
      throw new Error("Invalid file name");
    }

    // Validate that level is a valid integer
    let level = parseInt(data.level);
    if (isNaN(level) || level === undefined || level === null) {
      console.warn("Invalid or missing level provided to GetGrammarRegionToLevel, defaulting to 0:", data.level);
      level = 0;
    }

    // Read JSON file or load from database
    const fs = await import('fs/promises');
    const path = await import('path');
    
    let grammarRules = [];
    try {
      // Fetch data from the nt2_1 database table
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT a0, a1, a2, b1, b2 FROM nt2_1 ORDER BY version DESC LIMIT 1');
        
        if (result.rows.length > 0) {
          const row = result.rows[0];
          
          // Combine all CEFR level data into a single array
          if (row.a0) grammarRules = grammarRules.concat(row.a0);
          if (row.a1) grammarRules = grammarRules.concat(row.a1);
          if (row.a2) grammarRules = grammarRules.concat(row.a2);
          if (row.b1) grammarRules = grammarRules.concat(row.b1);
          if (row.b2) grammarRules = grammarRules.concat(row.b2);
        }
      } finally {
        client.release();
      }
      
      // If no data was found in the database, fall back to reading files
      if (grammarRules.length === 0) {
        // Read all CEFR level files and combine them
        const cefrLevels = ['a0', 'a1', 'a2', 'b1', 'b2'];
        for (const level of cefrLevels) {
          const jsonFilePath = path.join(process.cwd(), 'prompts', 'nt2', `nt2.${level}.json`);
          try {
            const jsonData = await fs.readFile(jsonFilePath, 'utf8');
            const levelRules = JSON.parse(jsonData);
            grammarRules = grammarRules.concat(levelRules);
          } catch (fileError) {
            console.log(`nt2.${level}.json file not found or could not be parsed`);
          }
        }
        
        // If no files were found, fall back to the original path
        if (grammarRules.length === 0) {
          const jsonFilePath = path.join(process.cwd(), 'prompts', fileName);
          const jsonData = await fs.readFile(jsonFilePath, 'utf8');
          grammarRules = JSON.parse(jsonData);
        }
      }
    } catch (fileError) {
      // If file doesn't exist, load from database
      console.log(`${fileName} file not found, loading from database instead`);
      let client;
      try {
        client = await pool.connect();
        const result = await client.query('SELECT data FROM nt2 LIMIT 1');
        if (result.rows.length > 0 && result.rows[0].data) {
          grammarRules = result.rows[0].data;
        } else {
          // If no data in database, load from nt2.1.json file and populate database
          console.log('No data in database, loading from nt2.1.json and populating database');
          const backupJsonFilePath = path.join(process.cwd(), 'server', 'nt2.1.json');
          const jsonData = await fs.readFile(backupJsonFilePath, 'utf8');
          grammarRules = JSON.parse(jsonData);
          await populateNt2Table(grammarRules);
        }
      } catch (dbError) {
        console.error('Error loading from database:', dbError);
        throw dbError;
      } finally {
        if (client) client.release();
      }
    }

    // Add kolmit_level based on array index (starting from 1 to match database behavior)
    const rulesWithLevel = grammarRules.map((rule, index) => ({
      ...rule,
      kolmit_level: index + 1
    }));

    // Filter rules for region (±3 levels from current level)
    const regionRecords = rulesWithLevel.filter(rule => 
      rule.kolmit_level <= level && rule.kolmit_level >= level-9
    ).map(item => ({
      kolmit_level: item.kolmit_level,
      cefr_level: item.cefr_level,
      rule_name: item.rule_name,
      rule_text: item.rule_text,
      // description: item.description,
      // examples: item.examples
    }));

    // Filter rules for exact level
    const levelRecords = rulesWithLevel.filter(rule => 
      rule.kolmit_level === level
    ).map(item => ({
      kolmit_level: item.kolmit_level,
      cefr_level: item.cefr_level,
      rule_name: item.rule_name,
      rule_text: item.rule_text,
      description: item.description,
      examples: item.examples
    }));

    return {
      region: regionRecords,
      level: levelRecords
    };

  } catch (ex) {
    console.error("Error in GetGrammarRegionToLevel:", ex);
    return null;
  }
}

export async function GetGrammarRegion(data) {
  try {
    // White list of allowed files (important for security!)
    const allowedFiles = ["nt2.json", "nt2_3.json"];
    const fileName = data.file || "nt2.json";
    
    if (!allowedFiles.includes(fileName)) {
      throw new Error("Invalid file name");
    }

    // Validate that level is a valid integer
    let level = parseInt(data.level);
    if (isNaN(level) || level === undefined || level === null) {
      console.warn("Invalid or missing level provided to GetGrammarRegion, defaulting to 0:", data.level);
      level = 0;
    }

    // Read JSON file or load from database
    const fs = await import('fs/promises');
    const path = await import('path');
    
    let grammarRules = [];
    try {
      // Fetch data from the nt2_1 database table
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT a0, a1, a2, b1, b2 FROM nt2_1 ORDER BY version DESC LIMIT 1');
        
        if (result.rows.length > 0) {
          const row = result.rows[0];
          
          // Combine all CEFR level data into a single array
          if (row.a0) grammarRules = grammarRules.concat(row.a0);
          if (row.a1) grammarRules = grammarRules.concat(row.a1);
          if (row.a2) grammarRules = grammarRules.concat(row.a2);
          if (row.b1) grammarRules = grammarRules.concat(row.b1);
          if (row.b2) grammarRules = grammarRules.concat(row.b2);
        }
      } finally {
        client.release();
      }
      
      // If no data was found in the database, fall back to reading files
      if (grammarRules.length === 0) {
        // Read all CEFR level files and combine them
        const cefrLevels = ['a0', 'a1', 'a2', 'b1', 'b2'];
        for (const level of cefrLevels) {
          const jsonFilePath = path.join(process.cwd(), 'prompts', 'nt2', `nt2.${level}.json`);
          try {
            const jsonData = await fs.readFile(jsonFilePath, 'utf8');
            const levelRules = JSON.parse(jsonData);
            grammarRules = grammarRules.concat(levelRules);
          } catch (fileError) {
            console.log(`nt2.${level}.json file not found or could not be parsed`);
          }
        }
        
        // If no files were found, fall back to the original path
        if (grammarRules.length === 0) {
          const jsonFilePath = path.join(process.cwd(), 'prompts', 'nt2.json');
          const jsonData = await fs.readFile(jsonFilePath, 'utf8');
          grammarRules = JSON.parse(jsonData);
        }
      }
    } catch (fileError) {
      // If file doesn't exist, load from database
      console.log(`${fileName} file not found, loading from database instead`);
      try {
        const result = await pool.query('SELECT data FROM nt2 ORDER BY version DESC LIMIT 1');
        if (result.rows.length > 0 && result.rows[0].data) {
          grammarRules = result.rows[0].data;
        } else {
          // If no data in database, load from nt2.1.json file and populate database
          console.log('No data in database, loading from nt2.1.json and populating database');
          const backupJsonFilePath = path.join(process.cwd(), 'server', 'nt2.1.json');
          const jsonData = await fs.readFile(backupJsonFilePath, 'utf8');
          grammarRules = JSON.parse(jsonData);
        }
      } catch (dbError) {
        console.error('Error loading from database:', dbError);
        throw dbError;
      }
    }

    // Add kolmit_level based on array index (starting from 1 to match database behavior)
    const rulesWithLevel = grammarRules.map((rule, index) => ({
      ...rule,
      kolmit_level: index + 1
    }));

    // Filter rules for region (±3 levels from current level)
    const regionRecords = rulesWithLevel.filter(rule => 
      rule.kolmit_level <= level && rule.kolmit_level >= level-10 && rule.cefr_level !== 'A0'
    ).map(item => ({
      kolmit_level: item.kolmit_level,
      cefr_level: item.cefr_level,
      rule_name: item.rule_name,
      rule_text: item.rule_text,
      description: item.description,
      examples: item.examples,
      nt2_theme: item.nt2_theme // Add nt2_theme to the region records
    }));

    // Filter rules for exact level
    const levelRecords = rulesWithLevel.filter(rule => 
      rule.kolmit_level === level && rule.cefr_level !== 'A0'
    ).map(item => ({
      kolmit_level: item.kolmit_level,
      cefr_level: item.cefr_level,
      rule_name: item.rule_name,
      rule_text: item.rule_text,
      description: item.description,
      examples: item.examples,
      nt2_theme: item.nt2_theme // Add nt2_theme to the level records
    }));

    return {
      region: regionRecords,
      level: levelRecords
    };

  } catch (ex) {
    console.error("Error in GetGrammarRegion:", ex);
    return null;
  }
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
		'FROM  operators as oper'+ 
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

export async function GetLevelCriteria(level) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT level_criteria_ru
       FROM levels
       WHERE level_number = $1`,
      [level]
    );

    return res.rows.length > 0 ? res.rows[0].level_criteria_ru : null;
  } catch (ex) {
    console.error('Error in GetLevelCriteria:', ex);
    return null;
  } finally {
    client.release();
  }
}

export async function getLevels(abonent) {
  let client;
  try {
    client = await pool.connect();
    const query = abonent !== 'public'
      ? `SELECT level AS level_group
         FROM groups
         WHERE owner = $1
           AND level IS NOT NULL
           AND level != ''`
      : `SELECT DISTINCT (CAST(level AS INTEGER) / 5) * 5 AS level_group
         FROM operators
         WHERE abonent = $1
           AND level IS NOT NULL
           AND level != ''
         ORDER BY level_group`;

    const res = await client.query(query, [abonent]);

    return res.rows
      .map(row => row.level_group)
      .filter(level => level !== null);
  } catch (ex) {
    console.error('Error in getLevels:', ex);
    return [];
  } finally {
    if (client) client.release();
  }
}

/**
 * Get top words for a specific level from the subtlex table
 * Selects words where id < level*20
 * @param {number} level - The level to get top words for
 * @returns {Promise<Array>} Array of top words
 */
export async function GetLevelTopWords(level, limit) {
  const client = await pool.connect();
  try {
    // Calculate the threshold: level * 50
    const threshold = level * 50;
    
    // First, check if the subtlex table exists and has data
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables WHERE table_name = 'subtlex'
        ) AS table_exists
      `);
      
      if (!tableCheck.rows[0].table_exists) {
        console.warn('SUBTLEX table does not exist. Returning empty array.');
        return [];
      }
      
      // Check if table has any data
      const dataCheck = await client.query('SELECT COUNT(*) as count FROM subtlex');
      if (parseInt(dataCheck.rows[0].count) === 0) {
        console.warn('SUBTLEX table is empty. Returning empty array.');
        return [];
      }
    } catch (checkError) {
      console.warn('Error checking SUBTLEX table existence:', checkError.message);
      return [];
    }
    
    // Query to select words from subtlex table where id < threshold
    // Include the rank (id) of each word
    const res = await client.query(
      `SELECT word, id as rank
       FROM subtlex
       WHERE id < $1
       ORDER BY id DESC
       LIMIT $2`,
      [threshold, limit]
    );

    // Return array of objects with word and rank
    return res.rows.map(row => `${row.word}(${row.rank})`);
  } catch (ex) {
    console.error('Error in GetLevelTopWords:', ex);
    return []; // Return empty array in case of error
  } finally {
    client.release();
  }
}

export async function GetAllSubtlexData() {
  const client = await pool.connect();
  try {
    // Query to select all words from subtlex table
    // Based on GetLevelTopWords, the table has columns: word, id
    const res = await client.query(`
      SELECT word, id
      FROM subtlex
      ORDER BY id ASC
    `);
    
    // Create a Map with words as keys and IDs as values (using ID as proxy for frequency)
    const wordFrequencyMap = new Map();
    const sortedWords = [];
    
    for (const row of res.rows) {
      wordFrequencyMap.set(row.word.toLowerCase(), row.id);
      sortedWords.push(row.word.toLowerCase());
    }
    
    // Return both the map and sorted words array
    return {
      frequencyData: wordFrequencyMap,
      sortedWords: sortedWords
    };
  } catch (ex) {
    console.error('Error in GetAllSubtlexData:', ex);
    return { frequencyData: new Map(), sortedWords: [] };
  } finally {
    client.release();
  }
}

export async function GetWordFrequency(word) {
  const client = await pool.connect();
  try {
    // Query to get ID for a specific word (using ID as proxy for frequency)
    const res = await client.query(
      `SELECT id FROM subtlex WHERE word = LOWER($1)`,
      [word]
    );
    
    if (res.rows.length > 0) {
      return res.rows[0].id;
    }
    
    return null;
  } catch (ex) {
    console.error('Error in GetWordFrequency:', ex);
    return null;
  } finally {
    client.release();
  }
}

export async function WriteSpeech(q) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO speech (lang, key, text, data, quiz, timestamps)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (key) DO UPDATE SET
         lang = EXCLUDED.lang,
         text = EXCLUDED.text,
         data = EXCLUDED.data,
         quiz = EXCLUDED.quiz,
         timestamps = EXCLUDED.timestamps`,
      [q.lang, q.key, q.text, q.data, q.quiz, q.timestamps]
    );

    await client.query('COMMIT');
    return { success: true, message: 'Data written successfully.' };
  } catch (ex) {
    await client.query('ROLLBACK');
    console.error('Error writing speech:', ex);
    return { success: false, message: 'Failed to write data.', error: ex };
  } finally {
    client.release();
  }
}


export async function ReadSpeech(q) {
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query(
      `SELECT data
       FROM speech
       WHERE key = $1
       AND quiz IS NOT NULL`,
      [q.key]
    );

    return rows[0]?.data || null;
  } catch (ex) {
    console.error('Error reading speech:', ex);
    return null;
  } finally {
    if (client) client.release();
  }
}

export async function GetPrompt(name) {
  try {
    // First, try to read from the prompts folder
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Try to read system prompt file
      let systemContent = null;
      try {
        const systemFilePath = path.join(process.cwd(), '.', 'prompts', `${name}.system.txt`);
        systemContent = await fs.readFile(systemFilePath, 'utf8');
      } catch (systemError) {
        // System file doesn't exist, try the old naming convention
        try {
          const systemFilePath = path.join(process.cwd(), '.', 'prompts', `${name}.txt`);
          systemContent = await fs.readFile(systemFilePath, 'utf8');
        } catch (oldSystemError) {
          // Try pattern *.*.nl.txt
          try {
            const systemFilePath = path.join(process.cwd(), '.', 'prompts', `${name}.nl.txt`);
            systemContent = await fs.readFile(systemFilePath, 'utf8');
          } catch (nlError) {
            // Neither system file exists
            console.log(`System prompt file not found for ${name}`);
          }
        }
      }
      
      // Try to read user prompt file
      let userContent = null;
      try {
        const userFilePath = path.join(process.cwd(), '.', 'prompts', `${name}.user.txt`);
        userContent = await fs.readFile(userFilePath, 'utf8');
      } catch (userError) {
        // User file doesn't exist
        console.log(`User prompt file not found for ${name}`);
      }
      
      // If we have at least one file, return the prompt object
      if (systemContent || userContent) {
        const promptObj = {};
        if (systemContent) promptObj.system = systemContent.trim();
        if (userContent) promptObj.user = userContent.trim();
        return { prompt: promptObj };
      }
      
      // If no files found, continue to database lookup
      console.log(`Prompt files not found for ${name}, falling back to database`);
    } catch (fileError) {
      // File system error, continue to database lookup
      console.log(`Error reading prompt files for ${name}, falling back to database:`, fileError.message);
    }

    // Fallback to database lookup
    let client;
    try {
      client = await pool.connect();
      const res = await client.query(
        `SELECT * FROM prompts WHERE name = $1 ORDER BY string_to_array(version, '.')::int[] DESC`,
        [name]
      );

      return res.rows[0] ? { prompt: res.rows[0] } : { prompt: 'Prompt not found' };
    } catch (ex) {
      console.error('Error in GetPrompt:', ex);
      return null;
    } finally {
      if (client) client.release();
    }
  } catch (ex) {
    console.error('Error in GetPrompt:', ex);
    return null;
  }
}

async function UpdateLesson(client, type = 'bricks', data) {
  // Тут нет BEGIN/COMMIT/ROLLBACK и client.release()
  // Работаем в рамках транзакции, которую начал вызывающий код

  // 1. Получаем текущий урок
  const lessonResult = await client.query(
    `
    SELECT data
    FROM lessons
    WHERE "owner" = $1 AND "level" = $2 AND lang = 'nl';
    `,
    [data.owner, data.level]
  );

  if (lessonResult.rows.length === 0) {
    throw new Error('No lesson found for the provided criteria.');
  }

  let lessonData = lessonResult.rows[0].data;

  // 2. Находим или создаём тему
  let theme = lessonData.module.themes.find(
    (t) => t.name.nl === data.theme
  );

  if (!theme) {
    theme = {
      name: { nl: data.theme },
      lessons: [
        {
          type: 'default',
          content: 'Initial content for the lesson',
          quizes: [],
        },
      ],
    };
    lessonData.module.themes.push(theme);
  }

  // 3. Проверяем или создаём quiz
  let lesson = theme.lessons[0];
  
  // Добавляем дополнительные проверки для устранения ошибки TypeError: Cannot read properties of undefined
  if (!lesson) {
    // Если у темы нет уроков, создаем пустой урок
    lesson = {
      type: 'default',
      content: 'Initial content for the lesson',
      quizes: []
    };
    theme.lessons[0] = lesson;
  }
  
  // Убедимся, что массив quizes существует
  if (!lesson.quizes) {
    lesson.quizes = [];
  }

  // Проверим, что lesson.quizes - это массив
  if (!Array.isArray(lesson.quizes)) {
    lesson.quizes = [];
  }

  const quizExists = lesson.quizes.some(
    (quiz) => quiz.type === type && quiz.name.nl === data.name
  );

  if (!quizExists) {
    lesson.quizes.push({
      type: type,
      name: { nl: data.name },
      published:  Date.now(),
    });
  }

  // 4. Обновляем запись
  await client.query(
    `
    UPDATE lessons
    SET data = $1, "timestamp" = CURRENT_TIMESTAMP
    WHERE "owner" = $2 AND "level" = $3 AND lang = 'nl';
    `,
    [lessonData, data.owner, data.level]
  );
}

export async function createBrickAndUpdateLesson(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Вставка или обновление в bricks
    // await client.query(
    //   `INSERT INTO bricks ("name", "owner", "data", "level", "timestamp", "theme", "prompt_type")
    //    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6)
    //    ON CONFLICT ("name", "owner", "level")
    //    DO UPDATE SET 
    //      data = EXCLUDED.data,
    //      timestamp = CURRENT_TIMESTAMP`,
    //   [data.name, data.owner, data.content, data.level, data.theme, data.type]
    // );

    // Обновляем урок в рамках той же транзакции
    await UpdateLesson(client, 'bricks', data);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing brick and updating lesson:', error);
    throw error;
  } finally {
    client.release();
  }
}


export async function UpdateDialog(data) {
  const dlg = data.dialog; // если нужно, можно добавить очистку строки

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO dialogs ("name", "data", "owner", "html", "level", "theme", "prompt_type")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT ("name", "owner", "level")
       DO UPDATE SET 
         data = EXCLUDED.data,
         html = EXCLUDED.html`,
      [data.name, dlg, data.owner, data.html, data.level, data.theme, data.type]
    );

    await UpdateLesson(client, 'dialogs', data);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing dialog and updating lesson:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Функция сохранения статьи
export async function SaveArticle(theme, title, content, level, type, link, model = null) {
  const client = await pool.connect();
  let embeddingString = null;

  // Если хочешь использовать эмбеддинги, раскомментируй и доработай
  // try {
  //   const embedding = await GetEmbedding(content);
  //   if (!embedding || !Array.isArray(embedding)) {
  //     throw new Error('Embedding is undefined or not an array');          
  //   }
  //   embeddingString = JSON.stringify(embedding);
  // } catch (ex) {
  //   console.warn('Failed to get embedding:', ex);
  // }

  try {
    const contentString = JSON.stringify(content);

    // Update the query to include the model column
    const query = `
      INSERT INTO articles (theme, title, content, level, embedding, type, link, model)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (link, level) 
      DO UPDATE SET content = EXCLUDED.content, published_at = CURRENT_TIMESTAMP, model = EXCLUDED.model
      RETURNING id
    `;

    const values = [
      theme,
      title,
      contentString,
      level,
      embeddingString,
      type,
      link,
      model
    ];

    const res = await client.query(query, values);

    if(res.rows[0])
      console.log('Article saved with ID:', res.rows[0].id);
    return;
  } catch (err) {
    console.error('Error saving article:', err);
    throw err;
  } finally {
    client.release();
  }
}

export async function GetLessonsByDate() {
  let client;
  try {
    client = await pool.connect();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const result = await client.query(
      `SELECT owner, data, level, lang
       FROM lessons
       WHERE timestamp BETWEEN $1 AND $2
       ORDER BY level DESC`,
      [startOfDay, endOfDay]
    );

    return result.rows;
  } catch (ex) {
    console.error('Error in GetLessonsByDate:', ex);
    return [];
  } finally {
    if (client) client.release();
  }
}

export function SendEmailTodayPublished(q) {
  let operator = new Email();
  const mail = q.send_email;
  const head = q.head;
  const html = q.html;

  operator.SendMail(mail, head, html, (result) => {
    console.log('Письмо успешно отправлено:', result);
  });
}

