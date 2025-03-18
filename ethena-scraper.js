// Ethena Yield Scraper Bot
// This script scrapes the Ethena website for the current USDe yield percentage
// and stores the data in a NocoDB database

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

// Ethena stablecoin details
const ETHENA_STABLECOIN = {
  name: 'Ethena USDe',
  id: '0x4c9edd5852cd905f086c759e8383e09bff1e68b3',
  url: 'https://www.ethena.fi/',
  metricName: 'yield_percentage'
};

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
  const logFile = `./logs/ethena-scraper-${today}.log`;
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

// Function to scrape Ethena yield with retry mechanism
async function scrapeEthenaYield(maxRetries = 3) {
  logWithTimestamp('Starting Ethena yield scraping...');
  let browser = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logWithTimestamp(`Attempt ${attempt} of ${maxRetries}`);
      
      // Launch browser with optimized settings for CI environment
      browser = await puppeteer.launch({
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
      
      const page = await browser.newPage();
      
      // Set a longer default timeout
      page.setDefaultTimeout(60000);
      
      // Add a small delay before navigation to ensure browser is ready
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Go to the Ethena website
      logWithTimestamp(`Navigating to ${ETHENA_STABLECOIN.url}`);
      await page.goto(ETHENA_STABLECOIN.url, { 
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      // Wait for the page to load completely
      await page.waitForSelector('body', { timeout: 45000 });
      
      // Give the page extra time to load dynamic content
      logWithTimestamp('Waiting for dynamic content to load...');
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // Take a screenshot for debugging
      await page.screenshot({ path: `./logs/ethena-page-${attempt}.png` });
      
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
      
      // Close the browser
      await browser.close();
      browser = null;
      
      return yieldPercentage;
    } catch (error) {
      logWithTimestamp(`Error scraping Ethena yield (attempt ${attempt}): ${error.message}`, true);
      
      // Close the browser if it's open
      if (browser) {
        await browser.close();
        browser = null;
      }
      
      // If this is the last attempt, give up and return null
      if (attempt === maxRetries) {
        return null;
      }
      
      // Otherwise wait before retrying
      logWithTimestamp(`Waiting 10 seconds before retry attempt ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  return null; // Should never reach here but just in case
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

async function main() {
  try {
    logWithTimestamp('Starting Ethena Yield Scraper Bot');
    
    // Scrape the yield percentage
    const yieldPercentage = await scrapeEthenaYield();
    
    // Update existing record in stablecoin_yield table if we have a valid yield percentage
    if (yieldPercentage !== null) {
      await updateStablecoinYield(
        ETHENA_STABLECOIN.id, 
        ETHENA_STABLECOIN.name, 
        yieldPercentage
      );
    } else {
      logWithTimestamp(`Skipping Yield table update for ${ETHENA_STABLECOIN.name} due to null yield value`);
    }
    
    // Always create a new record in Measurements table, even if yield is null
    await createMeasurementRecord(
      ETHENA_STABLECOIN.id, 
      ETHENA_STABLECOIN.name, 
      ETHENA_STABLECOIN.metricName, 
      yieldPercentage
    );
    
    logWithTimestamp('Ethena Yield Scraper Bot completed successfully');
  } catch (error) {
    logWithTimestamp(`Critical error in main process: ${error.message}`, true);
    process.exit(1);
  }
}

// Run the main function
main();
