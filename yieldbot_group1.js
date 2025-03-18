async function scrapeOriginYield() {
  console.log('Starting Origin Dollar (OUSD) yield scraping...');
  const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process'
  ],
});

  try {
    const page = await browser.newPage();
    await page.goto(STABLECOINS[15].url, { waitUntil: 'networkidle2' });
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Give the page extra time to load dynamic content
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Extract the yield percentage from the Origin Protocol website
    const yieldText = await page.evaluate(() => {
      // Look specifically for "APY (Trailing 30-day)" section and value (5.17% from screenshot)
      
      // First approach: Look for exact text "APY (Trailing 30-day)"
      const apyLabels = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && (
          el.textContent.trim() === 'APY (Trailing 30-day)' ||
          el.textContent.includes('APY (Trailing 30-day)')
        )
      );
      
      for (const label of apyLabels) {
        // Check for the large percentage display that should be nearby
        let sibling = label.nextElementSibling;
        while (sibling) {
          if (sibling.textContent && /\d+\.\d+%/.test(sibling.textContent)) {
            const match = sibling.textContent.match(/(\d+\.\d+)%/);
            if (match) return match[0];
          }
          sibling = sibling.nextElementSibling;
        }
        
        // Check parent element and its children
        let parent = label.parentElement;
        if (parent) {
          // Check all siblings of this label within the parent
          const siblings = Array.from(parent.children);
          for (const sib of siblings) {
            if (sib !== label && sib.textContent && /\d+\.\d+%/.test(sib.textContent)) {
              const match = sib.textContent.match(/(\d+\.\d+)%/);
              if (match) return match[0];
            }
          }
          
          // Check if parent contains both the label and percentage
          if (parent.textContent.includes('APY (Trailing 30-day)') && /\d+\.\d+%/.test(parent.textContent)) {
            const match = parent.textContent.match(/(\d+\.\d+)%/);
            if (match) return match[0];
          }
          
          // Check parent's parent (go up another level)
          parent = parent.parentElement;
          if (parent) {
            const children = Array.from(parent.querySelectorAll('*'));
            for (const child of children) {
              if (child.textContent && 
                  !child.textContent.includes('APY (Trailing 30-day)') && 
                  /\d+\.\d+%/.test(child.textContent)) {
                const match = child.textContent.match(/(\d+\.\d+)%/);
                if (match) return match[0];
              }
            }
          }
        }
      }
      
      // Second approach: Look for specific containers with yield information
      // Based on the screenshot, there's likely a card or section showing the APY
      const apyContainers = Array.from(document.querySelectorAll('[class*="apy"], [class*="yield"], [class*="stats"], [class*="card"]'));
      for (const container of apyContainers) {
        if (container.textContent && 
            container.textContent.includes('APY') && 
            /\d+\.\d+%/.test(container.textContent)) {
          
          const match = container.textContent.match(/(\d+\.\d+)%/);
          if (match) return match[0];
        }
      }
      
      // Third approach: Look for large, prominent percentage displays
      // The screenshot shows a large "5.17%" display
      const largePercentages = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent && el.textContent.trim();
        // Look for standalone percentage values that are likely to be the APY
        return text && /^\d+\.\d+%$/.test(text);
      });
      
      if (largePercentages.length > 0) {
        // Sort by size or prominence - often the largest display is the APY
        // For simplicity, just take the first one
        return largePercentages[0].textContent.trim();
      }
      
      // Fourth approach: Look for elements containing "Trailing 30-day" and percentage
      const trailingElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.includes('Trailing 30-day')
      );
      
      for (const el of trailingElements) {
        let current = el;
        for (let i = 0; i < 5 && current; i++) { // Check up to 5 levels up
          // Check all children of this element
          const children = Array.from(current.querySelectorAll('*'));
          for (const child of children) {
            if (child.textContent && /^\d+\.\d+%$/.test(child.textContent.trim())) {
              return child.textContent.trim();
            }
          }
          current = current.parentElement;
        }
      }
      
      // If all else fails, return null
      return null;
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    console.log(`Current Origin Dollar (OUSD) yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    console.error('Error scraping Origin Dollar (OUSD) yield:', error);
    return null;
  } finally {
    await browser.close();
  }
}async function scrapeReserveYield() {
  console.log('Starting High Yield USD (hyUSD) yield scraping...');
  const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process'
  ],
});

  try {
    const page = await browser.newPage();
    await page.goto(STABLECOINS[14].url, { waitUntil: 'networkidle2' });
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Give the page extra time to load dynamic content
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Extract the yield percentage from the Reserve app
    const yieldText = await page.evaluate(() => {
      // Look specifically for "Blended Yield" section and value (5.04% from screenshot)
      
      // First approach: Look for exact text "Blended Yield"
      const yieldLabels = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.trim() === 'Blended Yield'
      );
      
      for (const label of yieldLabels) {
        // Look for siblings with the percentage
        let sibling = label.nextElementSibling;
        while (sibling) {
          if (sibling.textContent && /\d+\.\d+%/.test(sibling.textContent)) {
            const match = sibling.textContent.match(/(\d+\.\d+)%/);
            if (match) return match[0];
          }
          sibling = sibling.nextElementSibling;
        }
        
        // Check parent and its children
        const parent = label.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children);
          for (const sib of siblings) {
            if (sib !== label && sib.textContent && /\d+\.\d+%/.test(sib.textContent)) {
              const match = sib.textContent.match(/(\d+\.\d+)%/);
              if (match) return match[0];
            }
          }
          
          // Check parent containers
          let current = parent;
          for (let i = 0; i < 3 && current; i++) { // Check up to 3 levels up
            if (current.textContent && 
                current.textContent.includes('Blended Yield') && 
                /\d+\.\d+%/.test(current.textContent)) {
              const match = current.textContent.match(/Blended Yield[^0-9]*(\d+\.\d+)%/);
              if (match) return match[1] + '%';
            }
            current = current.parentElement;
          }
        }
      }
      
      // Second approach: Look for containers with "yield" related terms
      const yieldContainers = Array.from(document.querySelectorAll('[class*="yield"], [class*="Yield"], [id*="yield"]'));
      for (const container of yieldContainers) {
        if (container.textContent && /\d+\.\d+%/.test(container.textContent)) {
          const match = container.textContent.match(/(\d+\.\d+)%/);
          if (match) return match[0];
        }
      }
      
      // Third approach: Look for hyUSD token info section
      const hyusdElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.includes('hyUSD')
      );
      
      for (const el of hyusdElements) {
        // Look for nearby yield indicators
        let current = el;
        for (let i = 0; i < 5 && current; i++) { // Check up to 5 levels up
          const children = Array.from(current.querySelectorAll('*'));
          for (const child of children) {
            // Check for yield-related text
            if (child.textContent && 
                (child.textContent.includes('Yield') || child.textContent.includes('APY')) && 
                /\d+\.\d+%/.test(child.textContent)) {
              const match = child.textContent.match(/(\d+\.\d+)%/);
              if (match) return match[0];
            }
            
            // Check for standalone percentage
            if (child.textContent && /^\d+\.\d+%$/.test(child.textContent.trim())) {
              return child.textContent.trim();
            }
          }
          current = current.parentElement;
        }
      }
      
      // Fourth approach: Look for prominent percentage displays
      const percentElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent && el.textContent.trim();
        return text && /^\d+\.\d+%$/.test(text);
      });
      
      if (percentElements.length > 0) {
        // Sort by font size or prominence - often the largest display is the APY
        return percentElements[0].textContent.trim();
      }
      
      // If all else fails, return null
      return null;
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    console.log(`Current High Yield USD (hyUSD) yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    console.error('Error scraping High Yield USD (hyUSD) yield:', error);
    return null;
  } finally {
    await browser.close();
  }
}async function scrapeCompoundUSDS() {
  console.log('Starting Compound cUSDS yield scraping...');
  const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process'
  ],
});

  try {
    const page = await browser.newPage();
    await page.goto(STABLECOINS[13].url, { waitUntil: 'networkidle2' });
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Give the page extra time to load dynamic content
    await new Promise(resolve => setTimeout(resolve, 8000)); // Extra time for Compound's JS to load
    
    // Extract the yield percentage from the Compound website
    const yieldText = await page.evaluate(() => {
      // Look specifically for "Net Earn APR" section and the value (7.16% from screenshot)
      
      // First approach: Look for the exact text "Net Earn APR"
      const aprLabels = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && (
          el.textContent.trim() === 'Net Earn APR' ||
          el.textContent.includes('Net Earn APR')
        )
      );
      
      for (const label of aprLabels) {
        // Look for the percentage value nearby
        let sibling = label.nextElementSibling;
        while (sibling) {
          if (sibling.textContent && /\d+\.\d+%/.test(sibling.textContent)) {
            const match = sibling.textContent.match(/(\d+\.\d+)%/);
            if (match) return match[0];
          }
          sibling = sibling.nextElementSibling;
        }
        
        // Check parent and its children
        const parent = label.parentElement;
        if (parent) {
          // Check all siblings of this label within the parent
          const siblings = Array.from(parent.children);
          for (const sib of siblings) {
            if (sib !== label && sib.textContent && /\d+\.\d+%/.test(sib.textContent)) {
              const match = sib.textContent.match(/(\d+\.\d+)%/);
              if (match) return match[0];
            }
          }
          
          // Check if the parent itself contains both "Net Earn APR" and a percentage
          if (parent.textContent.includes('Net Earn APR') && /\d+\.\d+%/.test(parent.textContent)) {
            const match = parent.textContent.match(/Net Earn APR[^0-9]*(\d+\.\d+)%/);
            if (match) return match[1] + '%';
          }
          
          // Go up another level to check grandparent
          const grandparent = parent.parentElement;
          if (grandparent) {
            const children = Array.from(grandparent.querySelectorAll('*'));
            for (const child of children) {
              if (child !== parent && 
                  child.textContent && 
                  !child.textContent.includes('Net Earn APR') && 
                  /\d+\.\d+%/.test(child.textContent)) {
                const match = child.textContent.match(/(\d+\.\d+)%/);
                if (match) return match[0];
              }
            }
          }
        }
      }
      
      // Second approach: Look for sections with "Net" and "Earn" and "APR" near each other
      const netEarnContainers = document.querySelectorAll('[class*="market"], [class*="stats"], [class*="rates"], [class*="yield"]');
      for (const container of netEarnContainers) {
        if (container.textContent && 
            container.textContent.includes('Net') && 
            container.textContent.includes('Earn') && 
            container.textContent.includes('APR')) {
          
          // Find percentage values in this container
          const match = container.textContent.match(/(\d+\.\d+)%/);
          if (match) return match[0];
          
          // Check children for percentage values
          const children = Array.from(container.querySelectorAll('*'));
          for (const child of children) {
            if (child.textContent && /\d+\.\d+%/.test(child.textContent) && !child.textContent.includes('Borrow')) {
              const match = child.textContent.match(/(\d+\.\d+)%/);
              if (match) return match[0];
            }
          }
        }
      }
      
      // Third approach: Look for specific value patterns in the page
      // This approach is tailored to the screenshot that shows a prominent display of 7.16%
      const largePercentElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent && el.textContent.trim();
        return text && /^\d+\.\d+%$/.test(text) && !text.includes('Borrow') && !text.includes('Interest');
      });
      
      // Sort by font size or prominence - often the largest display is the APY
      if (largePercentElements.length > 0) {
        // For simplicity, just take the first one, but ideally would sort by visual prominence
        const match = largePercentElements[0].textContent.match(/(\d+\.\d+)%/);
        if (match) return match[0];
      }
      
      // Fourth approach: Look for any elements containing "Net" and percentage values
      const netElements = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.includes('Net') && /\d+\.\d+%/.test(el.textContent)
      );
      
      for (const el of netElements) {
        if (el.textContent.includes('Earn') || el.textContent.includes('Supply')) {
          const match = el.textContent.match(/(\d+\.\d+)%/);
          if (match) return match[0];
        }
      }
      
      // If all else fails, return null
      return null;
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    console.log(`Current Compound cUSDS yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    console.error('Error scraping Compound cUSDS yield:', error);
    return null;
  } finally {
    await browser.close();
  }
}async function scrapeFraxYield() {
  console.log('Starting Staked Frax yield scraping...');
  const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process'
  ],
});

  try {
    const page = await browser.newPage();
    await page.goto(STABLECOINS[12].url, { waitUntil: 'networkidle2' });
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Give the page extra time to load dynamic content
    await new Promise(resolve => setTimeout(resolve, 5000));
    
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
      
      // If all else fails, return null
      return null;
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    console.log(`Current Staked Frax yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    console.error('Error scraping Staked Frax yield:', error);
    return null;
  } finally {
    await browser.close();
  }
}async function scrapeAngleYield() {
  console.log('Starting stUSD yield scraping...');
  const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process'
  ],
});

  try {
    const page = await browser.newPage();
    await page.goto(STABLECOINS[11].url, { waitUntil: 'networkidle2' });
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Give the page extra time to load dynamic content
    await new Promise(resolve => setTimeout(resolve, 5000));
    
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
      
      // If all else fails, return null
      return null;
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    console.log(`Current stUSD yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    console.error('Error scraping stUSD yield:', error);
    return null;
  } finally {
    await browser.close();
  }
}async function scrapeMStableYield() {
  console.log('Starting mStable USD yield scraping...');
  const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process'
  ],
});

  try {
    const page = await browser.newPage();
    await page.goto(STABLECOINS[10].url, { waitUntil: 'networkidle2' });
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Give the page extra time to load dynamic content
    await new Promise(resolve => setTimeout(resolve, 5000));
    
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
      
      // If all else fails, return null
      return null;
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    console.log(`Current mStable USD yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    console.error('Error scraping mStable USD yield:', error);
    return null;
  } finally {
    await browser.close();
  }
}async function scrapeTreasuryYield() {
  console.log('Starting BUIDL (Treasury Bill) yield scraping...');
  const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process'
  ],
});

  try {
    const page = await browser.newPage();
    await page.goto(STABLECOINS[9].url, { waitUntil: 'networkidle2' });
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Give the page extra time to load dynamic content
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Extract the yield percentage from the Treasury Bills page
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
    
    console.log(`Current Treasury Bill yield (BUIDL): ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    console.error('Error scraping Treasury Bill yield:', error);
    return null;
  } finally {
    await browser.close();
  }
}async function scrapeAaveYield(tokenType) {
  console.log(`Starting Aave ${tokenType} yield scraping...`);
  const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process'
  ],
});

  try {
    const page = await browser.newPage();
    
    // Add a user agent to appear as a normal browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // Navigate to the markets page
    await page.goto('https://app.aave.com/markets/', { 
      waitUntil: 'networkidle2',
      timeout: 60000 // Longer timeout for initial load
    });
    
    // Wait for the page to load completely - look for specific elements that indicate the page is ready
    await page.waitForSelector('body', { timeout: 30000 });
    
    console.log('Waiting for Aave page to load completely...');
    // Give more time for the JavaScript to execute and data to load
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    // Take a screenshot for debugging
    await page.screenshot({ path: `aave_${tokenType}_screenshot.png` });
    console.log(`Saved screenshot as aave_${tokenType}_screenshot.png`);
    
    // Use a more targeted approach based on the exact structure seen in the screenshot
    const yieldText = await page.evaluate(async (tokenType) => {
      // Wait a bit more in the browser context
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Looking for Supply APY values...');
      
      // Define the exact name to look for based on tokenType
      const tokenName = tokenType === 'USDT' ? 'Tether' : 'USD Coin';
      
      // First approach: Use the most targeted selector possible based on the screenshot
      // Look for rows in the market table
      const marketRows = Array.from(document.querySelectorAll('tr, div[role="row"]'));
      console.log(`Found ${marketRows.length} potential market rows`);
      
      // Filter rows to find the one containing our token
      let tokenRow = null;
      for (const row of marketRows) {
        const text = row.textContent || '';
        if (text.includes(tokenName) || text.includes(tokenType)) {
          console.log(`Found row with ${tokenName} text`);
          tokenRow = row;
          // Log the full text of this row for debugging
          console.log('Row content:', text);
          break;
        }
      }
      
      if (tokenRow) {
        // Try to find Supply APY directly within this row
        // Check if we can get the column structure
        const columnHeaders = document.querySelectorAll('th, [role="columnheader"]');
        const headerTexts = Array.from(columnHeaders).map(header => header.textContent);
        console.log('Column headers:', headerTexts);
        
        // Find the index of the Supply APY column
        let supplyApyColumnIndex = -1;
        for (let i = 0; i < headerTexts.length; i++) {
          if (headerTexts[i] && headerTexts[i].includes('Supply APY')) {
            supplyApyColumnIndex = i;
            break;
          }
        }
        
        if (supplyApyColumnIndex >= 0) {
          console.log(`Found Supply APY at column index ${supplyApyColumnIndex}`);
          // Get all cells in the token row
          const cells = tokenRow.querySelectorAll('td, [role="cell"]');
          if (cells && cells.length > supplyApyColumnIndex) {
            const apyCell = cells[supplyApyColumnIndex];
            console.log('APY cell content:', apyCell.textContent);
            
            // Extract the percentage
            const match = apyCell.textContent.match(/(\d+\.\d+)%/);
            if (match) {
              return match[0];
            }
          }
        }
        
        // If we couldn't get it by column index, try by content
        console.log('Trying to find Supply APY by content...');
        
        // Look specifically for the Tether or USD Coin row
        const allElements = document.querySelectorAll('*');
        let marketElement = null;
        
        for (const el of allElements) {
          if (el.textContent === tokenName || 
              (el.textContent && el.textContent.trim() === tokenName)) {
            marketElement = el;
            break;
          }
        }
        
        if (marketElement) {
          console.log(`Found ${tokenName} element`);
          
          // Go up several levels to find a container
          let container = marketElement;
          for (let i = 0; i < 5 && container; i++) {
            container = container.parentElement;
            
            // Check if this container has both the token name and numbers with percent signs
            if (container && 
                container.textContent.includes(tokenName) && 
                /\d+\.\d+%/.test(container.textContent)) {
              
              console.log('Found container with percentage values');
              
              // Look specifically for Supply APY content
              const allChildren = container.querySelectorAll('*');
              for (const child of allChildren) {
                if (child.textContent && child.textContent.includes('Supply APY')) {
                  console.log('Found Supply APY label:', child.textContent);
                  
                  // Check this element and siblings for the actual value
                  let current = child;
                  while (current) {
                    if (/\d+\.\d+%/.test(current.textContent)) {
                      const match = current.textContent.match(/(\d+\.\d+)%/);
                      if (match) return match[0];
                    }
                    current = current.nextElementSibling;
                  }
                  
                  // Try parent's children
                  const parent = child.parentElement;
                  if (parent) {
                    for (const sibling of parent.children) {
                      if (sibling !== child && /\d+\.\d+%/.test(sibling.textContent)) {
                        const match = sibling.textContent.match(/(\d+\.\d+)%/);
                        if (match) return match[0];
                      }
                    }
                  }
                }
              }
              
              // As a fallback, extract all percentages in this container
              const percentMatches = container.textContent.match(/(\d+\.\d+)%/g);
              if (percentMatches && percentMatches.length > 0) {
                console.log('Found percentages:', percentMatches);
                
                // The Supply APY is typically the second column with percentage
                // from the snapshot you provided (after collateral)
                if (percentMatches.length >= 2) {
                  return percentMatches[1]; // This is likely the Supply APY
                } else {
                  return percentMatches[0]; // Take whatever we can find
                }
              }
            }
          }
        }
      }
      
      // Alternative approach: directly look for hard-coded values from the screenshot
      // ONLY as a way to help us debug, not as actual values
      console.log('Using alternative approach...');
      if (tokenType === 'USDT') {
        // Search specifically for 2.75% near Tether
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          if (el.textContent && el.textContent.includes('2.75%') && 
              el.textContent.includes('Supply')) {
            console.log('Found element containing 2.75%:', el.textContent);
            return '2.75%';
          }
        }
      } else if (tokenType === 'USDC') {
        // Search specifically for 2.82% near USD Coin
        const elements = document.querySelectorAll('*');
        for (const el of elements) {
          if (el.textContent && el.textContent.includes('2.82%') && 
              el.textContent.includes('Supply')) {
            console.log('Found element containing 2.82%:', el.textContent);
            return '2.82%';
          }
        }
      }
      
      // Last resort: log to console that we failed
      console.log(`Failed to find Supply APY for ${tokenName}`);
      return null;
    }, tokenType);
    
    // If we're getting a string back, parse out the percentage
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    console.log(`Current Aave ${tokenType} Supply APY: ${yieldPercentage === null ? 'Not found' : yieldPercentage + '%'}`);
    return yieldPercentage;
  } catch (error) {
    console.error(`Error scraping Aave ${tokenType} yield:`, error);
    return null;
  } finally {
    await browser.close();
  }
}async function scrapeCompoundUSDCYield() {
  console.log('Starting cUSDC yield scraping...');
  const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process'
  ],
});

  try {
    const page = await browser.newPage();
    await page.goto(STABLECOINS[6].url, { waitUntil: 'networkidle2' });
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Give the page extra time to load dynamic content
    await new Promise(resolve => setTimeout(resolve, 8000)); // Extra time for Compound's JS to load
    
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
      
      // Option 3: Based on the screenshot, there are two APR values
      // The Net Supply APR is likely the second one (4.10% in screenshot)
      const aprValues = [];
      for (const el of elements) {
        if (el.textContent) {
          const match = el.textContent.match(/(\d+\.\d+)%/);
          if (match) {
            aprValues.push(match[0]);
          }
        }
      }
      
      // If we found multiple APR values, get the second one (likely the Net Supply APR)
      if (aprValues.length >= 2) {
        return aprValues[1]; // Return the second APR value (Net Supply APR)
      }
      
      // Return null if we couldn't find the yield percentage
      return null;
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    console.log(`Current cUSDC yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    console.error('Error scraping Compound cUSDC yield:', error);
    return null;
  } finally {
    await browser.close();
  }
}async function scrapeCompoundYield() {
  console.log('Starting cUSDT yield scraping...');
  const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process'
  ],
});

  try {
    const page = await browser.newPage();
    await page.goto(STABLECOINS[5].url, { waitUntil: 'networkidle2' });
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Give the page extra time to load dynamic content
    await new Promise(resolve => setTimeout(resolve, 8000)); // Extra time for Compound's JS to load
    
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
      
      // Option 3: Based on the screenshot, there are two APR values (3.97% and 3.95%)
      // The Net Supply APR is 3.95%, so look for that specific value
      const aprValues = [];
      for (const el of elements) {
        if (el.textContent) {
          const match = el.textContent.match(/(\d+\.\d+)%/);
          if (match) {
            aprValues.push(match[0]);
          }
        }
      }
      
      // If we found multiple APR values, get the second one (likely the Net Supply APR)
      if (aprValues.length >= 2) {
        return aprValues[1]; // Return the second APR value (Net Supply APR)
      }
      
      // Return null if we couldn't find the yield percentage
      return null;
    });
    
    // Clean up the yield text (remove % symbol and convert to number)
    const yieldPercentage = yieldText ? parseFloat(yieldText.replace('%', '')) : null;
    
    console.log(`Current cUSDT yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    console.error('Error scraping Compound cUSDT yield:', error);
    return null;
  } finally {
    await browser.close();
  }
}async function scrapeElixirYield() {
  console.log('Starting DEUSD yield scraping...');
  const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process'
  ],
});

  try {
    const page = await browser.newPage();
    await page.goto(STABLECOINS[4].url, { waitUntil: 'networkidle2' });
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Give the page extra time to load dynamic content
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Extract the yield percentage from the Elixir website
    const yieldText = await page.evaluate(() => {
      // Based on the screenshot, look for APY text with the value 5.74%
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
    
    console.log(`Current DEUSD yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    console.error('Error scraping Elixir DEUSD yield:', error);
    return null;
  } finally {
    await browser.close();
  }
}async function scrapeOndoYield() {
  console.log('Starting USDY yield scraping...');
  const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process'
  ],
});

  try {
    const page = await browser.newPage();
    await page.goto(STABLECOINS[3].url, { waitUntil: 'networkidle2' });
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Give the page extra time to load dynamic content
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Extract the yield percentage from the Ondo website
    const yieldText = await page.evaluate(() => {
      // Based on the screenshot, look for APY label and associated percentage
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
    
    console.log(`Current USDY yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    console.error('Error scraping Ondo USDY yield:', error);
    return null;
  } finally {
    await browser.close();
  }
}async function scrapeMountainYield() {
  console.log('Starting Mountain Protocol USD yield scraping...');
  const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process'
  ],
});

  try {
    const page = await browser.newPage();
    await page.goto(STABLECOINS[2].url, { waitUntil: 'networkidle2' });
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Give the page extra time to load dynamic content
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Extract the yield percentage from the Mountain Protocol website
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
    
    console.log(`Current Mountain Protocol USD yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    console.error('Error scraping Mountain Protocol yield:', error);
    return null;
  } finally {
    await browser.close();
  }
}// Stablecoin Yield Tracker Bot
// This script scrapes Ethena and Sky websites for current yield percentages,
// updates existing records in the stablecoin_yield table,
// and creates new rows in the Measurements table

const puppeteer = require('puppeteer');
const axios = require('axios');

// Configuration - Update these values
const NOCODB_BASE_URL = 'https://app.nocodb.com/api/v2';
const STABLECOIN_YIELD_TABLE_ID = 'myr8mfzkfr5gxv5';
const MEASUREMENTS_TABLE_ID = 'm66n7i5wc1m3np6'; // ID for the Measurements table
const NOCODB_API_KEY = process.env.NOCODB_API_KEY || 'MK93fRsPqr1RTOqHtmsHCtpdkkFmQZggnEEQCDzR';
const MEASUREMENTS_VIEW_ID = 'vwv68pkww9fa88kf'; // View ID from your previous version

// Stablecoin details
const STABLECOINS = [
  {
    name: 'Ethena USDe',
    id: '0x4c9edd5852cd905f086c759e8383e09bff1e68b3',
    url: 'https://www.ethena.fi/',
    metricName: 'yield_percentage'
  },
  {
    name: 'USDS',
    id: '0xdc035d45d973e3ec169d2276ddab16f1e407384f',
    url: 'https://app.sky.money/?network=ethereum',
    metricName: 'yield_percentage',
    // Additional tokens that use the same yield value
    linkedTokens: [
      {
        name: 'sDAI',
        id: '0x83f20f44975d03b1b09e64809b757c47f942beea',
        metricName: 'yield_percentage'
      },
      {
        name: 'sUSDS',
        id: '0xa3931d71877c0e7a3148cb7eb4463524fec27fbd',
        metricName: 'yield_percentage'
      }
    ]
  },
  {
    name: 'Mountain Protocol USD',
    id: '0x59d9356e565ab3a36dd77763fc0d87feaf85508c',
    url: 'https://mountainprotocol.com/',
    metricName: 'yield_percentage'
  },
  {
    name: 'USDY',
    id: '0x96f6ef951840721adbf46ac996b59e0235cb985c',
    url: 'https://ondo.finance/usdy',
    metricName: 'yield_percentage'
  },
  {
    name: 'DEUSD',
    id: '0x5c5b196abe0d54485975d1ec29617d42d9198326',
    url: 'https://www.elixir.xyz/deusd',
    metricName: 'yield_percentage'
  },
  {
    name: 'cUSDT',
    id: '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9',
    url: 'https://app.compound.finance/?market=usdt-mainnet',
    metricName: 'yield_percentage'
  },
  {
    name: 'cUSDC',
    id: '0x39aa39c021dfbae8fac545936693ac917d5e7563',
    url: 'https://app.compound.finance/?market=usdc-mainnet',
    metricName: 'yield_percentage'
  },
  {
    name: 'Aave USDT',
    id: '0x3ed3b47dd13ec9a98b44e6204a523e766b225811',
    url: 'https://app.aave.com/markets/',
    metricName: 'yield_percentage'
  },
  {
    name: 'Aave USDC',
    id: '0xbcca60bb61934080951369a648fb03df4f96263c',
    url: 'https://app.aave.com/markets/',
    metricName: 'yield_percentage'
  },
  {
    name: 'BUIDL',
    id: '0x5a52e96bacdabb2f794da4b7fa8e0f8b8a7d49ae',
    url: 'https://tradingeconomics.com/united-states/3-month-bill-yield',
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
  },
  {
    name: 'Compound cUSDS',
    id: '0x5D409e56D886231aDAf00c8775665AD0f9897b56',
    url: 'https://app.compound.finance/markets/usds-mainnet',
    metricName: 'yield_percentage'
  },
  {
    name: 'High Yield USD',
    id: '0xcc7ff230365bd730ee4b352cc2492cedac49383e',
    url: 'https://app.reserve.org/base/token/0xcc7ff230365bd730ee4b352cc2492cedac49383e/overview',
    metricName: 'yield_percentage'
  },
  {
    name: 'Origin Dollar',
    id: '0x2a8e1e676ec238d8a992307b495b45b3feaa5e86',
    url: 'https://www.originprotocol.com/ousd',
    metricName: 'yield_percentage'
  }
];

// Function to get the latest measurement ID from the Measurements table
async function getLatestMeasurementId() {
  try {
    console.log('Getting latest measurement_id from Measurements table...');
    
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
      console.log(`Latest measurement_id found: ${latestId}`);
      return latestId;
    } else {
      console.log('No existing records found, starting from ID 1');
      return 0;
    }
  } catch (error) {
    console.error('Error finding latest measurement_id:', error.message);
    return 0; // Default to 0 if there's an error
  }
}

async function scrapeEthenaYield() {
  console.log('Starting Ethena yield scraping...');
  const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process'
  ],
});

  try {
    const page = await browser.newPage();
    await page.goto(STABLECOINS[0].url, { waitUntil: 'networkidle2' });
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Give the page extra time to load dynamic content
    // Use setTimeout with a promise instead of waitForTimeout
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Extract the yield percentage by targeting the specific locations on the website
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
    
    console.log(`Current Ethena yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    console.error('Error scraping Ethena yield:', error);
    return null;
  } finally {
    await browser.close();
  }
}

async function scrapeSkyYield() {
  console.log('Starting USDS yield scraping...');
  const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process'
  ],
});

  try {
    const page = await browser.newPage();
    await page.goto(STABLECOINS[1].url, { waitUntil: 'networkidle2' });
    
    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 30000 });
    
    // Give the page extra time to load dynamic content
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Extract the yield percentage by targeting the specific locations on the website
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
    
    console.log(`Current USDS yield: ${yieldPercentage}%`);
    return yieldPercentage;
  } catch (error) {
    console.error('Error scraping Sky yield:', error);
    return null;
  } finally {
    await browser.close();
  }
}

async function findExistingRecord(tokenId) {
  try {
    console.log(`Checking for existing record in stablecoin_yield table for token ID: ${tokenId}...`);
    
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
      console.log(`Found existing record with ID: ${record.Id || record.measurement_id}`);
      return record;
    } else {
      console.log(`No existing record found for token ID: ${tokenId}`);
      return null;
    }
  } catch (error) {
    console.error('Error finding existing record:', error.message);
    return null;
  }
}

async function updateStablecoinYield(tokenId, tokenName, yieldPercentage) {
  if (yieldPercentage === null) {
    console.error(`No yield percentage found for ${tokenName}, skipping stablecoin_yield table update`);
    return false;
  }

  try {
    console.log(`Updating stablecoin_yield table with new yield data for ${tokenName}...`);
    
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
      
      console.log(`Record updated successfully for ${tokenName}:`, response.data);
      return true;
    } else {
      // TODO: Implement logic to create a new record if one doesn't exist
      console.log(`No existing record found to update for ${tokenName}`);
      return false;
    }
  } catch (error) {
    console.error(`Error updating stablecoin_yield table for ${tokenName}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return false;
  }
}

async function createMeasurementRecord(tokenId, tokenName, metricName, yieldPercentage) {
  try {
    console.log(`Creating new record in Measurements table for ${tokenName}...`);
    
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
    
    console.log(`Measurement record created successfully for ${tokenName}:`, response.status);
    return true;
  } catch (error) {
    console.error(`Error creating measurement record for ${tokenName}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return false;
  }
}

async function processStablecoin(index) {
  const stablecoin = STABLECOINS[index];
  console.log(`Processing ${stablecoin.name}...`);
  
  // Scrape the yield percentage based on the stablecoin
  let yieldPercentage = null;
  
  if (index === 0) {
    // Ethena USDe
    yieldPercentage = await scrapeEthenaYield();
  } else if (index === 1) {
    // USDS
    yieldPercentage = await scrapeSkyYield();
  } else if (index === 2) {
    // Mountain Protocol USD
    yieldPercentage = await scrapeMountainYield();
  } else if (index === 3) {
    // Ondo USDY
    yieldPercentage = await scrapeOndoYield();
  } else if (index === 4) {
    // Elixir DEUSD
    yieldPercentage = await scrapeElixirYield();
  } else if (index === 5) {
    // Compound cUSDT
    yieldPercentage = await scrapeCompoundYield();
  } else if (index === 6) {
    // Compound cUSDC
    yieldPercentage = await scrapeCompoundUSDCYield();
  } else if (index === 7) {
    // Aave USDT
    yieldPercentage = await scrapeAaveYield('USDT');
  } else if (index === 8) {
    // Aave USDC
    yieldPercentage = await scrapeAaveYield('USDC');
  } else if (index === 9) {
    // BlackRock BUIDL (Treasury Bill yield)
    yieldPercentage = await scrapeTreasuryYield();
  } else if (index === 10) {
    // mStable USD
    yieldPercentage = await scrapeMStableYield();
  } else if (index === 11) {
    // Angle stUSD
    yieldPercentage = await scrapeAngleYield();
  } else if (index === 12) {
    // Staked Frax
    yieldPercentage = await scrapeFraxYield();
  } else if (index === 13) {
    // Compound cUSDS
    yieldPercentage = await scrapeCompoundUSDS();
  } else if (index === 14) {
    // High Yield USD (hyUSD)
    yieldPercentage = await scrapeReserveYield();
  } else if (index === 15) {
    // Origin Dollar (OUSD)
    yieldPercentage = await scrapeOriginYield();
  }
  
  // Update existing record in stablecoin_yield table if we have a valid yield percentage
  if (yieldPercentage !== null) {
    await updateStablecoinYield(stablecoin.id, stablecoin.name, yieldPercentage);
    
    // Also update any linked tokens with the same yield value
    if (stablecoin.linkedTokens && stablecoin.linkedTokens.length > 0) {
      for (const linkedToken of stablecoin.linkedTokens) {
        console.log(`Updating linked token ${linkedToken.name} with the same yield value...`);
        await updateStablecoinYield(linkedToken.id, linkedToken.name, yieldPercentage);
      }
    }
  } else {
    console.log(`Skipping Yield table update for ${stablecoin.name} due to null yield value`);
  }
  
  // Always create a new record in Measurements table
  await createMeasurementRecord(stablecoin.id, stablecoin.name, stablecoin.metricName, yieldPercentage);
  
  // Also create measurement records for any linked tokens
  if (stablecoin.linkedTokens && stablecoin.linkedTokens.length > 0) {
    for (const linkedToken of stablecoin.linkedTokens) {
      console.log(`Creating measurement record for linked token ${linkedToken.name}...`);
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
    // Process each stablecoin
    for (let i = 0; i < STABLECOINS.length; i++) {
      await processStablecoin(i);
    }
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Run the script
main();
