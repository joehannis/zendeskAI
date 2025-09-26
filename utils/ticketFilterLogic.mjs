import { getUtcStartOfDay, getUtcEndOfDay } from '../utils/dateProcessing.mjs';

const spamTags = [
  'intent__misc__not_received__email_delivery_failed',
  'intent__misc__unsolicited__marketing_or_newsletter',
  'intent__misc__unsolicited__partnership',
  'intent__misc__previous_message__check',
  'intent__misc__received__shareable_file_link',
  'intent__misc__unsolicited__event_invitation',
  'intent__billing__balance__wrong_account_balance',
  'intent__billing__documentation__statement_report',
  'intent__billing__invoice__request',
  'intent__billing__price_clarification__info_included_in_price',
  'intent__billing__price_clarification__which_price',
  'intent__billing__subscription_cancel__request',
  'intent__billing__subscription_update__downgrade',
  'intent__misc__job_application__new',
  'intent__order__new__quote_request',
  'intent__service__appointment__new',
  'intent__misc__thanks__thanks',
  'intent__account__invitation__user_invitation',
  'spam',
  'intent__software__security__detected_flaw',
];

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
      const isNotSpam = !spamTags.some((tag) => ticket.tags.includes(tag));
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
        isNotSpam &&
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
      const isNotSpam = !spamTags.some((tag) => ticket.tags.includes(tag));
      const ticketCreationDateUTC = new Date(ticket.created_at);

      const passesStartDateFilter =
        !effectiveStartDateUTC ||
        ticketCreationDateUTC >= effectiveStartDateUTC;
      const passesEndDateFilter =
        !effectiveEndDateUTC || ticketCreationDateUTC <= effectiveEndDateUTC;
      return (
        isTspaMatch &&
        isNotAdopt &&
        isNotSpam &&
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
      const isNotSpam = !spamTags.some((tag) => ticket.tags.includes(tag));
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
        isNotSpam &&
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
