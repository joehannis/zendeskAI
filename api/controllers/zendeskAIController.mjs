import path from 'path';
import dotenv from 'dotenv';
import docsRagInjest from '../../services/zendesk/docsRagInjest.mjs';
import fetchTickets from '../../services/zendesk/fetchTickets.mjs';
import exportTickets from '../../utils/exportTickets.mjs';
import fetchDocs from '../../services/zendesk/fetchDocs.mjs';
import fetchArticles from '../../services/zendesk/fetchArticles.mjs';
import postArticle from '../../services/zendesk/postArticle.mjs';
import articleVectorSearch from '../../services/ai/articleVectorSearch.mjs';

const __filename = process.argv[1];

const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const zendeskAIController = async (config, oauth2Client = null) => {
  if (config.docsProcess || config.reprocessAllDocs) {
    console.log(
      `Processing Knowledge Base Documents for ${
        config.tpa ? config.tpa : 'all product areas'
      }`
    );
    const count = await docsRagInjest(config);
    return {
      message: 'success',
      articles: `Exported ${count} articles for ${config.tpa}`,
    };
  } else {
    try {
      console.log('processing');

      console.log(
        `Pulling Zendesk Tickets from ${new Date(config.startDate)} ${
          config.endDate ? `to ${new Date(config.endDate)}` : ''
        } and passing to ${
          config.selectedAI.charAt(0).toUpperCase() + config.selectedAI.slice(1)
        } ${config.tpsa ? `using filter ${config.tpsa}` : ''} ${
          config.tpa ? `using filter ${config.tpa}` : ''
        }`
      );

      const pulledTickets = await fetchTickets(config);

      if (config.exportTickets) {
        await exportTickets(pulledTickets, config, oauth2Client);
        return { message: 'success', tickets: pulledTickets.length };
      }

      const ticketsAndDocs = await fetchDocs(pulledTickets);

      let generatedArticles = await fetchArticles(
        ticketsAndDocs.groupedTickets
      );

      let allArticles = [];

      for (const [tpaKey, tpaValue] of Object.entries(generatedArticles)) {
        for (const [tpsaKey, tpsa] of Object.entries(tpaValue.tpsas)) {
          allArticles.push(...tpsa.articles.flat(Infinity));
        }
      }

      allArticles = allArticles.flat(Infinity);

      const finalArticles = await articleVectorSearch(allArticles);

      await postArticle(finalArticles);

      return { message: 'success', articles: finalArticles.length };
    } catch (error) {
      return {
        message: 'An internal server error occurred',
        error: JSON.stringify(error.message),
      };
    }
  }
};

export default zendeskAIController;
