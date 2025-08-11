import { convertHtmlToText } from '../../utils/ragProcessing.mjs';
import { hierarchicalVectorSearch } from '../../database/firestore/firestoreManager.mjs';
import generateEmbeddings from './generateEmbeddings.mjs';
import articleCompare from './articleCompare.mjs';
import fs from 'fs';
import path from 'path';

const __filename = process.argv[1];

const __dirname = path.dirname(__filename);
const articleVectorSearch = async (ai, allArticles) => {
  await Promise.all(
    allArticles.map(async (article) => {
      const articleString = `${article['Knowledge Base Article']?.question} \n\n ${article['Knowledge Base Article']?.answer}`;
      const convertedArticle = convertHtmlToText(articleString);

      console.log(
        `Generating embedding for article: "${article['Knowledge Base Article']?.question}"`
      );
      const articleSemanticEmbedding = await generateEmbeddings(
        ai,
        convertedArticle,
        'SEMANTIC_SIMILARITY'
      );
      const articleRetrievalEmbedding = await generateEmbeddings(
        ai,
        convertedArticle,
        'RETRIEVAL_DOCUMENT'
      );
      article.semanticEmbedding = articleSemanticEmbedding;
      article.retrievalEmbedding = articleRetrievalEmbedding;
      article.fullArticleText = convertedArticle;

      return article;
    })
  );

  const comparedArticles = await articleCompare(allArticles);

  const finalArticlesPromises = comparedArticles.map(async (article) => {
    console.log('Searching for similar content in vector store...');
    console.log(article['Knowledge Base Article']?.question);

    const searchResultForPrecheck = await hierarchicalVectorSearch(
      article.semanticEmbedding,
      'semanticEmbedding',
      0.85
    );

    if (
      searchResultForPrecheck.success &&
      searchResultForPrecheck.data.length > 0
    ) {
      // If results exist above the threshold, then a similar article (chunk) already exists.
      const matchedChunk = searchResultForPrecheck.data[0];
      console.log(
        `  --> Skipping article: "${article['Knowledge Base Article'].question}"`
      );
      console.log(
        `      Reason: Found highly similar content, Distance: ${matchedChunk.distance})`
      );
      return;
    } else {
      // No sufficiently similar content found, proceed with full processing and storing
      console.log(
        `  --> No highly similar content found. Proceeding with full processing for "${article['Knowledge Base Article'].question}"`
      );
      return article;
    }
  });

  const finalArticles = await Promise.all(finalArticlesPromises);
  console.log(
    `Returned ${finalArticles.length}/${allArticles.length} articles`
  );

  return finalArticles;
};

export default articleVectorSearch;
