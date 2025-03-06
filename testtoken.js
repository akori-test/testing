// X (Twitter) Mentions to NocoDB Integration - Simplified

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const axios = require('axios'); // For NocoDB API calls

// Configuration
const TARGET_ACCOUNT = 'TestonBSC';
const TRACKING_HOURS = 3; // Track mentions for the last 3 hours
const REFRESH_INTERVAL_MINUTES = 15; // Check every 15 minutes
const SCROLL_COUNT = 15; // Number of scrolls
const SCROLL_DELAY_MS = 1200; // Delay between scrolls
const OUTPUT_DIRECTORY = path.join(__dirname, 'results');
const USER_DATA_DIR = path.join(__dirname, 'chrome_profile_testtoken'); // Different directory name

// NocoDB configuration
const NOCODB_API_URL = 'https://app.nocodb.com/api/v2';
const NOCODB_API_KEY = process.env.NOCODB_API_KEY || 'MK93fRsPqr1RTOqHtmsHCtpdkkFmQZggnEEQCDzR';
const NOCODB_TABLE_NAME = 'm65h3mj24dabtzt'; // Use the table ID, not the display name
const NOCODB_RECORD_ID = ''; // Leave blank to create new records each time

// Create necessary directories
if (!fs.existsSync(OUTPUT_DIRECTORY)) {
  fs.mkdirSync(OUTPUT_DIRECTORY);
}
if (!fs.existsSync(USER_DATA_DIR)) {
  fs.mkdirSync(USER_DATA_DIR);
}

// Generate a unique filename for logging
const sessionId = moment().format('YYYY-MM-DD_HH-mm-ss');
const logFilePath = path.join(OUTPUT_DIRECTORY, `aixbt_tracker_log_${sessionId}.json`);

// Initialize logging structure
const logData = {
  target: `@${TARGET_ACCOUNT}`,
  startTime: new Date().toISOString(),
  endTime: null,
  trackingPeriodHours: TRACKING_HOURS,
  runs: []
};

// Save initial log data
fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2));

// Function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Take screenshot
async function takeScreenshot(page, name) {
  const screenshotPath = path.join(OUTPUT_DIRECTORY, `screenshot_${name}_${Date.now()}.png`);
  console.log(`Taking screenshot: ${screenshotPath}`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

// Global browser instance
let browser = null;

// Function to initialize browser
async function initBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      userDataDir: USER_DATA_DIR,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--window-size=1920,1080'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });
  }
  return browser;
}

// Add the new cookie loading function here
async function loadTwitterCookies(page) {
  try {
    console.log('Loading pre-authenticated Twitter session...');
    
    // Debug the environment variable
    console.log('TWITTER_COOKIES exists:', !!process.env.TWITTER_COOKIES);
    if (process.env.TWITTER_COOKIES) {
      console.log('TWITTER_COOKIES length:', process.env.TWITTER_COOKIES.length);
      console.log('TWITTER_COOKIES first 10 chars:', process.env.TWITTER_COOKIES.substring(0, 10) + '...');
    }
    
    // Get cookies from environment variable and parse them
    const cookiesString = process.env.TWITTER_COOKIES;
    if (!cookiesString) {
      console.error('No Twitter cookies found in environment variables');
      return false;
    }
    
    // Try parsing with additional error handling
    let cookies;
    try {
      cookies = JSON.parse(cookiesString);
      console.log(`Successfully parsed cookies, found ${cookies.length} cookies`);
    } catch (parseError) {
      console.error('Error parsing cookies JSON:', parseError.message);
      return false;
    }
    
    // Set these cookies in the browser
    await page.setCookie(...cookies);
    
    console.log('Twitter cookies loaded successfully');
    return true;
  } catch (error) {
    console.error('Error loading Twitter cookies:', error.message);
    return false;
  }
}

// Function to parse relative time (like "3m", "4h", etc) into a timestamp
function parseRelativeTime(relativeTimeText, currentTime) {
  if (!relativeTimeText) return null;
  
  // Handle "now", "just now"
  if (relativeTimeText.toLowerCase().includes('now')) {
    return moment(currentTime).toISOString();
  }
  
  // Extract number and unit
  const match = relativeTimeText.match(/(\d+)([smhd])/);
  if (!match) return null;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  const timeAgo = moment(currentTime);
  
  switch(unit) {
    case 's': timeAgo.subtract(value, 'seconds'); break;
    case 'm': timeAgo.subtract(value, 'minutes'); break;
    case 'h': timeAgo.subtract(value, 'hours'); break;
    case 'd': timeAgo.subtract(value, 'days'); break;
    default: return null;
  }
  
  return timeAgo.toISOString();
}

// Function to determine which hour bucket a tweet belongs in
function assignHourBucket(tweetTimestamp, currentTime, relativeTime) {
  // Special case for explicitly "3h" tweets
  if (relativeTime && relativeTime.trim() === '3h') {
    return 'hour3';
  }
  
  if (!tweetTimestamp || tweetTimestamp === 'Unknown') return 'unknown';
  
  const tweetTime = moment(tweetTimestamp);
  const hoursDiff = moment(currentTime).diff(tweetTime, 'hours');
  
  if (hoursDiff < 1) return 'hour1';
  if (hoursDiff < 2) return 'hour2';
  if (hoursDiff < 3) return 'hour3';
  
  return 'unknown'; // Older than 3 hours or couldn't determine
}

// Function to update NocoDB with just the total mentions and timestamp
// Function to update NocoDB with complete record data
async function updateNocoDB(totalMentions) {
  try {
    const headers = {
      'xc-token': NOCODB_API_KEY,
      'Content-Type': 'application/json'
    };
    
    // Get the latest measurement_id to increment
    let nextMeasurementId = 1;
    
    try {
      // Attempt to fetch the latest record to get the current highest measurement_id
      const latestResponse = await axios.get(
        `${NOCODB_API_URL}/tables/${NOCODB_TABLE_NAME}/records?sort=-measurement_id&limit=1`,
        { headers }
      );
      
      if (latestResponse.data && latestResponse.data.list && latestResponse.data.list.length > 0) {
        const currentHighestId = latestResponse.data.list[0].measurement_id;
        nextMeasurementId = currentHighestId + 1;
        console.log(`Latest measurement_id found: ${currentHighestId}, using ${nextMeasurementId} for new record`);
      } else {
        console.log('No existing records found, starting with measurement_id = 1');
      }
    } catch (error) {
      console.error('Error fetching latest measurement_id:', error.message);
      console.log('Defaulting to measurement_id = 1');
    }
    
    // Complete data for all columns
    const data = {
      measurement_id: nextMeasurementId,
      token_name: 'Test Token',
      token_id: '0x86Bb94DdD16Efc8bc58e6b056e8df71D9e666429',
      total_mentions: totalMentions,
      timestamp: new Date().toISOString()
    };
    
    let response;
    
    if (NOCODB_RECORD_ID) {
      // Update existing record
      response = await axios.patch(
        `${NOCODB_API_URL}/tables/${NOCODB_TABLE_NAME}/records/${NOCODB_RECORD_ID}`,
        data,
        { headers }
      );
      console.log(`Updated NocoDB record ${NOCODB_RECORD_ID}`);
    } else {
      // Create new record
      response = await axios.post(
        `${NOCODB_API_URL}/tables/${NOCODB_TABLE_NAME}/records`,
        data,
        { headers }
      );
      console.log(`Created new NocoDB record with measurement_id: ${nextMeasurementId}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error updating NocoDB:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

async function loginToTwitter(page) {
  console.log('Logging in to X...');
  
  try {
    // Navigate to login page
    await page.goto('https://x.com/i/flow/login', { waitUntil: 'networkidle2', timeout: 60000 });
    await takeScreenshot(page, 'login_page');
    
    // Wait longer for the page to fully initialize and stabilize
    await delay(3000);
    
    // Use a more robust selector method for the username input
    const usernameSelector = 'input[autocomplete="username"]';
    await page.waitForSelector(usernameSelector, { visible: true, timeout: 10000 });
    
    // Clear any existing text and type slowly to appear more human-like
    await page.click(usernameSelector);
    await page.type(usernameSelector, process.env.TWITTER_USERNAME, { delay: 100 });
    await takeScreenshot(page, 'after_typing_username');
    await delay(1000);
    
    // Find and click the Next button more reliably
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
      const nextButton = buttons.find(button => button.textContent.includes('Next'));
      if (nextButton) nextButton.click();
    });
    
    await delay(3000);
    await takeScreenshot(page, 'after_username_next');
    
    // Now wait for password field
    const passwordSelector = 'input[name="password"]';
    await page.waitForSelector(passwordSelector, { visible: true, timeout: 10000 });
    
    // Type password slowly
    await page.type(passwordSelector, process.env.TWITTER_PASSWORD, { delay: 100 });
    await takeScreenshot(page, 'after_typing_password');
    await delay(1000);
    
    // Find and click the Login button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
      const loginButton = buttons.find(button => 
        button.textContent.includes('Log in') || 
        button.textContent.includes('Sign in')
      );
      if (loginButton) loginButton.click();
    });
    
    await delay(5000);
    await takeScreenshot(page, 'after_login_attempt');
    
    // Verify if login was successful by checking for elements only present after login
    const isLoggedIn = await page.evaluate(() => {
      return !document.body.innerText.includes('Sign in to X') && 
             !document.body.innerText.includes('Sign in to Twitter');
    });
    
    if (isLoggedIn) {
      console.log('Login successful');
      return true;
    } else {
      console.log('Login page still showing after attempt - login might have failed');
      return false;
    }
  } catch (error) {
    console.error('Error during login:', error.message);
    await takeScreenshot(page, 'login_error');
    return false;
  }
}


async function scrapeMentions() {
  const runStart = new Date();
  console.log(`\n[${runStart.toLocaleString()}] Checking mentions of @${TARGET_ACCOUNT}...`);
  
  const runData = {
    startTime: runStart.toISOString(),
    endTime: null,
    totalMentions: 0,
    hourlyBreakdown: {
      hour1: 0,
      hour2: 0,
      hour3: 0,
      unknown: 0
    },
    nocodbUpdateSuccess: false,
    error: null
  };
  
  try {
    // Make sure browser is initialized
    browser = await initBrowser();
    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Load pre-authenticated session
    const cookiesLoaded = await loadTwitterCookies(page);
    await takeScreenshot(page, 'after_loading_cookies');
    
    // Navigate to the search results
    const searchUrl = `https://x.com/search?q=%40${TARGET_ACCOUNT}&src=typed_query&f=live`;
    console.log(`Navigating to: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('Search page loaded');

    // Take screenshot after initial page load
    await takeScreenshot(page, 'initial_load');
    
    // Wait for content to load
    await delay(2000);
     
    // Take screenshot after waiting
    await takeScreenshot(page, 'after_wait');
    
    // Scroll down to load more tweets
    console.log(`Scrolling ${SCROLL_COUNT} times to load more tweets...`);
    
    // Perform scrolls with pauses
    for (let i = 0; i < SCROLL_COUNT; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 0.8);
      });
      
      await delay(SCROLL_DELAY_MS);
      
      // Every 5 scrolls, pause longer
      if ((i + 1) % 5 === 0) {
        await delay(2000);
        await takeScreenshot(page, `scroll_${i+1}`);
      }
    }

    // Take screenshot of final state after scrolling
    await takeScreenshot(page, 'final_state');
    
    // Extract tweets with enhanced timestamp detection
    const tweets = await page.evaluate((targetAccount, currentTimeStr) => {
      const currentTime = new Date(currentTimeStr);
      const results = [];
      
      // Find all tweet containers
      const tweetContainers = Array.from(document.querySelectorAll('article'));
      
      tweetContainers.forEach((container, index) => {
        try {
          // Multiple ways to detect tweet text
          let tweetText = '';
          
          // Method 1: Look for the tweet text element
          const tweetTextElements = container.querySelectorAll('[data-testid="tweetText"]');
          tweetTextElements.forEach(el => {
            tweetText += el.innerText + ' ';
          });
          
          // Method 2: Check container text
          if (!tweetText.includes(`@${targetAccount}`)) {
            const containerText = container.innerText;
            if (containerText.includes(`@${targetAccount}`)) {
              const mentionIndex = containerText.indexOf(`@${targetAccount}`);
              const textBefore = containerText.substring(Math.max(0, mentionIndex - 100), mentionIndex);
              const textAfter = containerText.substring(mentionIndex, mentionIndex + 150);
              tweetText = textBefore + textAfter;
            }
          }
          
          // Check if this tweet mentions our target
          if (tweetText.includes(`@${targetAccount}`) || tweetText.toLowerCase().includes(targetAccount.toLowerCase())) {
            // Get username
            let username = 'Unknown';
            const userElements = container.querySelectorAll('[data-testid="User-Name"]');
            if (userElements.length > 0) {
              username = userElements[0].innerText;
            }
            
            // Get timestamp
            let timestamp = 'Unknown';
            let relativeTime = null;
            
            // Method 1: Look for time element
            const timeElements = container.querySelectorAll('time');
            if (timeElements.length > 0) {
              timestamp = timeElements[0].getAttribute('datetime');
              relativeTime = timeElements[0].textContent.trim();
            }
            
            // Explicitly check for "· 3h" pattern
            const threeHourPattern = /·\s*3h/;
            const has3hLabel = threeHourPattern.test(container.innerText);
            if (has3hLabel) {
              relativeTime = '3h';
            }
            
            // Method 2: Look for relative time text
            if (!relativeTime || relativeTime === '') {
              const timeTextRegex = /\b(\d+[smhd])\b/;
              const allText = container.innerText;
              const timeMatch = allText.match(timeTextRegex);
              
              if (timeMatch) {
                relativeTime = timeMatch[0];
              }
            }
            
            // Method 3: Look for patterns like "· 3m", "· 2h"
            if (!relativeTime || relativeTime === '') {
              const dotTimeRegex = /·\s*(\d+[smhd])/;
              const allText = container.innerText;
              const dotTimeMatch = allText.match(dotTimeRegex);
              
              if (dotTimeMatch) {
                relativeTime = dotTimeMatch[1];
              }
            }
            
            // Get tweet ID from status link
            let tweetId = `tweet_${index}_${Date.now()}`; // Fallback
            const statusLinks = container.querySelectorAll('a[href*="/status/"]');
            if (statusLinks.length > 0) {
              const href = statusLinks[0].getAttribute('href');
              const match = href.match(/\/status\/(\d+)/);
              if (match && match[1]) {
                tweetId = match[1];
              }
            }
            
            results.push({
              username,
              text: tweetText.trim(),
              timestamp,
              relativeTime,
              tweetId,
              position: index
            });
          }
        } catch (err) {
          // Skip this tweet if there's an error
        }
      });
      
      return results;
    }, TARGET_ACCOUNT, runStart.toISOString());
    
    console.log(`Found ${tweets.length} tweets mentioning @${TARGET_ACCOUNT}`);
    
    // Process timestamps and assign to hour buckets
    const processedTweets = tweets.map(tweet => {
      // If we have relative time but no timestamp, convert it
      if (tweet.relativeTime && (!tweet.timestamp || tweet.timestamp === 'Unknown')) {
        tweet.timestamp = parseRelativeTime(tweet.relativeTime, runStart);
      }
      
      const hourBucket = assignHourBucket(tweet.timestamp, runStart, tweet.relativeTime);
      
      return {
        ...tweet,
        detectedAt: new Date().toISOString(),
        hourBucket
      };
    });
    
    // Filter for tweets within the 3-hour window
    const recentTweets = processedTweets.filter(tweet => 
      tweet.hourBucket === 'hour1' || 
      tweet.hourBucket === 'hour2' || 
      tweet.hourBucket === 'hour3' || 
      tweet.hourBucket === 'unknown'
    );
    
    // Count tweets in each hour bucket (for our logs)
    recentTweets.forEach(tweet => {
      runData.hourlyBreakdown[tweet.hourBucket]++;
    });
    
    runData.totalMentions = recentTweets.length;
    
    // Pretty print results
    console.log(`\nTotal mentions of @${TARGET_ACCOUNT} in last 3 hours: ${runData.totalMentions}`);
    console.log('Hourly breakdown:');
    console.log(`- Last hour: ${runData.hourlyBreakdown.hour1}`);
    console.log(`- 1-2 hours ago: ${runData.hourlyBreakdown.hour2}`);
    console.log(`- 2-3 hours ago: ${runData.hourlyBreakdown.hour3}`);
    console.log(`- Unknown time: ${runData.hourlyBreakdown.unknown}`);
    
    // Update NocoDB with ONLY total mentions
    console.log('\nUpdating NocoDB with total mentions...');
    const nocodbResult = await updateNocoDB(runData.totalMentions);
    runData.nocodbUpdateSuccess = !!nocodbResult;
    
    // Close page
    await page.close();
    
  } catch (error) {
    console.error('Error scraping mentions:', error);
    runData.error = error.message;
  }
  
  // Complete run data
  runData.endTime = new Date().toISOString();
  
  // Update log
  logData.runs.push(runData);
  fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2));
  
  console.log(`Run completed at ${new Date().toLocaleString()}`);
  console.log(`Next run in ${REFRESH_INTERVAL_MINUTES} minutes`);
}

// Function to handle cleanup
function cleanup() {
  console.log('\nCleaning up...');
  
  if (browser) {
    browser.close();
  }
  
  logData.endTime = new Date().toISOString();
  fs.writeFileSync(logFilePath, JSON.stringify(logData, null, 2));
  
  console.log('Tracker stopped');
  process.exit(0);
}

// Main execution function
// Main execution function
async function main() {
  console.log(`[${new Date().toLocaleString()}] Started automated tracker for @${TARGET_ACCOUNT}`);
  console.log(`Tracking the last ${TRACKING_HOURS} hours of mentions`);
  console.log(`Log file: ${logFilePath}`);
  
  // Run initial scrape
  await scrapeMentions();
  
  // Check if running in GitHub Actions
  if (process.env.GITHUB_ACTIONS) {
    console.log("Running in GitHub Actions - exiting after one run");
    cleanup();
    return; // Exit the function
  }
  
  // If not in GitHub Actions, set up interval for regular checks
  const intervalId = setInterval(scrapeMentions, REFRESH_INTERVAL_MINUTES * 60 * 1000);
  
  // Handle graceful shutdown
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// Start the process
main();
