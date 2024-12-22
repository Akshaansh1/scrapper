const puppeteer = require('puppeteer');
const fs = require('fs');

async function blinkitSearch() {
  const cookiesFilePath = 'blinkit_cookies.json'; // File to store session cookies
  const blinkitUrl = 'https://blinkit.com';

  // Launch Puppeteer
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Step 1: Check if cookies exist to resume session
    if (fs.existsSync(cookiesFilePath)) {
      const cookies = JSON.parse(fs.readFileSync(cookiesFilePath, 'utf-8'));
      if (cookies.length) {
        await page.setCookie(...cookies);
        console.log('Session cookies loaded. Attempting to resume session...');
      }
    }

    // Open Blinkit's homepage
    await page.goto(blinkitUrl, { waitUntil: 'networkidle2' });

    // Step 2: Click on the animation wrapper to activate search
    console.log('Clicking the animation wrapper to activate the search box...');
    await page.waitForSelector('.SearchBar__AnimationWrapper-sc-16lps2d-1', { visible: true });
    await page.click('.SearchBar__AnimationWrapper-sc-16lps2d-1');

    // Step 3: Perform search
    console.log('Navigating to the search box...');
    await page.waitForSelector('.SearchBarContainer__Input-sc-hl8pft-3', { visible: true });
    const searchQuery = await askUser('Enter the item to search (e.g., "atta dal"): ');
    await page.type('.SearchBarContainer__Input-sc-hl8pft-3', searchQuery);
    await page.keyboard.press('Enter');

    // Step 4: Wait for results
    console.log('Waiting for search results...');
    await page.waitForSelector('[data-pf="reset"] .tw-text-300', { visible: true });

    // Step 5: Extract item details dynamically
    console.log('Extracting search results dynamically...');
    let results = [];
    let seenItems = new Set();

    while (true) {
      const itemsOnPage = await page.evaluate(() => {
        const results = [];
        const itemElements = document.querySelectorAll('[data-pf="reset"]');

        itemElements.forEach((item) => {
          try {
            const name = item.querySelector('.tw-text-300')?.innerText?.trim();
            const quantity = item.querySelector('.tw-text-200')?.innerText?.trim();
            const price = item.querySelector('.tw-text-200.tw-font-semibold')?.innerText?.trim();

            if (name && name.toUpperCase() !== "ADD" && quantity && price) {
              results.push({ Name: name, Quantity: quantity, Price: price });
            }
          } catch (error) {
            console.error('Error extracting item details:', error);
          }
        });

        return results;
      });

      // Add new items to results, avoiding duplicates
      itemsOnPage.forEach((item) => {
        if (!seenItems.has(item.Name)) {
          seenItems.add(item.Name);
          results.push(item);
        }
      });

      // Check for a "Load More" button and click it
      const loadMoreButton = await page.$('button[aria-label="Load more"]');
      if (loadMoreButton) {
        console.log('Loading more results...');
        await loadMoreButton.click();
        await page.waitForTimeout(2000); // Wait for new results to load
      } else {
        break; // Exit loop if no more results
      }
    }

    // Step 6: Display the results
    if (results.length === 0) {
      console.log(`No results found for "${searchQuery}".`);
    } else {
      console.log(`All unique results for "${searchQuery}":`);
      console.log(JSON.stringify(results, null, 2)); // Pretty print the results as JSON
    }

    return results; // Return the results as an array of objects
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

// Helper function to ask the user for input
function askUser(question) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

// Run the script
blinkitSearch();
