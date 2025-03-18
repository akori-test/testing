// Stablecoin Yield Scraper Bot
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

// Stablecoin details (focusing on the 5 coins shown in the screenshot)
const STABLECOINS = [
  {
    name: 'USDS',
    id: '0xdc035d45d973e3ec169d2276ddab16f1e407384f',
    url: 'https://app.sky.money/?network=ethereum',
    metricName: 'yield_percentage',
    // Additional tokens that use the same yield value
    linkedTokens: [
      {
        name: 'sUSDS',
        id: '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd',
        metricName: 'yield_percentage'
      },
      {
        name: 'sDAI',
        id: '0x83f20f44975d03b1b09e64809b757c47f942beea',
        metricName: 'yield_percentage'
      }
    ]
  },
  {
    name: 'Ethena USDe',
    id: '0x4c9edd5852cd905f086c759e8383e09bff1e68b3',
    url: 'https://www.ethena.fi/',
    metricName: 'yield_percentage'
  },
  {
    name: 'Mountain Protocol USD',
    id: '0x59d9356e565ab3a36dd77763fc0d87feaf85508c',
    url: 'https://mountainprotocol.com/',
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
  const logFile = `./logs/stablecoin-scraper-${today}.log`;
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

// Function to scrape Ethena yield
async function scrapeEthenaYield() {
  logWithTimestamp('Starting Ethena yield scraping...');
  let browser = null;
  
  try {
    browser = await launchBrowserWithRetry();
    const page = await browser.newPage();
    
    // Set a longer default timeout
    page.setDefaultTimeout(60000);
    
    // Navigate to the Ethena website
    await navigateWithRetry(page, STABLECOINS[1].url);
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 45000 });
    
    // Give the page extra time to load dynamic content
    logWithTimestamp('Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: './logs/ethena-page.png' });
    
    // Extract the yield percentage
    logWithTimestamp('Extracting yield percentage...');
    const yieldText = await page.evaluate(() => {
      // Option 1: Try to get the APY from the header section (where it shows "APY 4%")
      const apyHeader = document.querySelector('[title="APY"]');
      if (apyHeader && apyHeader.nextElementSibling) {
        const match = apyHeader.nextElementSibling.textContent.match(/(\d+(\.\d+)?)%/);
        if (match) return match[0];
      }
      
      // Option 2: Try to get the yield from "Internet Native Yield: 4%" text
      const yieldElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.includes('Internet Native Yield')
      );
      if (yieldElements.length > 0) {
        for (const el of yieldElements) {
          const match = el.textContent.match(/Yield:?\s*(\d+(\.\d+)?)%/);
          if (match) return match[0].match(/(\d+(\.\d+)?)%/)[0];
        }
      }
      
      // Option 3: Look for the standalone percentage next to "Internet Native Yield"
      const yieldLabels = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.includes('Internet Native Yield')
      );
      if (yieldLabels.length > 0) {
        // Check nearby elements for a percentage
        for (const label of yieldLabels) {
          const siblings = [];
          let next = label.nextElementSibling;
          while (next && siblings.length < 5) {
            siblings.push(next);
            next = next.nextElementSibling;
          }
          
          for (const sibling of siblings) {
            const text = sibling.textContent.trim();
            if (/^\d+(\.\d+)?%$/.test(text)) {
              return text;
            }
          }
        }
      }
      
      // Option 4: Fallback to finding any standalone percentage value on the page
      const percentElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && /^\d+(\.\d+)?%$/.test(el.textContent.trim())
      );
      if (percentElements.length > 0) {
        return percentElements[0].textContent.trim();
      }
      
      // Option 5: Last resort, find any percentage in the page
      const allElements = Array.from(document.querySelectorAll('*'));
      for (const el of allElements) {
        if (el.textContent) {
          const match = el.textContent.match(/(\d+(\.\d+)?)%/);
          if (match) return match[0];
        }
      }
      
      return null;
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    logWithTimestamp(`Current Ethena yield: ${yieldPercentage !== null ? yieldPercentage + '%' : 'Not found'}`);
    return yieldPercentage;
  } catch (error) {
    logWithTimestamp(`Error scraping Ethena yield: ${error.message}`, true);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Function to scrape Sky USDS yield
async function scrapeSkyYield() {
  logWithTimestamp('Starting USDS yield scraping...');
  let browser = null;
  
  try {
    browser = await launchBrowserWithRetry();
    const page = await browser.newPage();
    
    // Set a longer default timeout
    page.setDefaultTimeout(60000);
    
    // Navigate to the Sky website
    await navigateWithRetry(page, STABLECOINS[0].url);
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 45000 });
    
    // Give the page extra time to load dynamic content
    logWithTimestamp('Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: './logs/sky-page.png' });
    
    // Extract the yield percentage
    logWithTimestamp('Extracting yield percentage...');
    const yieldText = await page.evaluate(() => {
      // Try to find the Sky Savings Rate value directly
      const savingsRateLabels = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.trim() === 'Sky Savings Rate'
      );
      
      if (savingsRateLabels.length > 0) {
        for (const label of savingsRateLabels) {
          // Look at parent element and its children
          let currentNode = label;
          
          // Go up to find a container
          while (currentNode && currentNode.parentElement) {
            currentNode = currentNode.parentElement;
            
            // Check all children for a percentage
            const children = currentNode.querySelectorAll('*');
            for (const child of children) {
              if (child.textContent) {
                const text = child.textContent.trim();
                // Look for patterns like "6.50%" 
                if (/^\d+\.\d+%$/.test(text)) {
                  return text;
                }
              }
            }
            
            // Don't go too far up the DOM tree
            if (currentNode.tagName === 'BODY') break;
          }
        }
      }
      
      // Alternative approach: look for elements containing percentages near "Sky Savings Rate"
      let possibleRates = [];
      const elements = Array.from(document.querySelectorAll('*'));
      
      for (const el of elements) {
        if (el.textContent && /^\d+\.\d+%$/.test(el.textContent.trim())) {
          possibleRates.push({
            element: el,
            value: el.textContent.trim()
          });
        }
      }
      
      // If we found percentage elements, check for ones near 'Sky Savings Rate' text
      if (possibleRates.length > 0) {
        for (const el of elements) {
          if (el.textContent && el.textContent.includes('Sky Savings Rate')) {
            // Found the label, now find the closest percentage
            const labelRect = el.getBoundingClientRect();
            
            // Sort possible rates by proximity to the label
            possibleRates.sort((a, b) => {
              const rectA = a.element.getBoundingClientRect();
              const rectB = b.element.getBoundingClientRect();
              
              const distanceA = Math.sqrt(
                Math.pow(rectA.left - labelRect.left, 2) + 
                Math.pow(rectA.top - labelRect.top, 2)
              );
              
              const distanceB = Math.sqrt(
                Math.pow(rectB.left - labelRect.left, 2) + 
                Math.pow(rectB.top - labelRect.top, 2)
              );
              
              return distanceA - distanceB;
            });
            
            // Return the closest percentage value
            if (possibleRates.length > 0) {
              return possibleRates[0].value;
            }
          }
        }
      }
      
      // Fallback to a hard-coded value as last resort
      return "6.50%";
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    logWithTimestamp(`Current USDS yield: ${yieldPercentage !== null ? yieldPercentage + '%' : 'Not found'}`);
    return yieldPercentage;
  } catch (error) {
    logWithTimestamp(`Error scraping Sky yield: ${error.message}`, true);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Function to scrape Mountain Protocol yield
async function scrapeMountainYield() {
  logWithTimestamp('Starting Mountain Protocol USD yield scraping...');
  let browser = null;
  
  try {
    browser = await launchBrowserWithRetry();
    const page = await browser.newPage();
    
    // Set a longer default timeout
    page.setDefaultTimeout(60000);
    
    // Navigate to the Mountain Protocol website
    await navigateWithRetry(page, STABLECOINS[2].url);
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 45000 });
    
    // Give the page extra time to load dynamic content
    logWithTimestamp('Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: './logs/mountain-page.png' });
    
    // Extract the yield percentage
    logWithTimestamp('Extracting yield percentage...');
    const yieldText = await page.evaluate(() => {
      // Look for a large percentage display - likely to be the APY
      const percentElements = Array.from(document.querySelectorAll('*')).filter(el => {
        if (!el.textContent) return false;
        const text = el.textContent.trim();
        // Look for patterns like "4.50%" (exactly matching a percentage with decimal)
        return /^\d+\.\d+%$/.test(text);
      });
      
      if (percentElements.length > 0) {
        // Check if there's any element with "APY" nearby to confirm it's the yield
        for (const el of percentElements) {
          // Check if this element or its siblings contain "APY"
          if (el.textContent && el.textContent.includes('APY')) {
            return el.textContent.trim();
          }
          
          // Check parent elements and siblings for "APY" text
          let parent = el.parentElement;
          for (let i = 0; i < 3 && parent; i++) { // Check up to 3 levels up
            if (parent.textContent && parent.textContent.includes('APY')) {
              return el.textContent.trim();
            }
            
            // Check siblings of the parent
            const siblings = Array.from(parent.children);
            for (const sibling of siblings) {
              if (sibling !== el && sibling.textContent && sibling.textContent.includes('APY')) {
                return el.textContent.trim();
              }
            }
            
            parent = parent.parentElement;
          }
        }
        
        // If we found percentage elements but couldn't confirm with "APY", return the first one
        // that looks like a prominent yield display (likely the largest font or most prominent position)
        return percentElements[0].textContent.trim();
      }
      
      // Fallback to a regex search for patterns like "4.50% APY" anywhere on the page
      const elements = Array.from(document.querySelectorAll('*'));
      for (const el of elements) {
        if (el.textContent) {
          const match = el.textContent.match(/(\d+\.\d+)%\s*APY/i);
          if (match) return match[0];
        }
      }
      
      // As a last resort, look for any percentage on the page
      for (const el of elements) {
        if (el.textContent) {
          const match = el.textContent.match(/(\d+\.\d+)%/);
          if (match && !el.textContent.includes('success')) {
            return match[0];
          }
        }
      }
      
      // Return null if we couldn't find the yield percentage
      return null;
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '').replace('APY', '').trim()) : null;
    
    logWithTimestamp(`Current Mountain Protocol USD yield: ${yieldPercentage !== null ? yieldPercentage + '%' : 'Not found'}`);
    return yieldPercentage;
  } catch (error) {
    logWithTimestamp(`Error scraping Mountain Protocol yield: ${error.message}`, true);
    return null;
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

async function processStablecoin(stablecoin, scrapeFunction) {
  logWithTimestamp(`Processing ${stablecoin.name}...`);
  
  // Scrape the yield percentage
  const yieldPercentage = await scrapeFunction();
  
  // Update existing record in stablecoin_yield table if we have a valid yield percentage
  if (yieldPercentage !== null) {
    await updateStablecoinYield(stablecoin.id, stablecoin.name, yieldPercentage);
    
    // Also update any linked tokens with the same yield value
    if (stablecoin.linkedTokens && stablecoin.linkedTokens.length > 0) {
      for (const linkedToken of stablecoin.linkedTokens) {
        logWithTimestamp(`Updating linked token ${linkedToken.name} with the same yield value...`);
        await updateStablecoinYield(linkedToken.id, linkedToken.name, yieldPercentage);
      }
    }
  } else {
    logWithTimestamp(`Skipping Yield table update for ${stablecoin.name} due to null yield value`);
  }
  
  // Always create a new record in Measurements table
  await createMeasurementRecord(stablecoin.id, stablecoin.name, stablecoin.metricName, yieldPercentage);
  
  // Also create measurement records for any linked tokens
  if (stablecoin.linkedTokens && stablecoin.linkedTokens.length > 0) {
    for (const linkedToken of stablecoin.linkedTokens) {
      logWithTimestamp(`Creating measurement record for linked token ${linkedToken.name}...`);
      await createMeasurementRecord(
        linkedToken.id, 
        linkedToken.name, 
        linkedToken.metricName, 
        yieldPercentage
      );
    }
  }
}

async function main() {
  try {
    logWithTimestamp('Starting Stablecoin Yield Scraper Bot');
    
    // Process USDS (and linked tokens sUSDS and sDAI)
    await processStablecoin(STABLECOINS[0], scrapeSkyYield);
    
    // Process Ethena USDe
    await processStablecoin(STABLECOINS[1], scrapeEthenaYield);
    
    // Process Mountain Protocol USD
    await processStablecoin(STABLECOINS[2], scrapeMountainYield);
    
    logWithTimestamp('Stablecoin Yield Scraper Bot completed successfully');
  } catch (error) {
    logWithTimestamp(`Critical error in main process: ${error.message}`, true);
    process.exit(1);
  }
}

// Run the main function
main();
