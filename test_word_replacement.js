import { config } from 'dotenv';
config();
import { replace_words } from './server/cron/hf.js';

async function testWordReplacement() {
  const dutchText = "De implementatie van de nieuwe software vereist aanzienlijke investeringen en deskundige kennis. Het is essentieel dat de medewerkers adequaat worden opgeleid om alle functionaliteiten effectief te benutten.";
  
  try {
    console.log('Original Dutch text:');
    console.log(dutchText);
    console.log('\nReplacing complex words with simpler alternatives...\n');
    
    // Enable debugging
    console.log('Starting word replacement process...');
    const startTime = Date.now();
    
    const simplifiedText = await replace_words(dutchText, "A2");
    
    const endTime = Date.now();
    console.log(`Word replacement completed in ${endTime - startTime} ms`);
    
    console.log('Simplified text:');
    console.log(simplifiedText);
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testWordReplacement();