const axios = require('axios');

// Configuration using environment variables
const config = {
  coingecko: {
    apiKey: process.env.COINGECKO_API_KEY || 'CG-VgCaCjpqRRwhkSXwRAXXeiUJ', // Fallback for local testing
    baseUrl: 'https://pro-api.coingecko.com/api/v3'
  },
  nocodb: {
    baseUrl: 'https://app.nocodb.com/api/v2',
    authToken: process.env.NOCODB_API_KEY || 'MK93fRsPqr1RTOqHtmsHCtpdkkFmQZggnEEQCDzR', // Fallback for local testing
    tableId: 'mejs8n5zkpqsly7',
    viewId: 'vwnas6ikqqsuw6yo'
  }
};

// Mapping of tickers to CoinGecko IDs
const TICKER_TO_COINGECKO_ID = {
  'USDT': 'tether-gold',
  'PAXG': 'pax-gold',
  'PYUSD': 'paypal-usd',
  'TUSD': 'true-usd',
  'USD0': 'usual',      
  'XSGD': 'xsgd',
  'LUSD': 'liquity-usd',
  'EURC': 'euro-coin',
  'GUSD': 'gemini-dollar',
  'RLUSD': 'ripple-usd'  
};

// Utility function to sleep for specified milliseconds
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch records from NocoDB
async function fetchNocoDBRecords() {
  try {
    console.log('Fetching records from NocoDB...');
    
    const response = await axios.get(
      `${config.nocodb.baseUrl}/tables/${config.nocodb.tableId}/records?offset=0&limit=25&where=&viewId=${config.nocodb.viewId}`,
      {
        headers: {
          'xc-token': config.nocodb.authToken
        }
      }
    );
    
    console.log(`Successfully fetched ${response.data.list.length} records from NocoDB`);
    return response.data.list;
  } catch (error) {
    console.error('Error fetching records from NocoDB:', error.message);
    throw error;
  }
}

// Fetch detailed data from CoinGecko for a single coin
async function fetchCoinGeckoData(coinId) {
  try {
    console.log(`Fetching data for ${coinId} from CoinGecko...`);
    
    // Add fallback logic for potentially problematic coins
    const response = await axios.get(
      `${config.coingecko.baseUrl}/coins/${coinId}`,
      {
        params: {
          localization: false,
          tickers: false,
          market_data: true,
          community_data: false,
          developer_data: false
        },
        headers: {
          'accept': 'application/json',
          'x-cg-pro-api-key': config.coingecko.apiKey
        }
      }
    ).catch(async (error) => {
      // If the direct endpoint fails, try a fallback approach
      console.log(`Fallback: Using markets endpoint for ${coinId}...`);
      const marketsResponse = await axios.get(
        `${config.coingecko.baseUrl}/coins/markets`,
        {
          params: {
            vs_currency: 'usd',
            ids: coinId,
            order: 'market_cap_desc',
            per_page: 1,
            page: 1,
            sparkline: false,
            price_change_percentage: '7d'
          },
          headers: {
            'accept': 'application/json',
            'x-cg-pro-api-key': config.coingecko.apiKey
          }
        }
      );
      
      if (marketsResponse.data && marketsResponse.data.length > 0) {
        return { data: {
          market_data: {
            total_volume: { usd: marketsResponse.data[0].total_volume },
            market_cap_change_percentage_7d: marketsResponse.data[0].price_change_percentage_7d,
            market_cap_change_percentage_7d_in_currency: { 
              usd: marketsResponse.data[0].price_change_percentage_7d_in_currency
            },
            price_change_percentage_7d: marketsResponse.data[0].price_change_percentage_7d,
            price_change_percentage_7d_in_currency: {
              usd: marketsResponse.data[0].price_change_percentage_7d_in_currency
            }
          }
        }};
      }
      
      // If still nothing, try search
      console.log(`Second fallback: Using search for ${coinId}...`);
      const searchResponse = await axios.get(
        `${config.coingecko.baseUrl}/search`,
        {
          params: {
            query: coinId.replace(/-/g, ' ')
          },
          headers: {
            'accept': 'application/json',
            'x-cg-pro-api-key': config.coingecko.apiKey
          }
        }
      );
      
      if (searchResponse.data && 
          searchResponse.data.coins && 
          searchResponse.data.coins.length > 0) {
        // Get the first result's ID and try again with that ID
        const newId = searchResponse.data.coins[0].id;
        console.log(`Found alternative ID: ${newId} for ${coinId}`);
        if (newId !== coinId) {
          return fetchCoinGeckoData(newId); // Try with the new ID
        }
      }
      
      throw error; // Re-throw if all fallbacks fail
    });
    
    // Extract data, checking multiple possible fields for 7-day market cap change
    const volume24h = response.data.market_data.total_volume?.usd || null;
    
    // First try market_cap_change_percentage_7d field
    let marketCapChange7d = response.data.market_data.market_cap_change_percentage_7d;
    
    // If that's null, try market_cap_change_percentage_7d_in_currency.usd
    if (marketCapChange7d === null || marketCapChange7d === undefined) {
      marketCapChange7d = response.data.market_data.market_cap_change_percentage_7d_in_currency?.usd;
    }
    
    // If still null, fall back to price_change_percentage_7d as an approximation
    if (marketCapChange7d === null || marketCapChange7d === undefined) {
      marketCapChange7d = response.data.market_data.price_change_percentage_7d;
    }
    
    // If still null, try price_change_percentage_7d_in_currency.usd
    if (marketCapChange7d === null || marketCapChange7d === undefined) {
      marketCapChange7d = response.data.market_data.price_change_percentage_7d_in_currency?.usd;
    }
    
    return {
      volume_24h: volume24h,
      market_cap_change_7d: marketCapChange7d
    };
  } catch (error) {
    console.error(`Error fetching data for ${coinId} from CoinGecko:`, error.message);
    if (error.response && error.response.status === 429) {
      console.log('Rate limit hit. Waiting 15 seconds before next attempt...');
      await sleep(15000);
      return await fetchCoinGeckoData(coinId); // Retry after waiting
    }
    return {
      volume_24h: null,
      market_cap_change_7d: null
    };
  }
}

// Format values properly for display and storage
function formatValue(value, decimals = 2) {
  if (value === null || value === undefined) return null;
  
  // Small values (like percentages) get more decimal places
  if (Math.abs(value) < 1) {
    return parseFloat(value.toFixed(4)); // Use 4 decimal places for small values
  }
  
  // Otherwise use standard decimals
  return parseFloat(value.toFixed(decimals));
}

// Get current timestamp in a readable format
function getCurrentTimestamp() {
  const now = new Date();
  return now.toISOString(); // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
}

// Alternatively, if you prefer a more human-readable format:
function getFormattedTimestamp() {
  const now = new Date();
  return now.toLocaleString(); // e.g., "3/27/2025, 2:15:30 PM"
}

// Update a record in NocoDB
async function updateNocoDBRecord(record, updateData) {
  try {
    // According to the NocoDB API docs, updates are done by sending an array of objects
    // Each object must include the ID field which is used to identify the record
    
    // Get the record ID (from your shared data it appears to be "Id" with capital I)
    if (!record.Id) {
      console.error('Record does not have Id field:', record);
      return null;
    }
    
    // Create the update object with the ID and the data to update
    const updateObject = {
      Id: record.Id,
      ...updateData
    };
    
    console.log(`Updating record ${record.Id} in NocoDB with data:`, updateData);
    
    // Send the update as an array of objects to the batch update endpoint
    const response = await axios.patch(
      `${config.nocodb.baseUrl}/tables/${config.nocodb.tableId}/records`,
      [updateObject], // Send as array (for batch update)
      {
        headers: {
          'xc-token': config.nocodb.authToken,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10-second timeout
      }
    );
    
    console.log(`Successfully updated record ${record.Id} in NocoDB`);
    return response.data;
  } catch (error) {
    console.error(`Error updating record in NocoDB:`, error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    if (error.response && error.response.status === 429) {
      console.log('Rate limit hit. Waiting 15 seconds before next attempt...');
      await sleep(15000);
      return await updateNocoDBRecord(record, updateData); // Retry after waiting
    }
    throw error;
  }
}

// Main function
async function updateTokenData() {
  try {
    // Fetch all records from NocoDB
    const records = await fetchNocoDBRecords();
    
    // Debug: Log the first record to see its structure
    if (records.length > 0) {
      console.log("First record structure:", JSON.stringify(records[0], null, 2));
    }
    
    // Get current timestamp
    const timestamp = getCurrentTimestamp();
    const formattedTimestamp = getFormattedTimestamp();
    console.log(`Update timestamp: ${formattedTimestamp}`);
    
    // Process each record
    for (const record of records) {
      const ticker = record.ticker;
      const coinId = TICKER_TO_COINGECKO_ID[ticker];
      
      if (!coinId) {
        console.warn(`No CoinGecko ID found for ticker ${ticker}, skipping`);
        continue;
      }
      
      console.log(`Fetching data for ${ticker} (${coinId})...`);
      
      // Get data from CoinGecko
      const coinData = await fetchCoinGeckoData(coinId);
      
      // Create an object to hold the update data
      const updateData = {
        // Add timestamp to every update
        'timestamp': formattedTimestamp
      };
      
      // Add 24hr_volume if available
      if (coinData.volume_24h !== null && coinData.volume_24h !== undefined) {
        updateData['24hr_volume'] = formatValue(coinData.volume_24h, 0); // Volumes usually don't need decimals
      }
      
      // Add 7day_mcap_change if available
      if (coinData.market_cap_change_7d !== null && coinData.market_cap_change_7d !== undefined) {
        updateData['7day_mcap_change'] = formatValue(coinData.market_cap_change_7d, 4);
      }
      
      // Only update if we have data to update (we always have timestamp)
      if (Object.keys(updateData).length > 1) {
        // Log the data we're about to update
        console.log(`Updating record ${record.Id} in NocoDB with data:`, updateData);
        
        // Update the record in NocoDB
        await updateNocoDBRecord(record, updateData);
        
        // Sleep to avoid rate limiting
        await sleep(1500);
      } else {
        console.warn(`No data available for ${ticker}, skipping update`);
      }
    }
    
    console.log('All records processed successfully');
  } catch (error) {
    console.error('Error in updateTokenData:', error.message);
  }
}

// Run the main function
updateTokenData();
