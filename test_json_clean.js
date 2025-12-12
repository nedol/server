import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const utils = require('./utils.js');

// Test cases for JSON cleaning
const testCases = [
  // Clean JSON (should pass through unchanged)
  '{"result": {"test": "value"}}',
  
  // JSON with markdown code blocks
  '```json\n{"result": {"test": "value"}}\n```',
  
  // JSON with markdown code blocks but no language specifier
  '```\n{"result": {"test": "value"}}\n```',
  
  // JSON with extra text before and after
  'Some explanation here\n```json\n{"result": {"test": "value"}}\n```\nMore text here',
  
  // Malformed JSON that should be cleaned
  '```json{"result": {"test": "value"}}```',
  
  // Complex nested JSON with markdown
  '```json\n{\n  "result": {\n    "article": {\n      "title": "Test Title",\n      "content": ["Sentence 1", "Sentence 2"]\n    }\n  }\n}\n```'
];

console.log('Testing JSON cleaning function...\n');

testCases.forEach((testCase, index) => {
  console.log(`Test Case ${index + 1}:`);
  console.log('Input:', testCase.substring(0, 50) + (testCase.length > 50 ? '...' : ''));
  
  const result = utils.default.cleanAndParseJSON(testCase);
  if (result) {
    console.log('Output:', JSON.stringify(result));
    console.log('✅ Success\n');
  } else {
    console.log('❌ Failed to parse\n');
  }
});

console.log('Testing complete!');