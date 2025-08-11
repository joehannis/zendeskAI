import fs from 'fs';
import path from 'path';
import { stringify } from 'csv-stringify';

const __filename = process.argv[1];
const __dirname = path.dirname(__filename);

const exportTickets = async (ticketsObj) => {
  const outputFilePath = path.join(
    __dirname,
    `../../database/csvExports/${
      ticketsObj[0].tpa ? ticketsObj[0].tpa : ticketsObj[0].tpsa
    }.csv`
  );
  console.log(ticketsObj);
  if (!ticketsObj[0].tickets || ticketsObj[0].tickets.length === 0) {
    console.log('No data to convert to CSV.');
    return;
  }
  const csvData = ticketsObj[0].tickets.map((item) => {
    const scrapedUrl = `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/agent/tickets/${item.id}`;
    const row = { id: item.id, url: scrapedUrl };
    return row;
  });

  stringify(csvData, { header: true }, (err, output) => {
    if (err) {
      console.error('Error converting to CSV:', err);
    } else {
      fs.writeFileSync(outputFilePath, output);
      console.log(`CSV data written to ${outputFilePath}`);
    }
  });
};

export default exportTickets;
