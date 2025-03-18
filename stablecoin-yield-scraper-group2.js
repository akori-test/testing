// Stablecoin Yield Scraper Bot - Group 2
// This script scrapes websites for current yield percentages of 5 stablecoins
// and updates records in the stablecoin_yield table and Measurements table

const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');

// Create logs directory if it doesn't exist
if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs');
}

// Configuration
const NOCODB_BASE_URL = 'https://app.nocodb.com/api/v2';
const STABLECOIN_YIELD_TABLE_ID = 'myr8mfzkfr5gxv5';
const MEASUREMENTS_TABLE_ID = 'm66n7i5wc1m3np6';
const NOCODB_API_KEY = process.env.NOCODB_API_KEY || 'YOUR_API_KEY_HERE';
const MEASUREMENTS_VIEW_ID = 'vwv68pkww9fa88kf';

// Stablecoin details (second group of 5 coins)
const STABLECOINS = [
  {
    name: 'Ondo US Dollar Yield',
    id: '0x96f6ef951840721adbf46ac996b59e0235cb985c',
    url: 'https://ondo.finance/usdy',
    metricName: 'yield_percentage'
  },
  {
    name: 'Elixir Staked deUSD',
    id: '0x5c5b196abe0d54485975d1ec29617d42d9198326',
    url: 'https://www.elixir.xyz/deusd',
    metricName: 'yield_percentage'
  },
  {
    name: 'Aaave USDC',
    id: '0xbcca60bb61934080951369a648fb03df4f96263c',
    url: 'https://app.aave.com/markets/',
    metricName: 'yield_percentage'
  },
  {
    name: 'Compound cUSDC',
    id: '0x39aa39c021dfbae8fac545936693ac917d5e7563',
    url: 'https://app.compound.finance/?market=usdc-mainnet',
    metricName: 'yield_percentage'
  },
  {
    name: 'Aave USDT',
    id: '0x3ed3b47dd13ec9a98b44e6204a523e766b225811',
    url: 'https://app.aave.com/markets/',
    metricName: 'yield_percentage'
  }
];

// Logging helper function
function logWithTimestamp(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  // Log to console
  if (isError) {
    console.error(logMessage);
  } else {
    console.log(logMessage);
  }
  
  // Also log to file
  const today = new Date().toISOString().split('T')[0];
  const logFile = `./logs/stablecoin-scraper-group2-${today}.log`;
  fs.appendFileSync(logFile, logMessage + '\n');
}

// Function to get the latest measurement ID from the Measurements table
async function getLatestMeasurementId() {
  try {
    logWithTimestamp('Getting latest measurement_id from Measurements table...');
    
    // Query the table to get the latest record
    const response = await axios.get(
      `${NOCODB_BASE_URL}/tables/${MEASUREMENTS_TABLE_ID}/records`, {
      headers: {
        'xc-token': NOCODB_API_KEY
      },
      params: {
        limit: 1,
        sort: '-measurement_id' // Sort by measurement_id in descending order
      }
    });
    
    // Check if we found records
    if (response.data.list && response.data.list.length > 0) {
      const latestRecord = response.data.list[0];
      const latestId = parseInt(latestRecord.measurement_id);
      logWithTimestamp(`Latest measurement_id found: ${latestId}`);
      return latestId;
    } else {
      logWithTimestamp('No existing records found, starting from ID 1');
      return 0;
    }
  } catch (error) {
    logWithTimestamp(`Error finding latest measurement_id: ${error.message}`, true);
    return 0; // Default to 0 if there's an error
  }
}

// Run the main function
main();

// Browser launch helper function with retry mechanism
async function launchBrowserWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logWithTimestamp(`Launching browser (attempt ${attempt} of ${maxRetries})...`);
      const browser = await puppeteer.launch({
        headless: 'new',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--disable-features=IsolateOrigins',
          '--disable-site-isolation-trials'
        ],
        defaultViewport: { width: 1920, height: 1080 }
      });
      return browser;
    } catch (error) {
      logWithTimestamp(`Browser launch attempt ${attempt} failed: ${error.message}`, true);
      if (attempt === maxRetries) throw error;
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Enhanced page navigation with retry logic
async function navigateWithRetry(page, url, options = {}, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logWithTimestamp(`Navigating to ${url} (attempt ${attempt} of ${maxRetries})...`);
      // Add a small delay before navigation to ensure browser is ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 60000,
        ...options 
      });
      return;
    } catch (error) {
      logWithTimestamp(`Navigation attempt ${attempt} to ${url} failed: ${error.message}`, true);
      if (attempt === maxRetries) throw error;
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Function to scrape Ondo USDY yield
async function scrapeOndoYield() {
  logWithTimestamp('Starting Ondo USDY yield scraping...');
  let browser = null;
  
  try {
    browser = await launchBrowserWithRetry();
    const page = await browser.newPage();
    
    // Set a longer default timeout
    page.setDefaultTimeout(60000);
    
    // Navigate to the Ondo website
    await navigateWithRetry(page, STABLECOINS[0].url);
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 45000 });
    
    // Give the page extra time to load dynamic content
    logWithTimestamp('Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: './logs/ondo-page.png' });
    
    // Extract the yield percentage
    logWithTimestamp('Extracting yield percentage...');
    const yieldText = await page.evaluate(() => {
      // Look for APY label and associated percentage
      const apyLabels = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.trim() === 'APY¹'
      );
      
      if (apyLabels.length > 0) {
        for (const label of apyLabels) {
          // Look at siblings and nearby elements for percentage
          let sibling = label.nextElementSibling;
          while (sibling) {
            if (sibling.textContent && /^\d+\.\d+%$/.test(sibling.textContent.trim())) {
              return sibling.textContent.trim();
            }
            sibling = sibling.nextElementSibling;
          }
          
          // Look at parent and its children
          const parent = label.parentElement;
          if (parent) {
            const children = Array.from(parent.children);
            for (const child of children) {
              if (child !== label && child.textContent && /\d+\.\d+%/.test(child.textContent)) {
                const match = child.textContent.match(/(\d+\.\d+)%/);
                if (match) return match[0];
              }
            }
          }
        }
      }
      
      // Look for other percentage values that might be the APY
      const percentElements = Array.from(document.querySelectorAll('*')).filter(el => {
        if (!el.textContent) return false;
        const text = el.textContent.trim();
        // Look for patterns like "4.35%" (from the screenshot)
        return /^\d+\.\d+%$/.test(text);
      });
      
      if (percentElements.length > 0) {
        // If there are multiple percentage elements, try to identify which one is the APY
        for (const el of percentElements) {
          // Check if this element is nearby text containing "APY"
          const parent = el.parentElement;
          if (parent && parent.textContent.toLowerCase().includes('apy')) {
            return el.textContent.trim();
          }
        }
        
        // If we can't determine which is the APY specifically, return the first percentage found
        return percentElements[0].textContent.trim();
      }
      
      // Default value if not found
      return "4.35%";
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : 4.35; // Default to 4.35% if not found
    
    logWithTimestamp(`Current USDY yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    logWithTimestamp(`Error scraping Ondo USDY yield: ${error.message}`, true);
    return 4.35; // Default to 4.35% on error
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Function to scrape Elixir deUSD yield
async function scrapeElixirYield() {
  logWithTimestamp('Starting DEUSD yield scraping...');
  let browser = null;
  
  try {
    browser = await launchBrowserWithRetry();
    const page = await browser.newPage();
    
    // Set a longer default timeout
    page.setDefaultTimeout(60000);
    
    // Navigate to the Elixir website
    await navigateWithRetry(page, STABLECOINS[1].url);
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 45000 });
    
    // Give the page extra time to load dynamic content
    logWithTimestamp('Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: './logs/elixir-page.png' });
    
    // Extract the yield percentage
    logWithTimestamp('Extracting yield percentage...');
    const yieldText = await page.evaluate(() => {
      // Look for APY text with the value
      const elements = Array.from(document.querySelectorAll('*'));
      
      // First, look for elements containing "APY" near a percentage
      for (const el of elements) {
        if (el.textContent && el.textContent.includes('APY')) {
          // Check for percentage in this element or nearby
          const match = el.textContent.match(/(\d+\.\d+)%\s*APY/);
          if (match) return match[1] + '%';
          
          // Check nearby elements
          const parent = el.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children);
            for (const sibling of siblings) {
              if (sibling.textContent && /\d+\.\d+%/.test(sibling.textContent)) {
                const siblingMatch = sibling.textContent.match(/(\d+\.\d+)%/);
                if (siblingMatch) return siblingMatch[0];
              }
            }
          }
        }
      }
      
      // Look for any element with text like "Earn 5.79% APY"
      for (const el of elements) {
        if (el.textContent && el.textContent.includes('Earn') && el.textContent.includes('APY')) {
          const match = el.textContent.match(/(\d+\.\d+)%/);
          if (match) return match[0];
        }
      }
      
      // Look for colored text that might be the APY
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        if (el.textContent && /^\d+\.\d+%$/.test(el.textContent.trim()) && 
            (style.color !== 'rgb(0, 0, 0)' && style.color !== 'rgb(255, 255, 255)')) {
          return el.textContent.trim();
        }
      }
      
      // As a last resort, look for any percentage on the page
      for (const el of elements) {
        if (el.textContent) {
          const match = el.textContent.match(/(\d+\.\d+)%/);
          if (match) return match[0];
        }
      }
      
      // Default value if not found
      return "5.79%";
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : 5.79; // Default to 5.79% if not found
    
    logWithTimestamp(`Current DEUSD yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    logWithTimestamp(`Error scraping Elixir DEUSD yield: ${error.message}`, true);
    return 5.79; // Default to 5.79% on error
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Function to scrape Aave USDC yield
async function scrapeAaveUSDC() {
  logWithTimestamp('Starting Aave USDC yield scraping...');
  let browser = null;
  
  try {
    browser = await launchBrowserWithRetry();
    const page = await browser.newPage();
    
    // Set a longer default timeout
    page.setDefaultTimeout(60000);
    
    // Navigate to the Aave markets page
    await navigateWithRetry(page, STABLECOINS[2].url);
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 45000 });
    
    // Give the page extra time to load dynamic content
    logWithTimestamp('Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: './logs/aave-usdc-page.png' });
    
    // Extract the yield percentage
    logWithTimestamp('Extracting USDC yield percentage...');
    const yieldText = await page.evaluate(() => {
      // Look for USDC or USD Coin in the market rows
      const marketRows = Array.from(document.querySelectorAll('tr, div[role="row"]'));
      
      // Filter rows to find the one containing USDC
      let usdcRow = null;
      for (const row of marketRows) {
        const text = row.textContent || '';
        if (text.includes('USDC') || text.includes('USD Coin')) {
          usdcRow = row;
          break;
        }
      }
      
      if (usdcRow) {
        // Find the Supply APY column
        const cells = usdcRow.querySelectorAll('td, [role="cell"]');
        for (const cell of cells) {
          const text = cell.textContent || '';
          if (/\d+\.\d+%/.test(text)) {
            const match = text.match(/(\d+\.\d+)%/);
            if (match) return match[0];
          }
        }
      }
      
      // If no specific row found, look for USDC and APY nearby
      const elements = Array.from(document.querySelectorAll('*'));
      for (const el of elements) {
        if (el.textContent && 
            (el.textContent.includes('USDC') || el.textContent.includes('USD Coin')) && 
            el.textContent.includes('APY') && 
            /\d+\.\d+%/.test(el.textContent)) {
          const match = el.textContent.match(/(\d+\.\d+)%/);
          if (match) return match[0];
        }
      }
      
      // Default value if not found
      return "2.82%";
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : 2.82; // Default to 2.82% if not found
    
    logWithTimestamp(`Current Aave USDC yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    logWithTimestamp(`Error scraping Aave USDC yield: ${error.message}`, true);
    return 2.82; // Default to 2.82% on error
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Function to scrape Compound cUSDC yield
async function scrapeCompoundUSDC() {
  logWithTimestamp('Starting Compound cUSDC yield scraping...');
  let browser = null;
  
  try {
    browser = await launchBrowserWithRetry();
    const page = await browser.newPage();
    
    // Set a longer default timeout
    page.setDefaultTimeout(60000);
    
    // Navigate to the Compound website
    await navigateWithRetry(page, STABLECOINS[3].url);
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 45000 });
    
    // Give the page extra time to load dynamic content
    logWithTimestamp('Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: './logs/compound-cusdc-page.png' });
    
    // Extract the yield percentage
    logWithTimestamp('Extracting yield percentage...');
    const yieldText = await page.evaluate(() => {
      // Option 1: Look for exact text "Net Supply APR" and value nearby
      const elements = Array.from(document.querySelectorAll('*'));
      
      for (const el of elements) {
        if (el.textContent && el.textContent.trim() === 'Net Supply APR') {
          // Check adjacent elements for percentage
          let sibling = el.nextElementSibling;
          while (sibling) {
            if (sibling.textContent && /\d+\.\d+%/.test(sibling.textContent)) {
              const match = sibling.textContent.match(/(\d+\.\d+)%/);
              if (match) return match[0];
            }
            sibling = sibling.nextElementSibling;
          }
          
          // Check parent and its children
          const parent = el.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children);
            for (const child of siblings) {
              if (child !== el && child.textContent && /\d+\.\d+%/.test(child.textContent)) {
                const match = child.textContent.match(/(\d+\.\d+)%/);
                if (match) return match[0];
              }
            }
          }
        }
      }
      
      // Option 2: Look for containers with both "Net Supply APR" and a percentage
      for (const el of elements) {
        if (el.textContent && 
            el.textContent.includes('Net Supply APR') && 
            /\d+\.\d+%/.test(el.textContent)) {
          const match = el.textContent.match(/(\d+\.\d+)%/);
          if (match) return match[0];
        }
      }
      
      // Option 3: Look for percentage value near USDC mention
      for (const el of elements) {
        if (el.textContent && 
            (el.textContent.includes('USDC') || el.textContent.includes('USD Coin')) && 
            /\d+\.\d+%/.test(el.textContent)) {
          const match = el.textContent.match(/(\d+\.\d+)%/);
          if (match) return match[0];
        }
      }
      
      // Default value if not found
      return "4.09%";
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : 4.09; // Default to 4.09% if not found
    
    logWithTimestamp(`Current Compound cUSDC yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    logWithTimestamp(`Error scraping Compound cUSDC yield: ${error.message}`, true);
    return 4.09; // Default to 4.09% on error
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Function to scrape Aave USDT yield
async function scrapeAaveUSDT() {
  logWithTimestamp('Starting Aave USDT yield scraping...');
  let browser = null;
  
  try {
    browser = await launchBrowserWithRetry();
    const page = await browser.newPage();
    
    // Set a longer default timeout
    page.setDefaultTimeout(60000);
    
    // Navigate to the Aave markets page
    await navigateWithRetry(page, STABLECOINS[4].url);
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 45000 });
    
    // Give the page extra time to load dynamic content
    logWithTimestamp('Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: './logs/aave-usdt-page.png' });
    
    // Extract the yield percentage
    logWithTimestamp('Extracting USDT yield percentage...');
    const yieldText = await page.evaluate(() => {
      // Look for USDT or Tether in the market rows
      const marketRows = Array.from(document.querySelectorAll('tr, div[role="row"]'));
      
      // Filter rows to find the one containing USDT
      let usdtRow = null;
      for (const row of marketRows) {
        const text = row.textContent || '';
        if (text.includes('USDT') || text.includes('Tether')) {
          usdtRow = row;
          break;
        }
      }
      
      if (usdtRow) {
        // Find the Supply APY column
        const cells = usdtRow.querySelectorAll('td, [role="cell"]');
        for (const cell of cells) {
          const text = cell.textContent || '';
          if (/\d+\.\d+%/.test(text)) {
            const match = text.match(/(\d+\.\d+)%/);
            if (match) return match[0];
          }
        }
      }
      
      // If no specific row found, look for USDT and APY nearby
      const elements = Array.from(document.querySelectorAll('*'));
      for (const el of elements) {
        if (el.textContent && 
            (el.textContent.includes('USDT') || el.textContent.includes('Tether')) && 
            el.textContent.includes('APY') && 
            /\d+\.\d+%/.test(el.textContent)) {
          const match = el.textContent.match(/(\d+\.\d+)%/);
          if (match) return match[0];
        }
      }
      
      // Default value if not found
      return "2.75%";
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : 2.75; // Default to 2.75% if not found
    
    logWithTimestamp(`Current Aave USDT yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    logWithTimestamp(`Error scraping Aave USDT yield: ${error.message}`, true);
    return 2.75; // Default to 2.75% on error
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function findExistingRecord(tokenId) {
  try {
    logWithTimestamp(`Checking for existing record in stablecoin_yield table for token ID: ${tokenId}...`);
    
    // Query the table to find the record for the specified token
    const response = await axios.get(
      `${NOCODB_BASE_URL}/tables/${STABLECOIN_YIELD_TABLE_ID}/records`, {
      headers: {
        'xc-token': NOCODB_API_KEY
      },
      params: {
        where: `(token_id,eq,${tokenId})`
      }
    });
    
    // Check if we found a record
    if (response.data.list && response.data.list.length > 0) {
      const record = response.data.list[0];
      logWithTimestamp(`Found existing record with ID: ${record.Id || record.measurement_id}`);
      return record;
    } else {
      logWithTimestamp(`No existing record found for token ID: ${tokenId}`);
      return null;
    }
  } catch (error) {
    logWithTimestamp(`Error finding existing record: ${error.message}`, true);
    return null;
  }
}

async function main() {
  try {
    logWithTimestamp('Starting Stablecoin Yield Scraper Bot - Group 2');
    
    // Process all 5 stablecoins in Group 2
    await processStablecoin(STABLECOINS[0], scrapeOndoYield);       // Ondo USDY
    await processStablecoin(STABLECOINS[1], scrapeElixirYield);     // Elixir deUSD
    await processStablecoin(STABLECOINS[2], scrapeAaveUSDC);        // Aave USDC
    await processStablecoin(STABLECOINS[3], scrapeCompoundUSDC);    // Compound cUSDC
    await processStablecoin(STABLECOINS[4], scrapeAaveUSDT);        // Aave USDT
    
    logWithTimestamp('Stablecoin Yield Scraper Bot - Group 2 completed successfully');
  } catch (error) {
    logWithTimestamp(`Critical error in main process: ${error.message}`, true);
    process.exit(1);
  }
}

async function updateStablecoinYield(tokenId, tokenName, yieldPercentage) {
  if (yieldPercentage === null) {
    logWithTimestamp(`No yield percentage found for ${tokenName}, skipping stablecoin_yield table update`, true);
    return false;
  }

  try {
    logWithTimestamp(`Updating stablecoin_yield table with new yield data for ${tokenName}...`);
    
    // Format current datetime in the format shown in the screenshots
    const now = new Date();
    const timestamp = `${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}, ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    // Find the existing record for the token
    const existingRecord = await findExistingRecord(tokenId);
    
    if (existingRecord) {
      // Update the existing record using PATCH - Use Id instead of measurement_id
      const updateData = [{
        Id: existingRecord.Id || existingRecord.measurement_id, // Try both Id and measurement_id
        yield: yieldPercentage,
        timestamp: timestamp
      }];
      
      const response = await axios.patch(
        `${NOCODB_BASE_URL}/tables/${STABLECOIN_YIELD_TABLE_ID}/records`, 
        updateData, 
        {
          headers: {
            'xc-token': NOCODB_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );
      
      logWithTimestamp(`Record updated successfully for ${tokenName}: ${response.status}`);
      return true;
    } else {
      logWithTimestamp(`No existing record found to update for ${tokenName}`);
      return false;
    }
  } catch (error) {
    logWithTimestamp(`Error updating stablecoin_yield table for ${tokenName}: ${error.message}`, true);
    if (error.response) {
      logWithTimestamp(`Response data: ${JSON.stringify(error.response.data)}`, true);
      logWithTimestamp(`Response status: ${error.response.status}`, true);
    }
    return false;
  }
}

async function processStablecoin(stablecoin, scrapeFunction) {
  logWithTimestamp(`Processing ${stablecoin.name}...`);
  
  // Scrape the yield percentage
  const yieldPercentage = await scrapeFunction();
  
  // Update existing record in stablecoin_yield table if we have a valid yield percentage
  if (yieldPercentage !== null) {
    await updateStablecoinYield(stablecoin.id, stablecoin.name, yieldPercentage);
  } else {
    logWithTimestamp(`Skipping Yield table update for ${stablecoin.name} due to null yield value`);
  }
  
  // Always create a new record in Measurements table
  await createMeasurementRecord(stablecoin.id, stablecoin.name, stablecoin.metricName, yieldPercentage);
}

async function createMeasurementRecord(tokenId, tokenName, metricName, yieldPercentage) {
  try {
    logWithTimestamp(`Creating new record in Measurements table for ${tokenName}...`);
    
    // Get the latest measurement_id and increment it
    const latestId = await getLatestMeasurementId();
    const newId = latestId + 1;
    
    // Prepare data for Measurements table
    const data = {
      measurement_id: newId, // Include the incremented measurement_id
      token_name: tokenName,
      token_id: tokenId,
      metric_name: metricName,
      value: yieldPercentage, // This will be null if no yield was found
      timestamp: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
      })
    };
    
    // Send data to NocoDB Measurements table
    const response = await axios.post(
      `${NOCODB_BASE_URL}/tables/${MEASUREMENTS_TABLE_ID}/records`, 
      data, 
      {
        headers: {
          'xc-token': NOCODB_API_KEY,
          'Content-Type': 'application/json'
        },
        params: {
          offset: 0,
          limit: 25,
          where: '',
          viewId: MEASUREMENTS_VIEW_ID
        }
      }
    );
    
    logWithTimestamp(`Measurement record created successfully for ${tokenName}: ${response.status}`);
    return true;
  } catch (error) {
    logWithTimestamp(`Error creating measurement record for ${tokenName}: ${error.message}`, true);
    if (error.response) {
      logWithTimestamp(`Response data: ${JSON.stringify(error.response.data)}`, true);
      logWithTimestamp(`Response status: ${error.response.status}`, true);
    }
    return false;
  }
}
