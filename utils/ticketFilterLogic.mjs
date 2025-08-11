import { getUtcStartOfDay, getUtcEndOfDay } from '../utils/dateProcessing.mjs';

const ticketFilterLogic = (config, allRawTickets) => {
  const tpaFilter = config.tpa;
  const tpsaFilter = config.tpsa;
  const effectiveStartDateUTC = getUtcStartOfDay(config.startDate);
  const effectiveEndDateUTC = getUtcEndOfDay(config.endDate);

  if (tpaFilter) {
    const filteredTickets = allRawTickets.filter((ticket) => {
      const isTpaMatch = ticket.tags.includes(tpaFilter);
      const isNotJiraEscalated = config.exportTickets
        ? true
        : !ticket.tags.includes('jira_escalated');
      const isNotAdopt = !ticket.tags.includes('tpa_adopt');
      const ticketCreationDateUTC = new Date(ticket.created_at);

      //convert time stamps for date filtering
      const passesStartDateFilter =
        !effectiveStartDateUTC ||
        ticketCreationDateUTC >= effectiveStartDateUTC;
      const passesEndDateFilter =
        !effectiveEndDateUTC || ticketCreationDateUTC <= effectiveEndDateUTC;
      return (
        isTpaMatch &&
        isNotAdopt &&
        isNotJiraEscalated &&
        passesStartDateFilter &&
        passesEndDateFilter
      );
    });

    if (filteredTickets.length > 0) {
      console.log(`Total tickets after filtering: ${filteredTickets.length}`);
      return filteredTickets;
    }
  } else if (tpsaFilter) {
    const filteredTickets = allRawTickets.filter((ticket) => {
      const isTspaMatch = ticket.tags.includes(tpsaFilter);
      const isNotJiraEscalated =
        config.exportTickets || config.includeJira
          ? true
          : !ticket.tags.includes('jira_escalated');
      const isNotAdopt = !ticket.tags.includes('tpa_adopt');
      const ticketCreationDateUTC = new Date(ticket.created_at);

      const passesStartDateFilter =
        !effectiveStartDateUTC ||
        ticketCreationDateUTC >= effectiveStartDateUTC;
      const passesEndDateFilter =
        !effectiveEndDateUTC || ticketCreationDateUTC <= effectiveEndDateUTC;
      return (
        isTspaMatch &&
        isNotAdopt &&
        isNotJiraEscalated &&
        passesStartDateFilter &&
        passesEndDateFilter
      );
    });

    if (filteredTickets.length > 0) {
      console.log(`Total tickets after filtering: ${filteredTickets.length}`);
      return filteredTickets;
    }
  } else {
    const filteredTickets = allRawTickets.filter((ticket) => {
      const isNotJiraEscalated = config.exportTickets
        ? true
        : !ticket.tags.includes('jira_escalated');
      const isNotAdopt = !ticket.tags.includes('tpa_adopt');
      const ticketCreationDateUTC = new Date(ticket.created_at);
      const passesStartDateFilter =
        !effectiveStartDateUTC ||
        ticketCreationDateUTC >= effectiveStartDateUTC;
      const passesEndDateFilter =
        !effectiveEndDateUTC || ticketCreationDateUTC <= effectiveEndDateUTC;
      return (
        isNotJiraEscalated &&
        isNotAdopt &&
        passesStartDateFilter &&
        passesEndDateFilter
      );
    });
    if (filteredTickets.length > 0) {
      console.log(`Total tickets after filtering: ${filteredTickets.length}`);
      return filteredTickets;
    }
  }
};

export default ticketFilterLogic;
