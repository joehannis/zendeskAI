import zendeskApiPull from '../../utils/zendeskApiPull.mjs';
import ticketFilterLogic from '../../utils/ticketFilterLogic.mjs';
import TPA_TPSA_OPTIONS from '../../constants/zendesk-technical-product-areas.json' with { type: 'json' };
import fs from 'fs'

const fetchTickets = async (config) => {
  const startDateObj = new Date(config.startDate);
  const zendeskStartTimeSeconds = Math.floor(startDateObj.getTime() / 1000);
  const tpsaKeys = [];

  TPA_TPSA_OPTIONS.forEach((obj) => {
    obj['custom_field_options'].forEach((option) => {
      let newObj = {};
      newObj['tpa'] = obj['tpa'];
      newObj['tpsa'] = option['value'];
      newObj['sections'] = obj['sections'];
      tpsaKeys.push(newObj);
    });
  });

  const allRawTickets = [];

  let currentApiUrl = `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/incremental/tickets/cursor.json?start_time=${zendeskStartTimeSeconds}`;

  console.log('Pulling from Zendesk.....');

  while (currentApiUrl) {
    const response = await zendeskApiPull(currentApiUrl, 'GET');

    if (response && response.tickets) {
      allRawTickets.push(...response.tickets);
    } else {
      console.error(
        'Error: Unexpected response structure or no tickets found.',
        response
      );
      break; // Exit loop if response is malformed
    }

    // Use after_url for pagination
    currentApiUrl = response.after_url;
    if (response.end_of_stream) {
      currentApiUrl = null;
    }
  }

  console.log(
    `Finished pulling all raw tickets. Total: ${allRawTickets.length}`
  );

  const filteredTickets = ticketFilterLogic(config, allRawTickets);


  console.log('Pulling ticket comments...');


  const processTicket = async (ticket) => {
    try {
      const response = await zendeskApiPull(
        `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets/${ticket.id}/comments.json`,
        'GET'
      );

  
      const commentsArray = response.comments || [];
      const allCommentsBody = commentsArray.map(comment => comment.body).join('');

      const tpaTag = ticket.tags.find((tag) => tag.startsWith('tpa_'));
      const tpsaTag = ticket.tags.find((tag) => tag.startsWith('tpsa_'));

      return {
        id: ticket.id,
        subject: ticket.subject,
        tags: ticket.tags,
        comments: allCommentsBody,
        tpa: tpaTag,
        tpsa: tpsaTag,
      };
    } catch (error) {
      console.error(`Failed to fetch comments for ticket ID ${ticket.id}:`, error.message);
      // Return null or an object indicating failure if you want to filter these out later
      // Or re-throw if you want Promise.all to fail fast
      return null; // Or { id: ticket.id, error: error.message }
    }
  }
  

  const batchSize=500

  const ticketsWithComments = [];
  const totalBatches = Math.ceil(filteredTickets.length / batchSize);

  console.log(`Starting to process ${filteredTickets.length} tickets in batches of ${batchSize}. Total batches: ${totalBatches}`);

  for (let i = 0; i < filteredTickets.length; i += batchSize) {
    const currentBatchIndex = Math.floor(i / batchSize) + 1;
    const batch = filteredTickets.slice(i, i + batchSize);

    console.log(`Processing batch ${currentBatchIndex}/${totalBatches} (${batch.length} tickets)...`);

    // Create an array of promises for the current batch
    const batchPromises = batch.map(ticket => processTicket(ticket));

    // Await all promises in the current batch concurrently
    const batchResults = await Promise.all(batchPromises);

    // Add successful results to the main array, filtering out nulls from failed calls
    ticketsWithComments.push(...batchResults.filter(ticket => ticket !== null));

    console.log(`Batch ${currentBatchIndex}/${totalBatches} completed. Total processed so far: ${ticketsWithComments.length}`);

    const delayBetweenBatchesMs = 15000

    // If it's not the last batch, introduce a delay to prevent hitting rate limits
    if (currentBatchIndex < totalBatches && delayBetweenBatchesMs > 0) {
      console.log(`Pausing for ${delayBetweenBatchesMs / 1000} seconds before next batch...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatchesMs));
    }
  }

  console.log(`Finished processing all tickets. Successfully processed ${ticketsWithComments.length} tickets with comments.`);
  if (filteredTickets.length - ticketsWithComments.length > 0) {
    console.warn(`${filteredTickets.length - ticketsWithComments.length} tickets failed to fetch comments across all batches.`);
  }


  const groupedTickets = {};

  ticketsWithComments.forEach((ticket) => {
    const { tpa, tpsa } = ticket;

    if (!tpa || !tpsa) return;


    if (!groupedTickets[tpa]) {
      groupedTickets[tpa] = { tpsas: {} };
    }

    if (!groupedTickets[tpa].tpsas[tpsa]) {
      groupedTickets[tpa].tpsas[tpsa] = {};
    }
    
    if (!groupedTickets[tpa].tpsas[tpsa].tickets) {
      groupedTickets[tpa].tpsas[tpsa].tickets = [];
    }

    groupedTickets[tpa].tpsas[tpsa].tickets.push(ticket);
  });

  Object.entries(groupedTickets).forEach(([tpaKey, tpsaGroup]) => {
    const tpaObj = tpsaKeys.find((obj) => obj.tpa === tpaKey);
  
    if (tpaObj && tpaObj.sections) {
      tpsaGroup.sections = tpaObj.sections;
    } else {
      tpsaGroup.sections = []; // fallback or default
    }
  });
  
  const filePath = '../../tickets.json'
  const jsonString = JSON.stringify(groupedTickets, null, 2);

  fs.writeFile(filePath, jsonString, (err) => {
    if (err) {
      console.error('Error writing file:', err);
    } else {
      console.log(`JSON data successfully written to ${filePath}`);
    }
  })
  return {
    groupedTickets
  };
}


export default fetchTickets;
