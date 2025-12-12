import generate_news from './server/cron/cron_tasks.js'

// Run the news generation function
generate_news().then(() => {
  console.log('News generation completed');
}).catch((error) => {
  console.error('Error during news generation:', error);
});