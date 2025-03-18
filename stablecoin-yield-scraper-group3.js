// Stablecoin Yield Scraper Bot - Group 3
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

// Stablecoin details (third group of 5 coins)
const STABLECOINS = [
  {
    name: 'BlackRock USD Institutional Digital Liquidity Fund',
    id: '0x5a52e96bacdabb2f794da4b7fa8e0f8b8a7d49ae',
    url: 'https://tradingeconomics.com/united-states/3-month-bill-yield',
    metricName: 'yield_percentage'
  },
  {
    name: 'Compound cUSDT',
    id: '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9',
    url: 'https://app.compound.finance/?market=usdt-mainnet',
    metricName: 'yield_percentage'
  },
  {
    name: 'mStable USD',
    id: '0xe2f2a5c287993345a840db3b0845fbc70f5935a5',
    url: 'https://yield.mstable.org/vault/0x9c6de13d4648a6789017641f6b1a025816e66228',
    metricName: 'yield_percentage'
  },
  {
    name: 'stUSD',
    id: '0x0022228a2cc5E7eF0274A7Baa600d44da5aB5776',
    url: 'https://www.angle.money/stusd',
    metricName: 'yield_percentage'
  },
  {
    name: 'Staked Frax',
    id: '0xA663B02CF0a4b149d2aD41910CB81e23e1c41c32',
    url: 'https://app.frax.finance/sfrax/stake',
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
  const logFile = `./logs/stablecoin-scraper-group3-${today}.log`;
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

// Function to scrape BlackRock BUIDL yield (Treasury Bill yield)
async function scrapeTreasuryYield() {
  logWithTimestamp('Starting BlackRock BUIDL (Treasury Bill) yield scraping...');
  let browser = null;
  
  try {
    browser = await launchBrowserWithRetry();
    const page = await browser.newPage();
    
    // Set a longer default timeout
    page.setDefaultTimeout(60000);
    
    // Navigate to the Treasury Bills page
    await navigateWithRetry(page, STABLECOINS[0].url);
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 45000 });
    
    // Give the page extra time to load dynamic content
    logWithTimestamp('Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: './logs/treasury-page.png' });
    
    // Extract the yield percentage
    logWithTimestamp('Extracting yield percentage...');
    const yieldText = await page.evaluate(() => {
      // Look for the specific US 3 Month Bill Bond Yield text and value
      const yieldElements = Array.from(document.querySelectorAll('*'));
      
      for (const el of yieldElements) {
        if (el.textContent && el.textContent.includes('US 3 Month Bill Bond Yield')) {
          // Extract the yield value from this element or a nearby element
          const match = el.textContent.match(/Yield\s+(\d+\.\d+)/);
          if (match) return match[1];
          
          // Try to find a sibling or child with the actual value
          // First check direct siblings
          let sibling = el.nextElementSibling;
          while (sibling) {
            if (sibling.textContent && /\d+\.\d+/.test(sibling.textContent)) {
              const numMatch = sibling.textContent.match(/(\d+\.\d+)/);
              if (numMatch) return numMatch[1];
            }
            sibling = sibling.nextElementSibling;
          }
          
          // Check parent's children
          const parent = el.parentElement;
          if (parent) {
            // Look for children with the yield value (usually a number like 4.297)
            const children = Array.from(parent.querySelectorAll('*'));
            for (const child of children) {
              if (child !== el && child.textContent && /^\d+\.\d+$/.test(child.textContent.trim())) {
                return child.textContent.trim();
              }
            }
          }
        }
      }
      
      // Alternative method: Look for elements that display the large yield value
      // This is usually a prominent display number on the page
      const numberElements = Array.from(document.querySelectorAll('.number, [data-value], .value, .yield'));
      for (const el of numberElements) {
        if (el.textContent && /^\d+\.\d+$/.test(el.textContent.trim())) {
          return el.textContent.trim();
        }
      }
      
      // If we still haven't found it, try to look for a chart element
      // Often the current value is displayed in or near the chart
      const chartElements = document.querySelectorAll('[id*="chart"], [class*="chart"]');
      for (const chart of chartElements) {
        // Look for numerical elements within or near the chart
        const nearbyElements = chart.querySelectorAll('*');
        for (const el of nearbyElements) {
          if (el.textContent && /^\d+\.\d+$/.test(el.textContent.trim())) {
            return el.textContent.trim();
          }
        }
      }
      
      // Last resort: look for any standalone number that looks like a yield percentage
      // This is often displayed as a large number in the page
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const text = el.textContent ? el.textContent.trim() : '';
        if (/^[1-9]\.\d+$/.test(text) || /^[1-9]\d?\.\d+$/.test(text)) {
          // Numbers like 4.297, 1.234, 10.56 etc.
          return text;
        }
      }
      
      return null;
    });
    
    // Clean up the yield text and convert to number
    const yieldPercentage = yieldText ? parseFloat(yieldText) : null;
    
    logWithTimestamp(`Current BlackRock BUIDL (Treasury Bill) yield: ${yieldPercentage !== null ? yieldPercentage + '%' : 'Not found'}`);
    return yieldPercentage;
  } catch (error) {
    logWithTimestamp(`Error scraping BlackRock BUIDL (Treasury Bill) yield: ${error.message}`, true);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Function to scrape Compound cUSDT yield
async function scrapeCompoundUSDT() {
  logWithTimestamp('Starting Compound cUSDT yield scraping...');
  let browser = null;
  
  try {
    browser = await launchBrowserWithRetry();
    const page = await browser.newPage();
    
    // Set a longer default timeout
    page.setDefaultTimeout(60000);
    
    // Navigate to the Compound website
    await navigateWithRetry(page, STABLECOINS[1].url);
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 45000 });
    
    // Give the page extra time to load dynamic content
    logWithTimestamp('Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 8000)); // Extra time for Compound's JS to load
    
    // Take a screenshot for debugging
    await page.screenshot({ path: './logs/compound-cusdt-page.png' });
    
    // Extract the yield percentage from the Compound website
    const yieldText = await page.evaluate(() => {
      // Based on the screenshot, look for "Net Supply APR" and the associated value
      const elements = Array.from(document.querySelectorAll('*'));
      
      // Option 1: Look for exact text "Net Supply APR" and value nearby
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
            
            // Go up one more level
            const grandparent = parent.parentElement;
            if (grandparent) {
              const children = Array.from(grandparent.querySelectorAll('*'));
              for (const child of children) {
                if (child !== parent && child.textContent && /\d+\.\d+%/.test(child.textContent)) {
                  const match = child.textContent.match(/(\d+\.\d+)%/);
                  if (match) return match[0];
                }
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
      
      // Return null if we couldn't find the yield percentage
      return null;
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    logWithTimestamp(`Current Compound cUSDT yield: ${yieldPercentage !== null ? yieldPercentage + '%' : 'Not found'}`);
    return yieldPercentage;
  } catch (error) {
    logWithTimestamp(`Error scraping Compound cUSDT yield: ${error.message}`, true);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Function to scrape mStable USD yield
async function scrapeMStableYield() {
  logWithTimestamp('Starting mStable USD yield scraping...');
  let browser = null;
  
  try {
    browser = await launchBrowserWithRetry();
    const page = await browser.newPage();
    
    // Set a longer default timeout
    page.setDefaultTimeout(60000);
    
    // Navigate to the mStable page
    await navigateWithRetry(page, STABLECOINS[2].url);
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 45000 });
    
    // Give the page extra time to load dynamic content
    logWithTimestamp('Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: './logs/mstable-page.png' });
    
    // Extract the yield percentage from the mStable page
    const yieldText = await page.evaluate(() => {
      // Look for APY label and the associated value
      // Based on the screenshot, this should be displayed prominently as "5.43%"
      
      // First try: Look for an element that contains "APY" text
      const apyElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.trim() === 'APY'
      );
      
      for (const apyEl of apyElements) {
        // Check siblings for the percentage value
        let sibling = apyEl.nextElementSibling;
        while (sibling) {
          if (sibling.textContent && /\d+\.\d+%/.test(sibling.textContent)) {
            const match = sibling.textContent.match(/(\d+\.\d+)%/);
            if (match) return match[0];
          }
          sibling = sibling.nextElementSibling;
        }
        
        // Check parent element for the APY value
        const parent = apyEl.parentElement;
        if (parent) {
          // Look for any text with a percentage within this parent
          if (parent.textContent && /\d+\.\d+%/.test(parent.textContent)) {
            const match = parent.textContent.match(/(\d+\.\d+)%/);
            if (match) return match[0];
          }
          
          // Check all children of the parent for percentage values
          const siblings = Array.from(parent.children);
          for (const sib of siblings) {
            if (sib !== apyEl && sib.textContent && /\d+\.\d+%/.test(sib.textContent)) {
              const match = sib.textContent.match(/(\d+\.\d+)%/);
              if (match) return match[0];
            }
          }
          
          // Try going up one more level to grandparent
          const grandparent = parent.parentElement;
          if (grandparent) {
            if (grandparent.textContent && /\d+\.\d+%/.test(grandparent.textContent)) {
              const match = grandparent.textContent.match(/(\d+\.\d+)%/);
              if (match) return match[0];
            }
          }
        }
      }
      
      // Second try: Look for large percentage display elements
      // These are often displayed prominently in the UI
      const elements = Array.from(document.querySelectorAll('*'));
      for (const el of elements) {
        if (el.textContent && /^\d+\.\d+%$/.test(el.textContent.trim())) {
          return el.textContent.trim();
        }
      }
      
      // Third try: Look for elements with specific classes that might contain the APY
      const apyContainers = document.querySelectorAll('[class*="apy"], [class*="yield"], [class*="rate"]');
      for (const container of apyContainers) {
        if (container.textContent && /\d+\.\d+%/.test(container.textContent)) {
          const match = container.textContent.match(/(\d+\.\d+)%/);
          if (match) return match[0];
        }
      }
      
      // Third approach: Look for elements specifically related to sFRAX
      const sfraxElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && (
          el.textContent.includes('sFRAX') || 
          el.textContent.includes('Staked FRAX') ||
          el.textContent.includes('Stake FRAX')
        )
      );
      
      for (const el of sfraxElements) {
        // Look for nearby APY or percentage elements
        let current = el;
        for (let i = 0; i < 5 && current; i++) { // Check up to 5 levels up
          if (!current) break;
          
          if (current.textContent && /\d+\.\d+%/.test(current.textContent)) {
            const match = current.textContent.match(/(\d+\.\d+)%/);
            if (match) return match[0];
          }
          
          // Check all children of this element
          const children = Array.from(current.querySelectorAll('*'));
          for (const child of children) {
            if (child.textContent && 
                (child.textContent.includes('APY') || child.textContent.includes('apy')) && 
                /\d+\.\d+%/.test(child.textContent)) {
              const match = child.textContent.match(/(\d+\.\d+)%/);
              if (match) return match[0];
            }
          }
          
          current = current.parentElement;
        }
      }
      
      // Fourth approach: Look for standalone percentage values that might be APY
      const percentElements = Array.from(document.querySelectorAll('*'));
      const standalonePcts = [];
      
      for (const el of percentElements) {
        if (el.textContent && /^\s*\d+\.\d+%\s*$/.test(el.textContent.trim())) {
          standalonePcts.push({
            element: el,
            value: el.textContent.trim()
          });
        }
      }
      
      // If we have standalone percentages, take the one most likely to be the APY
      if (standalonePcts.length > 0) {
        // If there's only one, use it
        if (standalonePcts.length === 1) {
          return standalonePcts[0].value;
        }
        
        // Otherwise, prefer values around 5.00% (the value in the screenshot)
        for (const pct of standalonePcts) {
          const value = parseFloat(pct.value);
          if (value >= 4.5 && value <= 5.5) {
            return pct.value;
          }
        }
        
        // If nothing close to 5%, just take the first one
        return standalonePcts[0].value;
      }
      
      return null;
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    logWithTimestamp(`Current Staked Frax yield: ${yieldPercentage !== null ? yieldPercentage + '%' : 'Not found'}`);
    return yieldPercentage;
  } catch (error) {
    logWithTimestamp(`Error scraping Staked Frax yield: ${error.message}`, true);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}d+\.\d+)%/);
          if (match) return match[0];
        }
      }
      
      // Fourth try: Look for elements near "Meta Harvester" title
      const titleElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.includes('Meta Harvester')
      );
      
      for (const titleEl of titleElements) {
        // Check parent and its children
        const parent = titleEl.parentElement;
        if (parent) {
          const children = Array.from(parent.querySelectorAll('*'));
          for (const child of children) {
            if (child.textContent && /\d+\.\d+%/.test(child.textContent)) {
              const match = child.textContent.match(/(\d+\.\d+)%/);
              if (match) return match[0];
            }
          }
        }
      }
      
      return null;
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    logWithTimestamp(`Current mStable USD yield: ${yieldPercentage !== null ? yieldPercentage + '%' : 'Not found'}`);
    return yieldPercentage;
  } catch (error) {
    logWithTimestamp(`Error scraping mStable USD yield: ${error.message}`, true);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Function to scrape Angle stUSD yield
async function scrapeAngleYield() {
  logWithTimestamp('Starting stUSD yield scraping...');
  let browser = null;
  
  try {
    browser = await launchBrowserWithRetry();
    const page = await browser.newPage();
    
    // Set a longer default timeout
    page.setDefaultTimeout(60000);
    
    // Navigate to the Angle stUSD page
    await navigateWithRetry(page, STABLECOINS[3].url);
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 45000 });
    
    // Give the page extra time to load dynamic content
    logWithTimestamp('Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: './logs/angle-page.png' });
    
    // Extract the yield percentage from the Angle stUSD page
    const yieldText = await page.evaluate(() => {
      // Look for the APY indicator and associated value (5.53% from screenshot)
      
      // First approach: Look for elements that contain "APY" text
      const apyElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.trim() === 'APY'
      );
      
      for (const apyEl of apyElements) {
        // Look for nearby elements with a percentage value
        
        // Check previous siblings (the percentage might be above the APY text)
        let sibling = apyEl.previousElementSibling;
        while (sibling) {
          if (sibling.textContent && /\d+\.\d+%/.test(sibling.textContent)) {
            const match = sibling.textContent.match(/(\d+\.\d+)%/);
            if (match) return match[0];
          }
          sibling = sibling.previousElementSibling;
        }
        
        // Check parent element and its children
        const parent = apyEl.parentElement;
        if (parent) {
          // Look for percentage values within the parent element
          if (parent.textContent && /\d+\.\d+%/.test(parent.textContent)) {
            const match = parent.textContent.match(/(\d+\.\d+)%/);
            if (match) return match[0];
          }
          
          // Check all children of the parent for percentage values
          const siblings = Array.from(parent.children);
          for (const sib of siblings) {
            if (sib !== apyEl && sib.textContent && /\d+\.\d+%/.test(sib.textContent)) {
              const match = sib.textContent.match(/(\d+\.\d+)%/);
              if (match) return match[0];
            }
          }
          
          // Check grandparent
          const grandparent = parent.parentElement;
          if (grandparent) {
            // Look for percentage values within the grandparent
            const children = Array.from(grandparent.querySelectorAll('*'));
            for (const child of children) {
              if (child !== parent && child.textContent && /\d+\.\d+%/.test(child.textContent)) {
                const match = child.textContent.match(/(\d+\.\d+)%/);
                if (match) return match[0];
              }
            }
          }
        }
      }
      
      // Second approach: Look for large percentage numbers (they're often displayed prominently)
      const percentElements = Array.from(document.querySelectorAll('*'));
      for (const el of percentElements) {
        if (el.textContent && /^\d+\.\d+%$/.test(el.textContent.trim())) {
          // This looks like a standalone percentage value
          return el.textContent.trim();
        }
      }
      
      // Third approach: Look for larger containers with both percentage and APY
      const containers = document.querySelectorAll('div, section, article');
      for (const container of containers) {
        if (container.textContent && 
            container.textContent.includes('APY') && 
            /\d+\.\d+%/.test(container.textContent)) {
          const match = container.textContent.match(/(\d+\.\d+)%/);
          if (match) return match[0];
        }
      }
      
      // Fourth approach: Look for specific sections or elements in the Angle UI
      // Look for anything that mentions stUSD and has a percentage
      const stUsdElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.includes('stUSD')
      );
      
      for (const el of stUsdElements) {
        // Check parent container for APY value
        let current = el;
        for (let i = 0; i < 5 && current; i++) { // Go up to 5 levels up
          if (!current) break;
          
          if (current.textContent && 
              current.textContent.includes('APY') && 
              /\d+\.\d+%/.test(current.textContent)) {
            const match = current.textContent.match(/(\d+\.\d+)%/);
            if (match) return match[0];
          }
          
          current = current.parentElement;
        }
      }
      
      return null;
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    logWithTimestamp(`Current stUSD yield: ${yieldPercentage !== null ? yieldPercentage + '%' : 'Not found'}`);
    return yieldPercentage;
  } catch (error) {
    logWithTimestamp(`Error scraping stUSD yield: ${error.message}`, true);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Function to scrape Frax yield
async function scrapeFraxYield() {
  logWithTimestamp('Starting Staked Frax yield scraping...');
  let browser = null;
  
  try {
    browser = await launchBrowserWithRetry();
    const page = await browser.newPage();
    
    // Set a longer default timeout
    page.setDefaultTimeout(60000);
    
    // Navigate to the Frax Finance page
    await navigateWithRetry(page, STABLECOINS[4].url);
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 45000 });
    
    // Give the page extra time to load dynamic content
    logWithTimestamp('Waiting for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: './logs/frax-page.png' });
    
    // Extract the yield percentage from the Frax Finance page
    const yieldText = await page.evaluate(() => {
      // Look for the EST. CURRENT APY section and its value (5.00% from screenshot)
      
      // First approach: Look for text "EST. CURRENT APY" or similar
      const apyLabels = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && (
          el.textContent.includes('EST. CURRENT APY') || 
          el.textContent.includes('CURRENT APY') ||
          el.textContent.includes('EST APY')
        )
      );
      
      for (const label of apyLabels) {
        // Check if the label itself contains a percentage
        if (/\d+\.\d+%/.test(label.textContent)) {
          const match = label.textContent.match(/(\d+\.\d+)%/);
          if (match) return match[0];
        }
        
        // Check siblings for the percentage value
        let sibling = label.nextElementSibling;
        while (sibling) {
          if (sibling.textContent && /\d+\.\d+%/.test(sibling.textContent)) {
            const match = sibling.textContent.match(/(\d+\.\d+)%/);
            if (match) return match[0];
          }
          sibling = sibling.nextElementSibling;
        }
        
        // Check parent element and its children
        const parent = label.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children);
          for (const sib of siblings) {
            if (sib !== label && sib.textContent && /\d+\.\d+%/.test(sib.textContent)) {
              const match = sib.textContent.match(/(\d+\.\d+)%/);
              if (match) return match[0];
            }
          }
          
          // Check parent for percentage
          if (parent.textContent && /\d+\.\d+%/.test(parent.textContent)) {
            const match = parent.textContent.match(/(\d+\.\d+)%/);
            if (match) return match[0];
          }
        }
      }
      
      // Second approach: Look for section headers or containers related to APY
      const apyContainers = document.querySelectorAll('[class*="apy"], [class*="APY"], [class*="yield"], [class*="Yield"]');
      for (const container of apyContainers) {
        if (container.textContent && /\d+\.\d+%/.test(container.textContent)) {
          const match = container.textContent.match(/(\
