import zendeskApiPull from '../../utils/zendeskApiPull.mjs';

const fetchDocs = async (ticketsObj) => {
  console.log('Pulling documentation');

  await Promise.all(
    Object.entries(ticketsObj.groupedTickets).map(
      async ([tpaKey, tpaValue]) => {
        if (!tpaValue.sections || !Array.isArray(tpaValue.sections)) return;

        const allDocs = [];

        await Promise.all(
          tpaValue.sections.map(async (section) => {
            try {
              const docs = await zendeskApiPull(
                `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/help_center/articles/search.json?section=${section.id}`,
                'GET'
              );

              const docsArray =
                docs?.results?.map((doc) => ({
                  title: doc.title,
                  body: doc.body,
                  url: doc.html_url, // this is usually the correct Zendesk field
                })) || [];

              allDocs.push(...docsArray);
            } catch (error) {
              console.error(
                `Error fetching docs for section ${section.id}:`,
                error
              );
            }
          })
        );

        tpaValue.docs = allDocs;
        console.log(`Docs for ${tpaKey}:`, allDocs.length);
      }
    )
  );

  return ticketsObj;
};

export default fetchDocs;
