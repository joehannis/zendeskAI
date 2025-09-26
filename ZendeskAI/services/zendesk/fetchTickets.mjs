import zendeskApiPull from '../../utils/zendeskApiPull.mjs';
import ticketFilterLogic from '../../utils/ticketFilterLogic.mjs';
import ticketTagController from '../ai/ticketTagController.mjs';
import TPA_TPSA_OPTIONS from '../../constants/zendesk-technical-product-areas.json' with { type: 'json' };

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
        JSON.stringify(response)
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

  const noProductAreaTickets = [];

  const processTicket = async (ticket) => {
    let allCommentsBody = '';
    try {
      const response = await zendeskApiPull(
        `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets/${ticket.id}/comments.json`,
        'GET'
      );

      const commentsArray = response.comments || [];
      allCommentsBody = commentsArray.map((comment) => comment.body).join('');

      if (!allCommentsBody) {
        return null;
      }
    } catch (error) {
      return null;
    }

    let tpaTag = ticket.tags.find((tag) => tag.startsWith('tpa_'));
    let tpsaTag = ticket.tags.find((tag) => tag.startsWith('tpsa_'));

    if (!tpaTag || !tpsaTag) {
      noProductAreaTickets.push({
        id: ticket.id,
        subject: ticket.subject,
        tags: ticket.tags,
        comments: allCommentsBody,
      });
      return undefined;
    } else {
      return {
        id: ticket.id,
        subject: ticket.subject,
        tags: ticket.tags,
        comments: allCommentsBody,
        tpa: tpaTag,
        tpsa: tpsaTag,
      };
    }
  };

  const batchSize = 500;

  const ticketsWithComments = [];
  const totalBatches = Math.ceil(filteredTickets.length / batchSize);

  console.log(
    `Starting to process ${filteredTickets.length} tickets in batches of ${batchSize}. Total batches: ${totalBatches}`
  );

  for (let i = 0; i < filteredTickets.length; i += batchSize) {
    const currentBatchIndex = Math.floor(i / batchSize) + 1;
    const batch = filteredTickets.slice(i, i + batchSize);

    console.log(
      `Processing batch ${currentBatchIndex}/${totalBatches} (${batch.length} tickets)...`
    );

    // Create an array of promises for the current batch
    const batchPromises = batch.map((ticket) => processTicket(ticket));

    // Await all promises in the current batch concurrently
    const batchResults = await Promise.all(batchPromises);

    ticketsWithComments.push(...batchResults.filter((ticket) => ticket));

    console.log(
      `Batch ${currentBatchIndex}/${totalBatches} completed. Tickets with correct product areas found: ${ticketsWithComments.length} of ${filteredTickets.length} total tickets.`
    );

    const delayBetweenBatchesMs = 15000;

    // If it's not the last batch, introduce a delay to prevent hitting rate limits
    if (currentBatchIndex < totalBatches && delayBetweenBatchesMs > 0) {
      console.log(
        `Pausing for ${
          delayBetweenBatchesMs / 1000
        } seconds before next batch...`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, delayBetweenBatchesMs)
      );
    }
  }

  console.log(
    `\nAdding Product Areas to ${noProductAreaTickets.length} tickets with no TPA/TPSA tags...`
  );

  const sortedTickets = await ticketTagController(noProductAreaTickets);

  const updatedTickets = sortedTickets
    .filter((ticket) => {
      const hasMatch = noProductAreaTickets.some((t) => t.id === ticket.id);
      return hasMatch;
    })
    .map((ticket) => {
      const originalTicket = noProductAreaTickets.find(
        (t) => t.id === ticket.id
      );
      return Object.assign(ticket, {
        subject: originalTicket.subject,
        tags: originalTicket.tags,
        comments: originalTicket.comments,
      });
    });

  ticketsWithComments.push(...updatedTickets);

  const groupedTickets = {};

  ticketsWithComments.forEach((ticket) => {
    const { tpa, tpsa } = ticket;

    if (!tpa || !tpsa || tpa === 'none' || tpsa === 'none') return;

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

  

  return {
    groupedTickets,
  };
};

export default fetchTickets;
