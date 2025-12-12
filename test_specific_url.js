import { getNews } from './server/cron/cron_tasks.js'

// Test the specific URL that was causing timeout issues
const testUrl = 'https://www.vrt.be/vrtnws/nl/2025/10/13/geen-bussen-of-vliegtuigen-wel-treinen-waar-kan-je-morgen-hind/';

async function testSpecificUrl() {
  try {
    console.log('Testing URL:', testUrl);
    const result = await getNews(new Date(), testUrl, 1, 'content');
    console.log('Result:', result);
    
    if (result && result.length > 0) {
      console.log('Content length:', result[0].content.length);
      console.log('Content preview:', result[0].content.substring(0, 200) + '...');
    } else {
      console.log('No content retrieved');
    }
  } catch (error) {
    console.error('Error testing specific URL:', error);
  }
}

testSpecificUrl().then(() => {
  console.log('Test completed');
}).catch((error) => {
  console.error('Error during test:', error);
});