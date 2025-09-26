import { stringify } from 'csv-stringify';
import { uploadToFolder } from './uploadToGoogleDrive.mjs';

const exportTickets = async (ticketsObj, config, oauth2Client) => {
  const outputFileName = `${config.startDate}-${
    config.endDate ? config.endDate : new Date().toISOString().split('T')[0]
  }.csv`;

  const ticketsObjByTpsa = ticketsObj.groupedTickets[`${config.tpa}`].tpsas;

  const csvData = Object.values(ticketsObjByTpsa).flatMap((tpsa) => {
    return (tpsa.tickets || []).map((ticket) => {
      return {
        id: ticket.id,
        tpa: ticket.tpa,
        tpsa: ticket.tpsa,
        comments: ticket.comments,
      };
    });
  });

  stringify(csvData, { header: true }, async (err, output) => {
    if (err) {
      console.error('Error converting to CSV:', JSON.stringify(err));
    } else {
      const result = await uploadToFolder(
        outputFileName,
        '0AEAcgRnsLJ2GUk9PVA',
        oauth2Client,
        config.tpa,
        'csv',
        output
      );
      return result;
    }
  });
};

export default exportTickets;
