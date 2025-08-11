import { convert } from 'html-to-text';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import generateEmbeddings from '../services/ai/generateEmbeddings.mjs';
import * as cheerio from 'cheerio';

const convertOptions = {
  wordwrap: false,
  selectors: [
    // 1. Ignore all <img> tags completely
    { selector: 'img', format: 'skip' },

    // 2. Ignore all <a> (link) tags completely
    // This will remove the link text and the href.
    // If an <img> is wrapped in an <a>, the <img> is skipped by the rule above.
    // The <a> tag that wrapped it would then effectively become empty and potentially ignored
    // or just removed by this rule.
    { selector: 'a', options: { ignoreHref: true } },
    { selector: 'table', format: 'dataTable' },
    // Alternative for links:
    // { selector: 'a', options: { ignoreHref: true } } // This would keep the link text but remove the URL.
    // { selector: 'a', format: 'inline', options: { hideLinkHref: true } } // Older way to hide href but keep text.
  ],
};

export const convertHtmlToText = (text) => {
  const body = convert(text, convertOptions);
  return body;
};

// --- Your existing flat splitter (will be adapted for Level 2/3) ---
const fineGrainedSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 100,
  separators: ['\n\n', '\n', '.', ' ', ''],
});

// --- New function to process a document hierarchically ---
export const processHierarchically = async (ai, originalData, type) => {
  const originalTitle =
    type === 'doc'
      ? originalData.title
      : type === 'article'
      ? originalData['Knowledge Base Article'].question
      : null;
  const originalBodyHtml =
    type === 'doc'
      ? originalData.body
      : type === 'article'
      ? originalData['Knowledge Base Article'].answer
      : null;

  // 1. Convert HTML to Text & Parse with Cheerio for Structure
  const $ = cheerio.load(originalBodyHtml);
  const fullPlainText = convertHtmlToText(
    `${originalTitle} \n\n ${originalBodyHtml}`
  );

  // --- Level 0: Full Document Embedding (Optional, but good for coarse search) ---
  const fullSemanticEmbedding =
    type === 'doc'
      ? await generateEmbeddings(ai, fullPlainText, 'SEMANTIC_SIMILARITY')
      : type === 'article'
      ? originalData.semanticEmbedding
      : null;
  const fullRetrievalEmbedding =
    type === 'doc'
      ? await generateEmbeddings(ai, fullPlainText, 'RETRIEVAL_DOCUMENT')
      : type === 'article'
      ? originalData.retrievalEmbedding
      : null;

  // --- Level 1: Section/Heading Level Embeddings ---
  const sectionsData = [];

  // Example: Split by h2, h3. You'll need to adapt this based on your HTML structure.
  $('h2, h3').each((i, el) => {
    const $heading = $(el);
    const sectionTitle = $heading.text().trim();
    let sectionContent = '';

    let currentElement = $heading.next();
    while (currentElement.length && !currentElement.is('h2, h3')) {
      sectionContent += $(currentElement).html(); // Get HTML of content within section
      currentElement = currentElement.next();
    }

    // Convert section content HTML to plain text
    const sectionPlainText = convertHtmlToText(sectionContent);

    if (sectionPlainText.length > 0) {
      sectionsData.push({
        title: sectionTitle,
        plain_text: sectionPlainText,
      });
    }
  });

  if (sectionsData.length === 0 && fullPlainText.length > 0) {
    // If no explicit sections found, treat whole document as one section for Level 1
    sectionsData.push({
      title: originalTitle,
      plain_text: fullPlainText,
    });
  }

  const sections = await Promise.all(
    sectionsData.map(async (section, index) => {
      const sectionSemanticEmbedding = await generateEmbeddings(
        ai,
        section.plain_text,
        'SEMANTIC_SIMILARITY'
      );
      const sectionRetrievalEmbedding = await generateEmbeddings(
        ai,
        section.plain_text,
        'RETRIEVAL_DOCUMENT'
      );

      if (!sectionSemanticEmbedding) {
        console.warn(
          `Failed to generate embedding for section "${section.title}" in ${originalTitle}. Skipping.`
        );
        return null;
      }
      const subChunks = await fineGrainedSplitter.createDocuments([
        section.plain_text,
      ]);
      const subChunkObjects = await Promise.all(
        subChunks.map(async (subChunk, subIndex) => {
          const subChunkText = subChunk.pageContent;
          const subChunkSemanticEmbedding = await generateEmbeddings(
            ai,
            subChunkText,
            'SEMANTIC_SIMILARITY'
          );
          const subChunkRetrievalEmbedding = await generateEmbeddings(
            ai,
            subChunkText,
            'RETRIEVAL_DOCUMENT'
          );
          if (!subChunkSemanticEmbedding) {
            console.warn(
              `Failed to embed sub-chunk ${subIndex} in section "${section.title}". Skipping.`
            );
            return null;
          }
          return {
            chunkText: subChunkText,
            chunkSemanticEmbedding: subChunkSemanticEmbedding,
            chunkRetrievalEmbedding: subChunkRetrievalEmbedding,
            chunkIndex: subIndex,
          };
        })
      );
      return {
        sectionText: section.plain_text,
        sectionSemanticEmbedding: sectionSemanticEmbedding,
        sectionRetrievalEmbedding: sectionRetrievalEmbedding,
        sectionIndex: index,
        chunks: subChunkObjects,
      };
    })
  );
  if (type === 'doc') {
    return {
      title: originalTitle,
      fullDocText: fullPlainText,
      fullDocSemanticEmbedding: fullSemanticEmbedding,
      fullDocRetrievalEmbedding: fullRetrievalEmbedding,
      sections: sections,
    };
  } else if (type === 'article') {
    return {
      title: originalTitle,
      fullArticleText: fullPlainText,
      fullArticleSemanticEmbedding: fullSemanticEmbedding,
      fullArticleRetrievalEmbedding: fullRetrievalEmbedding,
      sections: sections,
    };
  }
};
