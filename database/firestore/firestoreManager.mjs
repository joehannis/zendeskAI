import { initializeApp, getApps } from 'firebase-admin/app';
import {
  getFirestore,
  FieldValue,
  Filter,
  Timestamp,
} from 'firebase-admin/firestore';

let firebaseAdminApp;
let firestoreInstance;

if (!firebaseAdminApp) {
  firebaseAdminApp = getApps().length === 0 ? initializeApp() : getApps()[0];
}

if (!firestoreInstance) {
  firestoreInstance = getFirestore();
}
export const addArticleToFirestore = async (
  article,
  zendeskId,
  articleMetadata
) => {
  const batch = firestoreInstance.batch();

  // --- UNIFIED COLLECTION REFERENCE FOR ALL LEVELS ---
  const unifiedCollectionRef = firestoreInstance
    .collection('articles')
    .doc(articleMetadata.tpa)
    .collection('content');

  const fullArticleRef = unifiedCollectionRef.doc(zendeskId);
  batch.set(fullArticleRef, {
    zendeskId: zendeskId,
    fullArticleText: article.fullArticleText,
    semanticEmbedding: FieldValue.vector(article.fullArticleSemanticEmbedding),
    retrievalEmbedding: FieldValue.vector(
      article.fullArticleRetrievalEmbedding
    ),
    originalArticleTitle: article.title,
    tpa: articleMetadata.tpa,
    tpsa: articleMetadata.tpsa,
    ticketIds: articleMetadata['Ticket IDs'],
    type: 'full_article',
    timestamp: FieldValue.serverTimestamp(),
  });
  console.log(
    `Added full article (type: full_article) to batch: ${fullArticleRef.path}`
  );

  // --- 2. Add Sections (Level 1) ---
  for (const section of article.sections) {
    const sectionId = `${zendeskId}_section_${section.sectionIndex}`;
    const sectionRef = unifiedCollectionRef.doc(sectionId);
    batch.set(sectionRef, {
      zendeskId: zendeskId,
      sectionText: section.sectionText,
      sectionIndex: section.sectionIndex,
      semanticEmbedding: FieldValue.vector(section.sectionSemanticEmbedding),
      retrievalEmbedding: FieldValue.vector(section.sectionRetrievalEmbedding),
      originalArticleTitle: article.title,
      tpa: articleMetadata.tpa,
      tpsa: articleMetadata.tpsa,
      ticketIds: articleMetadata['Ticket IDs'],
      type: 'article_section',
      timestamp: FieldValue.serverTimestamp(),
    });
    console.log(
      `Added section (type: article_section) to batch: ${sectionRef.path}`
    );

    // --- 3. Add Chunks (Level 2) ---
    for (const chunk of section.chunks) {
      // Generate a unique ID for each chunk document within the 'content' collection
      const chunkId = `${zendeskId}_section_${section.sectionIndex}_chunk_${chunk.chunkIndex}`; // Example unique ID
      const chunkRef = unifiedCollectionRef.doc(chunkId); // All docs go into unified collection
      batch.set(chunkRef, {
        zendeskId: zendeskId,
        chunkText: chunk.chunkText,
        chunkIndex: chunk.chunkIndex,
        semanticEmbedding: FieldValue.vector(chunk.chunkSemanticEmbedding),
        retrievalEmbedding: FieldValue.vector(chunk.chunkRetrievalEmbedding),
        originalArticleTitle: article.title,
        tpa: articleMetadata.tpa,
        tpsa: articleMetadata.tpsa,
        ticketIds: articleMetadata['Ticket IDs'],
        parentSectionId: sectionId,
        type: 'article_chunk',
        timestamp: FieldValue.serverTimestamp(),
      });
      console.log(
        `Added chunk (type: article_chunk) to batch: ${chunkRef.path}`
      );
    }
  }

  // --- Commit the entire batch ---
  try {
    await batch.commit();
    console.log(
      `All hierarchical data for article "${article.title}" (${zendeskId}) committed to 'content' collection successfully!`
    );
    return {
      success: true,
      message: `Article ${zendeskId} and its hierarchy added to 'content'.`,
    };
  } catch (e) {
    console.error('Firestore batch write error:', e);
    return {
      success: false,
      message: `Firestore batch write failed: ${e.message}`,
    };
  }
};

export const fetchArticlesFromFirestore = async (tpa) => {
  const articlesRef = await firestoreInstance
    .collectionGroup('content')
    .where('tpa', '==', tpa)
    .where('type', '==', 'full_article')
    .get();

  const results = articlesRef.docs.map((doc) => ({
    ...doc.data(),
  }));

  return results;
};

export const addDocToFirestore = async (doc, tpa, zendeskId) => {
  if (
    doc &&
    doc.fullDocText &&
    doc.fullDocSemanticEmbedding &&
    doc.sections &&
    zendeskId
  ) {
    const batch = firestoreInstance.batch();

    // --- UNIFIED COLLECTION REFERENCE FOR ALL LEVELS ---
    const unifiedCollectionRef = firestoreInstance
      .collection('articles')
      .doc(tpa)
      .collection('content');

    // Generate a unique ID for the original article. This ID will also be used
    // as the 'parent_doc_id' for all sections and chunks derived from this article.

    // --- 1. Add the Full Document (Level 0) ---
    // The document ID for the full article will be its originalArticleId
    const fullDocRef = unifiedCollectionRef.doc(zendeskId);
    batch.set(fullDocRef, {
      zendeskId: zendeskId,
      fullDocText: doc.fullDocText,
      semanticEmbedding: FieldValue.vector(doc.fullDocSemanticEmbedding),
      retrievalEmbedding: FieldValue.vector(doc.fullDocRetrievalEmbedding),
      originalDocTitle: doc.title, // Main title of the article
      tpa: tpa,
      type: 'full_doc',
      timestamp: FieldValue.serverTimestamp(),
    });
    console.log(`Added full doc (type: full_doc) to batch: ${fullDocRef.path}`);

    // --- 2. Add Sections (Level 1) ---
    for (const section of doc.sections) {
      // Generate a unique ID for each section document within the 'content' collection
      const sectionId = `${zendeskId}_section_${section.sectionIndex}`; // Example unique ID
      const sectionRef = unifiedCollectionRef.doc(sectionId); // All docs go into unified collection
      batch.set(sectionRef, {
        zendeskId: zendeskId,
        sectionText: section.sectionText,
        sectionIndex: section.sectionIndex,
        semanticEmbedding: FieldValue.vector(section.sectionSemanticEmbedding),
        retrievalEmbedding: FieldValue.vector(
          section.sectionRetrievalEmbedding
        ),
        originalDocTitle: doc.title, // Link back to original article title
        tpa: tpa,
        type: 'doc_section', // <-- Differentiator for this document
        timestamp: FieldValue.serverTimestamp(),
      });
      console.log(
        `Added section (type: doc_section) to batch: ${sectionRef.path}`
      );

      // --- 3. Add Chunks (Level 2) ---
      for (const chunk of section.chunks) {
        // Generate a unique ID for each chunk document within the 'content' collection
        const chunkId = `${zendeskId}_section_${section.sectionIndex}_chunk_${chunk.chunkIndex}`; // Example unique ID
        const chunkRef = unifiedCollectionRef.doc(chunkId); // All docs go into unified collection
        batch.set(chunkRef, {
          chunkText: chunk.chunkText,
          chunkIndex: chunk.chunkIndex,
          semanticEmbedding: FieldValue.vector(chunk.chunkSemanticEmbedding),
          retrievalEmbedding: FieldValue.vector(chunk.chunkRetrievalEmbedding),
          originalDocTitle: doc.title,
          zendeskId: zendeskId, // Link to its parent full document
          parentSectionId: sectionId, // Link to its parent section
          tpa: tpa,
          type: 'doc_chunk', // <-- Differentiator for this document
          timestamp: FieldValue.serverTimestamp(),
        });
        console.log(`Added chunk (type: doc_chunk) to batch: ${chunkRef.path}`);
      }
    }

    // --- Commit the entire batch ---
    try {
      await batch.commit();
      console.log(
        `All hierarchical data for doc "${doc.title}" (${zendeskId}) committed to 'content' collection successfully!`
      );
      return {
        success: true,
        message: `Doc ${zendeskId} and its hierarchy added to 'content'.`,
      };
    } catch (e) {
      console.error('Firestore batch write error:', e);
      return {
        success: false,
        message: `Firestore batch write failed: ${e.message}`,
      };
    }
  }
};

export const docsSearch = async (title) => {
  const query = firestoreInstance
    .collectionGroup('content')
    .where('originalDocTitle', '==', title);

  const snapshot = await query.get();

  const results = [];
  snapshot.forEach((chunk) => {
    results.push(chunk.data());
  });

  return { success: true, data: results };
};

export const docsDelete = async (title) => {
  const query = firestoreInstance
    .collectionGroup('content')
    .where('originalDocTitle', '==', title);

  try {
    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log(`No documents found with title "${title}" to delete.`);
      return {
        success: true,
        message: `No documents found with title "${title}" to delete.`,
      };
    }

    const batch = firestoreInstance.batch();

    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(
      `Successfully deleted ${snapshot.size} documents with title "${title}".`
    );
    return {
      success: true,
      message: `Successfully deleted ${snapshot.size} documents.`,
    };
  } catch (error) {
    console.error(`Error deleting documents with title "${title}":`, error);
    return {
      success: false,
      message: `Error deleting documents: ${error.message}`,
    };
  }
};

export const hierarchicalVectorSearch = async (
  articleEmbedding,
  type,
  distance,
  bufoAi = false
) => {
  if (bufoAi) {
    const ticketSources = new Set();
    const zendeskSources = new Set();
    const query = firestoreInstance.collectionGroup(`content`);
    const response = await query
      .findNearest({
        vectorField: type,
        queryVector: articleEmbedding,
        limit: 20,
        distanceMeasure: 'DOT_PRODUCT',
        distanceThreshold: distance,
        distanceResultField: 'vector_distance',
      })
      .get();

    const results = [];

    response.forEach((doc) => {
      const data = doc.data();

      if (data.ticketIds) {
        data.ticketIds.forEach((id) => {
          ticketSources.add(id);
        });
      }

      if (data.zendeskId) {
        zendeskSources.add(data.zendeskId);
      }
      results.push(data);
    });

    return {
      success: true,
      data: results,
      sources: {
        ticketIds: [...ticketSources],
        zendeskIds: [...zendeskSources],
      },
      message: 'Hierarchical search completed.',
    };
  } else {
    const baseLevel1Query = firestoreInstance
      .collectionGroup(`content`)
      .where(
        Filter.or(
          Filter.where('type', '==', 'doc_section'),
          Filter.where('type', '==', 'article_section')
        )
      );

    const sectionLevelResults = await baseLevel1Query
      .findNearest({
        vectorField: type,
        queryVector: articleEmbedding,
        limit: 10,
        distanceMeasure: 'DOT_PRODUCT',
        distanceThreshold: 0.5,
        distanceResultField: 'vector_distance',
      })
      .get();

    const relevantSectionIds = [];
    const retrievedSectionInfo = [];

    sectionLevelResults.forEach((doc) => {
      const data = doc.data();
      relevantSectionIds.push(doc.id);
      retrievedSectionInfo.push(data);
    });

    if (relevantSectionIds.length === 0) {
      console.log('Stage 1: No relevant sections found.');
      return {
        success: true,
        data: [],
        message: 'No relevant sections found.',
      };
    }
    console.log(
      `Stage 1: Found ${relevantSectionIds.length} relevant sections.`
    );

    const baseLevel2Query = firestoreInstance
      .collectionGroup(`content`)
      .where(
        Filter.or(
          Filter.where('type', '==', 'doc_chunk'),
          Filter.where('type', '==', 'article_chunk')
        )
      );

    let chunkResults;
    if (relevantSectionIds.length > 0) {
      console.log(relevantSectionIds);
      chunkResults = await baseLevel2Query
        .where('parentSectionId', 'in', relevantSectionIds)
        .findNearest({
          vectorField: type,
          queryVector: articleEmbedding,
          limit: 10,
          distanceMeasure: 'DOT_PRODUCT',
          distanceThreshold: distance,
          distanceResultField: 'vector_distance',
        })
        .get();
    } else {
      chunkResults = { size: 0, forEach: () => {} };
    }

    const topRelevantChunks = [];
    chunkResults.forEach((doc) => {
      const data = doc.data();
      console.log(data);

      if (data.originalDocTitle) {
        topRelevantChunks.push({
          id: doc.id,
          type: data.type,
          zendeskId: data.zendeskId,
          distance: data.vector_distance,
          chunkText: data.chunkText,
          parentSectionId: data.parentSectionId,
          originalDocTitle: data.originalDocTitle,
          tpa: data.tpa,
        });
      } else if (data.originalArticleTitle) {
        topRelevantChunks.push({
          id: doc.id,
          type: data.type,
          zendeskId: data.zendeskId,
          distance: data.vector_distance,
          chunkText: data.chunkText,
          parentSectionId: data.parentSectionId,
          originalArticleTitle: data.originalArticleTitle,
          tpa: data.tpa,
        });
      }
    });
    console.log(
      `Stage 2: Found ${topRelevantChunks.length} top relevant chunks.`
    );

    return {
      success: true,
      data: topRelevantChunks,
      message: 'Hierarchical search completed.',
    };
  }
};

// const deleteYesterdayDocuments = async () => {
//   const BATCH_SIZE = 50;
//   let documentsDeleted = 0;
//   try {
//     console.log('Starting deletion of documents from August 5th, 2025...');

//     // Define the specific date: August 5th, 2025
//     const targetYear = 2025;
//     const targetMonth = 7; // August is month 7 (0-indexed: Jan=0, Feb=1, ..., Aug=7)
//     const targetDay = 5;

//     // Calculate the start and end of the target day
//     const startOfTargetDay = new Date(
//       targetYear,
//       targetMonth,
//       targetDay,
//       0,
//       0,
//       0,
//       0 // Include milliseconds for precision
//     );
//     const endOfTargetDay = new Date(
//       targetYear,
//       targetMonth,
//       targetDay,
//       23,
//       59,
//       59,
//       999 // Include milliseconds for precision
//     );

//     // Convert to Firestore Timestamps for the query
//     const startTimestamp = Timestamp.fromDate(startOfTargetDay);
//     const endTimestamp = Timestamp.fromDate(endOfTargetDay);

//     // Fetch all documents within the specified date range.
//     const snapshot = await firestoreInstance
//       .collectionGroup('content')
//       .where(
//         Filter.or(
//           Filter.where('type', '==', 'article_chunk'),
//           Filter.where('type', '==', 'article_section'),
//           Filter.where('type', '==', 'full_article')
//         )
//       )
//       .where('timestamp', '>=', startTimestamp)
//       .where('timestamp', '<=', endTimestamp)
//       .get();

//     console.log(
//       `Found ${snapshot.size} documents uploaded yesterday to delete.`
//     );

//     if (snapshot.size === 0) {
//       console.log('No documents found from yesterday. No action taken.');
//       return { success: true, message: 'No documents to delete.' };
//     }

//     const docsToDelete = snapshot.docs;

//     // Process the documents in smaller batches
//     for (let i = 0; i < docsToDelete.length; i += BATCH_SIZE) {
//       const batch = firestoreInstance.batch();
//       const batchDocs = docsToDelete.slice(i, i + BATCH_SIZE);

//       batchDocs.forEach((doc) => {
//         // Delete the document
//         batch.delete(doc.ref);
//       });

//       await batch.commit();
//       documentsDeleted += batchDocs.length;
//       console.log(
//         `Committed batch of ${batchDocs.length} documents. Total deleted: ${documentsDeleted}`
//       );
//     }

//     console.log(
//       `Deletion complete. Total documents deleted: ${documentsDeleted}`
//     );
//     return {
//       success: true,
//       message: `Deleted ${documentsDeleted} documents uploaded yesterday.`,
//     };
//   } catch (error) {
//     console.error('Error during document deletion:', error);
//     return {
//       success: false,
//       message: `Failed to delete documents: ${error.message}`,
//     };
//   }
// };

// const test = async () => {
//   const query = await firestoreInstance
//     .collectionGroup(`content`)
//     .where('zendeskId', '==', '39703797024923')
//     .where('type', '==', 'full_article')
//     .get();

//   const result = [];

//   query.forEach((doc) => {
//     const data = doc.data();
//     result.push(data);
//   });

//   const searchResults = await hierarchicalVectorSearch(
//     result[0].semanticEmbedding,
//     'semanticEmbedding',
//     0.85
//   );

//   console.log(searchResults);
// };
// test();
