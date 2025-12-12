/**
 * SUBTLEX-NL word frequency checker
 * This module provides functionality to check if words are within the allowed frequency threshold
 * based on SUBTLEX-NL data for text adaptation.
 * 
 * Uses database approach for accessing SUBTLEX-NL data.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for loaded frequency data
let frequencyData = null;
let sortedWords = null;
let dbModule = null;

/**
 * Load database module
 * @returns {Object} Database module
 */
async function loadDbModule() {
  if (dbModule) {
    return dbModule;
  }
  
  try {
    dbModule = await import('./db.js');
    return dbModule;
  } catch (importError) {
    console.error('Could not import database module for SUBTLEX data:', importError.message);
    return null;
  }
}

/**
 * Initialize frequency data from database
 * @returns {Map} Map with words as keys and frequency counts as values
 */
async function initializeFrequencyData() {
  try {
    // Load database module
    const db = await loadDbModule();
    if (!db) {
      console.warn('Database module not available');
      return new Map();
    }
    
    // Get all subtlex data from database
    const result = await db.GetAllSubtlexData();
    if (result && result.frequencyData) {
      frequencyData = result.frequencyData;
      sortedWords = result.sortedWords;
      console.log(`Initialized frequency data with ${frequencyData.size} words from database`);
      return frequencyData;
    } else {
      console.warn('No data returned from GetAllSubtlexData');
      return new Map();
    }
  } catch (error) {
    console.error('Error initializing frequency data from database:', error);
    return new Map();
  }
}

/**
 * Load SUBTLEX-NL frequency data (uses database approach)
 * @param {string} filePath - Path parameter (ignored in database approach)
 * @returns {Map} Map with words as keys and frequency counts as values
 */
async function loadFrequencyData(filePath) {
  // Check if data is already loaded
  if (frequencyData) {
    return frequencyData;
  }
  
  // Initialize from database
  return await initializeFrequencyData();
}

/**
 * Check if a word is in the top N most frequent words
 * Note: In this database schema, lower ID values correspond to higher frequency words
 * @param {string} word - The word to check
 * @param {number} topN - The number of top frequent words to consider
 * @returns {boolean} True if the word is in the top N, false otherwise
 */
async function isWordInTopN(word, topN) {
  // Load SUBTLEX-NL data if not already loaded
  if (!frequencyData) {
    await loadFrequencyData();
  }
  
  // If we still don't have data, return true to avoid blocking content
  if (!frequencyData || frequencyData.size === 0) {
    console.warn('No SUBTLEX-NL data available, allowing all words');
    console.warn('To enable word frequency filtering, ensure the subtlex database table is populated.');
    return true;
  }
  
  // Get the word's ID (lower ID = higher frequency)
  const wordId = frequencyData.get(word.toLowerCase());
  
  // Check if word ID is within the top N range (ID <= topN)
  // Since lower IDs represent higher frequency words
  return wordId !== undefined && wordId <= topN;
}

/**
 * Get the frequency rank of a word (1 = most frequent)
 * Note: In this database schema, lower ID values correspond to higher frequency words
 * @param {string} word - The word to check
 * @returns {number|null} The rank of the word or null if not found
 */
async function getWordRank(word) {
  // Load SUBTLEX-NL data if not already loaded
  if (!frequencyData) {
    await loadFrequencyData();
  }
  
  // If we still don't have data, return null
  if (!frequencyData) {
    return null;
  }
  
  // Get the word's ID (lower ID = higher frequency)
  const wordId = frequencyData.get(word.toLowerCase());
  
  // Return the ID as the rank (since lower IDs represent higher frequency words)
  return wordId !== undefined ? wordId : null;
}

/**
 * Extract words from text and check if they're all within the top N frequency threshold
 * @param {string} text - The text to analyze
 * @param {number} topN - The number of top frequent words to consider
 * @returns {Object} Result object with validation status and details
 */
async function validateTextFrequency(text, topN) {
  // Simple word extraction (this could be improved with more sophisticated tokenization)
  const words = text.toLowerCase().match(/[a-zA-ZàáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžÀÁÂÄÃÅĄČĆĘÈÉÊËĖĮÌÍÎÏŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ∂ð]+/g) || [];
  
  const uniqueWords = [...new Set(words)];
  const results = [];
  
  for (const word of uniqueWords) {
    const isInTopN = await isWordInTopN(word, topN);
    const rank = await getWordRank(word);
    results.push({
      word,
      isInTopN,
      rank
    });
  }
  
  const allValid = results.every(result => result.isInTopN);
  
  return {
    allWordsInTopN: allValid,
    totalWords: uniqueWords.length,
    validWords: results.filter(r => r.isInTopN).length,
    invalidWords: results.filter(r => !r.isInTopN),
    wordDetails: results,
    topN: topN
  };
}

/**
 * Filter text to only include words within the top N frequency threshold
 * @param {string} text - The text to filter
 * @param {number} topN - The number of top frequent words to consider
 * @returns {Object} Result object with filtered text and details
 */
async function filterTextByFrequency(text, topN) {
  // Simple word extraction
  const wordRegex = /[a-zA-ZàáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžÀÁÂÄÃÅĄČĆĘÈÉÊËĖĮÌÍÎÏŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ∂ð]+/g;
  const words = text.match(wordRegex) || [];
  
  const validWords = [];
  const invalidWords = [];
  
  for (const word of words) {
    const isInTopN = await isWordInTopN(word.toLowerCase(), topN);
    if (isInTopN) {
      validWords.push(word);
    } else {
      invalidWords.push(word);
    }
  }
  
  // Simple replacement - in a real implementation, you might want to suggest alternatives
  let filteredText = text;
  for (const invalidWord of invalidWords) {
    // Replace invalid words with a placeholder or remove them
    // This is a simple approach - a more sophisticated implementation might suggest alternatives
    const regex = new RegExp(`\\b${invalidWord}\\b`, 'gi');
    filteredText = filteredText.replace(regex, '[UNCOMMON_WORD]');
  }
  
  return {
    originalText: text,
    filteredText: filteredText,
    validWords: validWords.length,
    invalidWords: invalidWords,
    topN: topN
  };
}

export {
  loadFrequencyData,
  isWordInTopN,
  getWordRank,
  validateTextFrequency,
  filterTextByFrequency
};

export default {
  loadFrequencyData,
  isWordInTopN,
  getWordRank,
  validateTextFrequency,
  filterTextByFrequency
};