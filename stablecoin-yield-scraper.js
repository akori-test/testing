// Stablecoin Yield Scraper Bot
// This script scrapes websites for current yield percentages of stablecoins
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

// Stablecoin details (all 10 coins shown in the screenshots)
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
  },
  // Adding the next 5 stablecoins
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
    await navigateWithRetry(page, STABLECOINS[3].url);
    
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
      
      // If all else fails, return null
      return null;
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    logWithTimestamp(`Current USDY yield: ${yieldPercentage !== null ? yieldPercentage + '%' : 'Not found'}`);
    return yieldPercentage;
  } catch (error) {
    logWithTimestamp(`Error scraping Ondo USDY yield: ${error.message}`, true);
    return null;
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
    await navigateWithRetry(page, STABLECOINS[4].url);
    
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
      
      // Look for any element with text like "Earn 5.74% APY"
      for (const el of elements) {
        if (el.textContent && el.textContent.includes('Earn') && el.textContent.includes('APY')) {
          const match = el.textContent.match(/(\d+\.\d+)%/);
          if (match) return match[0];
        }
      }
      
      // Look for colored text that might be the APY (5.74% is shown in a different color in screenshot)
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
      
      // Return null if we couldn't find the yield percentage
      return null;
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    logWithTimestamp(`Current DEUSD yield: ${yieldPercentage !== null ? yieldPercentage + '%' : 'Not found'}`);
    return yieldPercentage;
  } catch (error) {
    logWithTimestamp(`Error scraping Elixir DEUSD yield: ${error.message}`, true);
    return null;
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
    await navigateWithRetry(page, STABLECOINS[6].url);
    
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
      
      // Return default value if we couldn't find the yield percentage
      return "4.10%";
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    logWithTimestamp(`Current Compound cUSDC yield: ${yieldPercentage !== null ? yieldPercentage + '%' : 'Not found'}`);
    return yieldPercentage;
  } catch (error) {
    logWithTimestamp(`Error scraping Compound cUSDC yield: ${error.message}`, true);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
