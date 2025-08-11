import path from 'path';
import dotenv from 'dotenv';
import * as math from 'mathjs';

const __filename = process.argv[1];
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function cosineSimilarity(vec1, vec2) {
  if (math.norm(vec1) === 0 || math.norm(vec2) === 0) {
    return 0; // Handle zero vectors to prevent division by zero
  }
  const dot = math.dot(vec1, vec2);
  const normA = math.norm(vec1);
  const normB = math.norm(vec2);
  return dot / (normA * normB);
}

const threshold = 0.85;

const articleCompare = async (articles) => {
  const uniqueFullObjects = [];

  if (!articles || articles.length === 0) {
    return uniqueFullObjects;
  }

  if (articles[0] && articles[0].semanticEmbedding) {
    uniqueFullObjects.push(articles[0]);
    console.log(
      `Added first article as unique: "${articles[0]['Knowledge Base Article']?.question}"`
    );
  } else {
    console.warn(
      "First article is missing 'embedding' or is invalid. Skipping initial article."
    );

    return uniqueFullObjects;
  }

  for (let i = 1; i < articles.length; i++) {
    const currentArticle = articles[i];
    if (!currentArticle || !currentArticle.semanticEmbedding) {
      console.warn(
        `Skipping article at index ${i} due to missing embedding or invalid object.`
      );
      continue;
    }

    const currentEmbedding = currentArticle.semanticEmbedding;

    let isDuplicate = false;
    let bestMatchScore = 0;
    let duplicateOfArticle = null;

    for (const uniqueObj of uniqueFullObjects) {
      if (!uniqueObj || !uniqueObj.semanticEmbedding) {
        console.warn(
          "Found a uniqueObj without an embedding. This shouldn't happen if previous steps worked. Skipping comparison for this uniqueObj."
        );
        continue;
      }

      const uniqueEmbedding = uniqueObj.semanticEmbedding;

      const sim = cosineSimilarity(currentEmbedding, uniqueEmbedding);

      if (sim >= threshold) {
        isDuplicate = true;
        bestMatchScore = sim;
        duplicateOfArticle = uniqueObj;

        const currentArticleTicketIds = Array.isArray(
          currentArticle['Ticket IDs']
        )
          ? currentArticle['Ticket IDs']
          : [];
        const uniqueObjTicketIds = Array.isArray(uniqueObj['Ticket IDs'])
          ? uniqueObj['Ticket IDs']
          : [];

        const uniqueObjTicketIdSet = new Set(uniqueObjTicketIds);

        const newTicketIdsToAdd = currentArticleTicketIds.filter(
          (ticketId) => !uniqueObjTicketIdSet.has(ticketId)
        );
        if (newTicketIdsToAdd.length > 0) {
          uniqueObj['Ticket IDs'] = [
            ...uniqueObjTicketIds,
            ...newTicketIdsToAdd,
          ];
          console.log(uniqueObj['Ticket IDs']);
          console.log(
            `Added new Ticket IDs to duplicate article: ${newTicketIdsToAdd.join(
              ', '
            )}`
          );
        }

        break;
      }
    }

    if (!isDuplicate) {
      uniqueFullObjects.push(currentArticle);
      console.log(
        `Added unique article: Q: ${currentArticle['Knowledge Base Article']?.question} A: ${currentArticle['Knowledge Base Article']?.question}`
      );
    } else {
      console.log(
        `Skipping duplicate article: "${
          currentArticle['Knowledge Base Article']?.question
        }" (Duplicate of "${
          duplicateOfArticle['Knowledge Base Article']?.question
        }" with score: ${bestMatchScore.toFixed(3)})`
      );
    }
  }

  return uniqueFullObjects;
};

export default articleCompare;
