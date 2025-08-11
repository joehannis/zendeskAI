import { fetchArticlesFromFirestore } from '../database/firestore/firestoreManager.mjs';
import zendeskApiPull from './zendeskApiPull.mjs';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const __filename = process.argv[1];
const __dirname = path.dirname(__filename);
async function convertHtmlToPdf(page, htmlString, outputPath) {
  try {
    await page.setContent(htmlString, { waitUntil: 'networkidle0' });

    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1in',
        right: '1in',
        bottom: '1in',
        left: '1in',
      },
    });

    console.log(`PDF created successfully at ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`Error converting HTML to PDF for ${outputPath}:`, error);
    return false;
  }
}

const fetchZendeskArticlesForReview = async (tpa) => {
  let browser; // Declare browser here, it will be initialized later

  try {
    // This outer try-catch-finally block ensures the browser is always closed
    const firestoreArticles = await fetchArticlesFromFirestore(tpa);

    if (!firestoreArticles || firestoreArticles.length === 0) {
      console.log(`No articles found in Firestore for TPA: ${tpa}`);
      return;
    }

    const articleBatchSize = 50; // For fetching from Zendesk
    const pdfConcurrency = 5; // How many PDFs to generate concurrently (renamed from pdfBatchSize for clarity)

    // Step 1: Fetch detailed article content from Zendesk
    console.log('Fetching detailed articles from Zendesk...');
    const detailedArticles = [];
    for (let i = 0; i < firestoreArticles.length; i += articleBatchSize) {
      const batch = firestoreArticles.slice(i, i + articleBatchSize);
      console.log(
        `Fetching Zendesk batch ${
          Math.floor(i / articleBatchSize) + 1
        }/${Math.ceil(firestoreArticles.length / articleBatchSize)} (${
          batch.length
        } articles)...`
      );

      const batchPromises = batch.map(async (article) => {
        try {
          const zendeskResponse = await zendeskApiPull(
            `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/help_center/articles/${article.zendeskId}`,
            'GET'
          );
          if (zendeskResponse && zendeskResponse.article) {
            return zendeskResponse.article;
          }
          console.warn(
            `Zendesk API did not return an article for ID: ${article.zendeskId}`
          );
          return null;
        } catch (pullError) {
          console.error(
            `Error pulling article ${article.zendeskId} from Zendesk:`,
            pullError
          );
          return null;
        }
      });
      const results = await Promise.all(batchPromises);
      detailedArticles.push(...results.filter((article) => article !== null));
    }

    if (detailedArticles.length === 0) {
      console.log('No detailed articles successfully fetched from Zendesk.');
      return;
    }

    // Ensure output directory exists
    const exportDirPath = path.resolve(
      __dirname,
      `../../exportedArticles/${tpa}`
    );

    // CORRECTED: mkdirSync syntax and recursive option
    if (!fs.existsSync(exportDirPath)) {
      console.log(`Creating directory: ${exportDirPath}`);
      fs.mkdirSync(exportDirPath, { recursive: true });
    } else {
      console.log(`Directory already exists: ${exportDirPath}`);
    }

    // Step 2: Generate PDFs using a single browser instance and controlled concurrency
    console.log('Starting PDF generation...');
    browser = await puppeteer.launch(); // Launch browser ONCE here
    let successfulPdfCount = 0;
    const pdfPromises = []; // Array to hold ongoing PDF generation promises

    for (const article of detailedArticles) {
      const outputPath = path.resolve(exportDirPath, `${article.title}.pdf`);

      // CORRECTED LOGIC: Check if PDF exists. If it does, skip this article.
      if (fs.existsSync(outputPath)) {
        console.log(`PDF already exists for "${article.title}", skipping.`);
        continue; // Skip to the next article in the loop
      }

      // If we reach here, the file does NOT exist, so queue its creation
      console.log(`Queueing PDF generation for "${article.title}"...`);
      pdfPromises.push(
        (async () => {
          const page = await browser.newPage(); // Create a new page for each PDF
          try {
            const success = await convertHtmlToPdf(
              page,
              `<h1>${article.title}</h1> \n\n ${article.body}`,
              outputPath
            );
            if (success) {
              successfulPdfCount++;
            }
          } catch (pdfGenError) {
            console.error(
              `Failed to generate PDF for "${article.title}":`,
              pdfGenError
            );
          } finally {
            await page.close(); // Always close the page to free up resources
          }
        })()
      );

      // If we've queued enough concurrent PDF generations, wait for them to finish
      if (pdfPromises.length >= pdfConcurrency) {
        console.log(
          `Awaiting ${pdfPromises.length} concurrent PDF generations...`
        );
        await Promise.all(pdfPromises);
        pdfPromises.length = 0; // Clear the array for the next batch of promises
      }
    }

    // After the loop, await any remaining PDF generation promises that were queued
    if (pdfPromises.length > 0) {
      console.log(
        `Awaiting remaining ${pdfPromises.length} PDF generations...`
      );
      await Promise.all(pdfPromises);
    }

    console.log(`Successfully exported ${successfulPdfCount} articles to PDF.`);
    return successfulPdfCount;
  } catch (error) {
    // This catches any errors from fetching articles, launching browser, etc.
    console.error(
      'An unhandled error occurred during article processing:',
      error
    );
  } finally {
    // This ensures the browser is always closed, even if an error occurs
    if (browser) {
      await browser.close();
      console.log('Puppeteer browser closed.');
    }
  }
};

export default fetchZendeskArticlesForReview;
