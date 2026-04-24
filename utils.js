'use strict'
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules        
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);      

// Create logs directory if it doesn't exist     
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Logger utility
export const logger = {
  // Log to both console and file
  log: function(level, message) {
    const timestamp = new Date().toISOString();  
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}\n`;                     
    // Log to console
    console.log(message);

    // Log to file
    const logFile = path.join(logsDir, `${new Date().toISOString().split('T')[0]}.json`);              
    fs.appendFileSync(logFile, logMessage);      
  },

  info: function(message) {
    this.log('info', message);
  },

  error: function(message) {
    this.log('error', message);
  },

  warn: function(message) {
    this.log('warn', message);
  },

  debug: function(message) {
    this.log('debug', message);
  },

  // Test function to verify file writing        
  test: function() {
    const testMessage = 'Logger test: ' + new Date().toISOString();
    this.log('info', testMessage);
  },

  // New function to log prompts and their results
  logPrompt: function(name, prompt) {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        name,
        prompt
      };

      // Log to file only (avoid cluttering console)
      const logFile = path.join(logsDir, `prompt-${name}-${new Date().toISOString().split('T')[0]}.json`);                                                
      fs.writeFileSync(logFile, JSON.stringify(logEntry) + '\n');                                     
    } catch (error) {
      console.error('Error writing prompt log:', error);                                              
    }
  },

  logPromptResult: function(name, result) {
    try {
      // Ensure result is an object
      const resultObj = typeof result === 'object' ? result : { value: result };
      
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        name,
        result: resultObj
      };

      // Log to file only (avoid cluttering console)
      const logFile = path.join(logsDir, `result-${name}-${new Date().toISOString().split('T')[0]}.json`);
      fs.writeFileSync(logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('Error writing result log:', error);
    }
  }
};

export default {
    logger,
    
    /**
     * Clean and extract JSON from a string that might contain markdown code blocks or other formatting
     * @param {string} str - The string to clean and extract JSON from
     * @returns {object|null} - The parsed JSON object or null if parsing fails
     */
    cleanAndParseJSON: function(str) {
        if (!str) return null;
        
        try {
            // First, try to parse as-is in case it's already clean JSON
            return JSON.parse(str);
        } catch (e) {
            // If that fails, try multiple cleaning strategies
            try {
                // Strategy 1: Remove markdown code block markers
                let cleaned = str.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1');
                cleaned = cleaned.trim();
                
                // Strategy 2: Fix common JSON issues
                // Remove trailing commas before closing braces/brackets
                cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
                
                // Fix unescaped quotes in strings (basic attempt)
                // This is tricky, so we'll try to be conservative
                
                // Strategy 3: Extract JSON from text
                // Try to find balanced braces approach
                const firstBrace = cleaned.indexOf('{');
                const lastBrace = cleaned.lastIndexOf('}');
                
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    let jsonString = cleaned.substring(firstBrace, lastBrace + 1);
                    
                    // Try to fix common array issues
                    // Remove trailing commas in arrays
                    jsonString = jsonString.replace(/,\s*]/g, ']');
                    
                    try {
                        return JSON.parse(jsonString);
                    } catch (parseError) {
                        // Log the problematic JSON for debugging
                        console.error('JSON parse error at position:', parseError.message);
                        console.error('Problematic JSON section:', jsonString.substring(Math.max(0, 800), Math.min(jsonString.length, 900)));
                        
                        // Strategy 4: Try to fix the specific issue at the error position
                        const positionMatch = parseError.message.match(/position (\d+)/);
                        if (positionMatch) {
                            const errorPos = parseInt(positionMatch[1]);
                            const before = jsonString.substring(Math.max(0, errorPos - 50), errorPos);
                            const after = jsonString.substring(errorPos, Math.min(jsonString.length, errorPos + 50));
                            console.error('Context around error:', { before, after });
                        }
                        
                        return null;
                    }
                }
                
                // If we still have issues, try the original string
                return JSON.parse(cleaned);
            } catch (e2) {
                console.error('Failed to parse JSON even after cleaning:', e2);
                console.error('Original string length:', str.length);
                console.error('First 200 chars:', str.substring(0, 200));
                return null;
            }
        }
    },

    formatSSE(str){
        return 'data: '+ JSON.stringify(str) +'\n\n,retry: 100'+ '\n\n';                             
    },

    getParameterByName: function (name, url) {   
    if (!url) url = window.location.href;        
    name = name.replace(/[\[\]]/g, "\\$&");      
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),                                         
    results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));                                        
    },

    toJSONLocal: function (date) {
    var local = new Date(date);
    local.setMinutes(date.getMinutes() - date.getTimezoneOffset());                                   
    return local.toJSON().slice(0, 10);
    },

    QueryMethod : function (protocol,options, postData, res, cb) {                                        
        let http_;
        if(protocol==='http')
            http_ = http;
        else if(protocol==='https')
            http_ = https;
    var req = http_.request(options, function (res) {                                                     
        console.log('Status: ' + res.statusCode);
        console.log('Headers: ' + JSON.stringify(res.headers));                                           
        res.setEncoding('utf8');
        res.on('data', function (body) {
            console.log('Body: ' + body);        
            cb(body, res);
        });
    });
    req.on('error', function (e) {
        console.log('problem with request: ' + e.message);                                                
        cb('error', res);
    });
    // write data to request body
    if (postData)
        req.write(postData);
    req.end();

    },

    Parse:function (result) {
        try {
            return JSON.parse(result);
        } catch (e) {
            throw e;
        }
    },
    
    HTML:function(){
        var x,mnem=
            {34:"quot",38:"amp",39:"apos",60:"lt",62:"gt",402:"fnof",                                         
            338:"OElig",339:"oelig",352:"Scaron",353:"scaron",                                                
            376:"Yuml",710:"circ",732:"tilde",8226:"bull",8230:"hellip",                                      
            8242:"prime",8243:"Prime",8254:"oline",8260:"frasl",8472:"weierp",                                
            8465:"image",8476:"real",8482:"trade",8501:"alefsym",8592:"larr",                                 
            8593:"uarr",8594:"rarr",8595:"darr",8596:"harr",8629:"crarr",                                     
            8656:"lArr",8657:"uArr",8658:"rArr",8659:"dArr",8660:"hArr",                                      
            8704:"forall",8706:"part",8707:"exist",8709:"empty",8711:"nabla",                                 
            8712:"isin",8713:"notin",8715:"ni",8719:"prod",8721:"sum",                                        
            8722:"minus",8727:"lowast",8730:"radic",8733:"prop",8734:"infin",                                 
            8736:"ang",8743:"and",8744:"or",8745:"cap",8746:"cup",8747:"int",                                 
            8756:"there4",8764:"sim",8773:"cong",8776:"asymp",8800:"ne",                                      
            8801:"equiv",8804:"le",8805:"ge",8834:"sub",8835:"sup",8836:"nsub",                               
            8838:"sube",8839:"supe",8853:"oplus",8855:"otimes",8869:"perp",                                   
            8901:"sdot",8968:"lceil",8969:"rceil",8970:"lfloor",8971:"rfloor",                                
            9001:"lang",9002:"rang",9674:"loz",9824:"spades",9827:"clubs",                                    
            9829:"hearts",9830:"diams",8194:"ensp",8195:"emsp",8201:"thinsp",                                 
            8204:"zwnj",8205:"zwj",8206:"lrm",8207:"rlm",8211:"ndash",                                        
            8212:"mdash",8216:"lsquo",8217:"rsquo",8218:"sbquo",8220:"ldquo",                                 
            8221:"rdquo",8222:"bdquo",8224:"dagger",8225:"Dagger",8240:"permil",                              
            8249:"lsaquo",8250:"rsaquo",8364:"euro",977:"thetasym",978:"upsih",982:"piv"},
            tab=("nbsp|iexcl|cent|pound|curren|yen|brvbar|sect|uml|"+
                 "copy|ordf|laquo|not|shy|reg|macr|deg|plusmn|sup2|sup3|"+
                 "acute|micro|para|middot|cedil|sup1|ordm|raquo|frac14|"+
                 "frac12|frac34|iquest|Agrave|Aacute|Acirc|Atilde|Auml|"+
                 "Aring|AElig|Ccedil|Egrave|Eacute|Ecirc|Euml|Igrave|"+
                 "Iacute|Icirc|Iuml|ETH|Ntilde|Ograve|Oacute|Ocirc|Otilde|"+
                 "Ouml|times|Oslash|Ugrave|Uacute|Ucirc|Uuml|Yacute|THORN|"+
                 "szlig|agrave|aacute|acirc|atilde|auml|aring|aelig|ccedil|"+
                 "egrave|eacute|ecirc|euml|igrave|iacute|icirc|iuml|eth|ntilde|"+
                 "ograve|oacute|ocirc|otilde|ouml|divide|oslash|ugrave|uacute|"+
                 "ucirc|uuml|yacute|thorn|yuml").split("|");                                               
        for(x=0;x<96;x++)mnem[160+x]=tab[x];     
        tab=("Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|"+
             "Lambda|Mu|Nu|Xi|Omicron|Pi|Rho").split("|");                                             
        for(x=0;x<17;x++)mnem[913+x]=tab[x];     
        tab=("Sigma|Tau|Upsilon|Phi|Chi|Psi|Omega").split("|");                                           
        for(x=0;x<7;x++)mnem[931+x]=tab[x];      
        tab=("alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|"+
             "lambda|mu|nu|xi|omicron|pi|rho|sigmaf|sigma|tau|upsilon|phi|chi|"+
             "psi|omega").split("|");
        for(x=0;x<25;x++)mnem[945+x]=tab[x];     
        return {
            encode:function(text){
                return text.replace(/[\u00A0-\u2666<>\&]/g,function(a){                                               
                    return "&"+(mnem[a=a.charCodeAt(0)]||"#"+a)+";"                                               
                })
            },
            decode:function(text){
                return text.replace(/\&#?(\w+);/g,function(a,b){                                                     
                    if(Number(b))return String.fromCharCode(Number(b));                                               
                    for(x in mnem){
                        if(mnem[x]===b)return String.fromCharCode(x);                                                 
                    }
                })
            }
        }
    },
    
    getObjects: function(obj, key, val) {        
        var objects = [];
        for (var i in obj) {
            if (!obj.hasOwnProperty(i)) continue;
            if (typeof obj[i] == 'object') {     
                objects = objects.concat(this.getObjects(obj[i], key, val));                                      
            } else if (i == key && obj[key] == val) {                                                            
                objects.push(obj);
            }
        }
        return objects;
    },
    
    // Function to extract CEFR scale data from nt2_1 table
    GetCefrScale: async function() {
      // Dynamically create the scale based on actual data from nt2_1 table
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Try to fetch data from the nt2_1 database table first
      let data = [];
      try {
        // Import the pool from db.js
        const { pool } = await import('./server/db.js');
        const client = await pool.connect();
        try {
          const result = await client.query('SELECT a0, a1, a2, b1, b2 FROM nt2_1 ORDER BY version DESC LIMIT 1');
          
          if (result.rows.length > 0) {
            const row = result.rows[0];
            
            // Combine all CEFR level data into a single array
            if (row.a0) data = data.concat(row.a0);
            if (row.a1) data = data.concat(row.a1);
            if (row.a2) data = data.concat(row.a2);
            if (row.b1) data = data.concat(row.b1);
            if (row.b2) data = data.concat(row.b2);
          }
        } finally {
          client.release();
        }
      } catch (dbError) {
        console.log('Error fetching data from nt2_1 table, falling back to file reading:', dbError.message);
      }
      
      // If no data was found in the database, fall back to reading files
      if (data.length === 0) {
        try {
          const cefrLevels = ['a0', 'a1', 'a2', 'b1', 'b2'];
          for (const level of cefrLevels) {
            const jsonFilePath = path.join(process.cwd(), 'prompts', 'nt2', `nt2.${level}.json`);
            try {
              const jsonData = await fs.readFile(jsonFilePath, 'utf8');
              const levelRules = JSON.parse(jsonData);
              data = data.concat(levelRules);
            } catch (fileError) {
              console.log(`nt2.${level}.json file not found or could not be parsed`);
            }
          }
          
          // If no files were found, fall back to the original path
          if (data.length === 0) {
            const jsonFilePath = path.join(process.cwd(), 'prompts', 'nt2.json');
            const jsonData = await fs.readFile(jsonFilePath, 'utf8');
            data = JSON.parse(jsonData);
          }
        } catch (error) {
          console.error('Error reading nt2 files:', error);
          // Return a default scale if file reading fails
          return {
            "1-9": "A0",
            "10-31": "A1",
            "32-49": "A2",
            "50-66": "B1",
            "67-100": "B2"
          };
        }
      }

      const cefrGroups = {};
      data.forEach(item => {
        if (!item.cefr_level || item.level === undefined) return;
        const baseLevel = item.cefr_level.substring(0, 2);
        const kolmitLevel = parseFloat(item.level);
        if (isNaN(kolmitLevel)) return;
        if (!cefrGroups[baseLevel]) {
          cefrGroups[baseLevel] = { min: kolmitLevel, max: kolmitLevel };
        } else {
          cefrGroups[baseLevel].min = Math.min(cefrGroups[baseLevel].min, kolmitLevel);
          cefrGroups[baseLevel].max = Math.max(cefrGroups[baseLevel].max, kolmitLevel);
        }
      });

      const cefrRanges = {};
      Object.entries(cefrGroups)
        .sort((a, b) => a[1].min - b[1].min)
        .forEach(([cefrName, range]) => {
          cefrRanges[`${range.min}-${range.max}`] = cefrName;
        });

      return cefrRanges;
    },

    // Function to get CEFR level name by numerical level
    GetCefrLevelName: async function(level) {
      const cefrScale = await this.GetCefrScale();
      
      // Find the CEFR level name for the given numerical level
      let cefrLevelName = 'A0'; // Default to A0
      
      // Sort the keys numerically to ensure correct order
      const sortedLevels = Object.keys(cefrScale).sort((a, b) => parseInt(a) - parseInt(b));
      
      // Find the appropriate CEFR level name
      for (const kolmitLevel of sortedLevels) {
        if (level >= parseInt(kolmitLevel)) {
          cefrLevelName = cefrScale[kolmitLevel];
        }
      }
      
      // For sub-levels, we need to calculate based on the position within a CEFR level range
      // First, let's find which CEFR level range the level falls into
      let prevLevel = 0;
      let prevCefr = 'A0';
      let nextLevel = Infinity;
      let nextCefr = '';
      
      for (const kolmitLevel of sortedLevels) {
        const currentKolmit = parseInt(kolmitLevel);
        const currentCefr = cefrScale[kolmitLevel];
        
        if (currentKolmit <= level) {
          prevLevel = currentKolmit;
          prevCefr = currentCefr;
        }
        
        if (currentKolmit > level && currentKolmit < nextLevel) {
          nextLevel = currentKolmit;
          nextCefr = currentCefr;
        }
      }
      
      // If we're exactly at a CEFR level boundary, return that level
      if (sortedLevels.includes(level.toString())) {
        return cefrScale[level];
      }
      
      // Calculate sub-levels for more granular positioning
      if (nextLevel !== Infinity) {
        // Calculate how far between the previous and next CEFR levels we are
        const range = nextLevel - prevLevel;
        const position = level - prevLevel;
        
        // Only create sublevels if there's enough space (more than 10 positions)
        if (range > 10) {
          // Calculate sublevel (1-9)
          const subLevel = Math.max(1, Math.min(9, Math.floor((position / range) * 10)));
          cefrLevelName = `${prevCefr}.${subLevel}`;
        }
      }
      
      return cefrLevelName;
    }
}

// Function to extract CEFR scale data from nt2_1 table
export async function GetCefrScale() {
  // Dynamically create the scale based on actual data from nt2_1 table
  const fs = await import('fs/promises');
  const path = await import('path');
  
  // Try to fetch data from the nt2_1 database table first
  let data = [];
  try {
    // Import the pool from db.js
    const { pool } = await import('./server/db.js');
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT a0, a1, a2, b1, b2 FROM nt2_1 ORDER BY version DESC LIMIT 1');
      
      if (result.rows.length > 0) {
        const row = result.rows[0];
        
        // Combine all CEFR level data into a single array
        if (row.a0) data = data.concat(row.a0);
        if (row.a1) data = data.concat(row.a1);
        if (row.a2) data = data.concat(row.a2);
        if (row.b1) data = data.concat(row.b1);
        if (row.b2) data = data.concat(row.b2);
      }
    } finally {
      client.release();
    }
  } catch (dbError) {
    console.log('Error fetching data from nt2_1 table, falling back to file reading:', dbError.message);
  }
  
  // If no data was found in the database, fall back to reading files
  if (data.length === 0) {
    try {
      const cefrLevels = ['a0', 'a1', 'a2', 'b1', 'b2'];
      for (const level of cefrLevels) {
        const jsonFilePath = path.join(process.cwd(), 'prompts', 'nt2', `nt2.${level}.json`);
        try {
          const jsonData = await fs.readFile(jsonFilePath, 'utf8');
          const levelRules = JSON.parse(jsonData);
          data = data.concat(levelRules);
        } catch (fileError) {
          console.log(`nt2.${level}.json file not found or could not be parsed`);
        }
      }
      
      // If no files were found, fall back to the original path
      if (data.length === 0) {
        const jsonFilePath = path.join(process.cwd(), 'prompts', 'nt2.json');
        const jsonData = await fs.readFile(jsonFilePath, 'utf8');
        data = JSON.parse(jsonData);
      }
    } catch (error) {
      console.error('Error reading nt2 files:', error);
      // Return a default scale if file reading fails
      return JSON.stringify({
        "1-9": "A0",
        "10-31": "A1",
        "32-49": "A2",
        "50-66": "B1",
        "67-100": "B2"
      });
    }
  }

  const cefrGroups = {};
  data.forEach(item => {
    if (!item.cefr_level || item.level === undefined) return;
    const baseLevel = item.cefr_level.substring(0, 2);
    const kolmitLevel = parseFloat(item.level);
    if (isNaN(kolmitLevel)) return;
    if (!cefrGroups[baseLevel]) {
      cefrGroups[baseLevel] = { min: kolmitLevel, max: kolmitLevel };
    } else {
      cefrGroups[baseLevel].min = Math.min(cefrGroups[baseLevel].min, kolmitLevel);
      cefrGroups[baseLevel].max = Math.max(cefrGroups[baseLevel].max, kolmitLevel);
    }
  });

  const cefrRanges = {};
  Object.entries(cefrGroups)
    .sort((a, b) => a[1].min - b[1].min)
    .forEach(([cefrName, range]) => {
      cefrRanges[`${range.min}-${range.max}`] = cefrName;
    });

  return JSON.stringify(cefrRanges);
}

// Function to get CEFR level name by numerical level
export async function GetCefrLevelName(level) {
  const cefrScaleStr = await GetCefrScale();
  const cefrScale = JSON.parse(cefrScaleStr);
  
  // Find the CEFR level name for the given numerical level
  let cefrLevelName = 'A0'; // Default to A0
  
  // Sort the keys numerically to ensure correct order
  const sortedLevels = Object.keys(cefrScale).sort((a, b) => parseInt(a) - parseInt(b));
  
  // Find the appropriate CEFR level name
  for (const kolmitLevel of sortedLevels) {
    if (level >= parseInt(kolmitLevel)) {
      cefrLevelName = cefrScale[kolmitLevel];
    }
  }
  
  // For sub-levels, we need to calculate based on the position within a CEFR level range
  // First, let's find which CEFR level range the level falls into
  let prevLevel = 0;
  let prevCefr = 'A0';
  let nextLevel = Infinity;
  let nextCefr = '';
  
  for (const kolmitLevel of sortedLevels) {
    const currentKolmit = parseInt(kolmitLevel);
    const currentCefr = cefrScale[kolmitLevel];
    
    if (currentKolmit <= level) {
      prevLevel = currentKolmit;
      prevCefr = currentCefr;
    }
    
    if (currentKolmit > level && currentKolmit < nextLevel) {
      nextLevel = currentKolmit;
      nextCefr = currentCefr;
    }
  }
  
  // If we're exactly at a CEFR level boundary, return that level
  if (sortedLevels.includes(level.toString())) {
    return cefrScale[level];
  }
  
  // Calculate sub-levels for more granular positioning
  if (nextLevel !== Infinity) {
    // Calculate how far between the previous and next CEFR levels we are
    const range = nextLevel - prevLevel;
    const position = level - prevLevel;
    
    // Only create sublevels if there's enough space (more than 10 positions)
    if (range > 10) {
      // Calculate sublevel (1-9)
      const subLevel = Math.max(1, Math.min(9, Math.floor((position / range) * 10)));
      cefrLevelName = `${prevCefr}.${subLevel}`;
    }
  }
  
  return cefrLevelName;
}