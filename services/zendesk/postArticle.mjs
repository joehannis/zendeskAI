import path from 'path';
import dotenv from 'dotenv';
import { addArticleToFirestore } from '../../database/firestore/firestoreManager.mjs';
import { processHierarchically } from '../../utils/ragProcessing.mjs';

const __filename = process.argv[1];
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const postArticle = async (ai, articles) => {
  const authHeader = `Basic ${Buffer.from(
    `${process.env.ZENDESK_EMAIL}/token:${process.env.ZENDESK_API_KEY}`
  ).toString('base64')}`;

  for (const singleKbArticle of articles) {
    if (
      singleKbArticle &&
      singleKbArticle['Knowledge Base Article'] &&
      singleKbArticle['Knowledge Base Article'].question &&
      singleKbArticle['Knowledge Base Article'].answer
    ) {
      const processedArticle = await processHierarchically(
        ai,
        singleKbArticle,
        'article'
      );

      const zendeskArticleBody = JSON.stringify({
        article: {
          body: `${singleKbArticle['Knowledge Base Article']['answer']}`,
          locale: 'en-us',
          permission_group_id: 219632,
          title: `${singleKbArticle['Knowledge Base Article']['question']}`,
          user_segment_id: 37856855061147,
          draft: false,
          comments_disabled: true,
          label_names: [
            'botTroubleshootingArticle',
            `${singleKbArticle.tpa}`,
            `${singleKbArticle.tpsa}`,
          ],
        },
        notify_subscribers: false,
      });
      const response = await fetch(
        `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/help_center/sections/37902903476379/articles`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: zendeskArticleBody,
        }
      );
      if (!response.ok) {
        const errorBody = await response.json();
        console.error(
          `Error posting article to ${url}:`,
          response.status,
          errorBody
        );
        const error = new Error(
          `Zendesk API request failed with status ${response.status}`
        );
        error.statusCode = response.status;
        error.details = errorBody;
        throw error;
      }
      const zendeskData = await response.json();
      console.log(
        `Added to Zendesk question: ${singleKbArticle['Knowledge Base Article']['question']}`
      );
      try {
        await addArticleToFirestore(
          processedArticle,
          zendeskData.article.id.toString(),
          singleKbArticle
        );
      } catch (error) {
        console.error(
          'An error occurred during the addArticleToDatastore process:',
          error
        );
      }
    }
  }
  console.log(`Complete. Added ${articles.length} articles`);
};

export default postArticle;
