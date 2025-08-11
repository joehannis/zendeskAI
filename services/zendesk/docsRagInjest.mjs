import zendeskApiPull from '../../utils/zendeskApiPull.mjs';
import TPA_TPSA_OPTIONS from '../../constants/zendesk-technical-product-areas.json' with { type: 'json' };
import {
  addDocToFirestore,
  docsSearch,
  docsDelete,
} from '../../database/firestore/firestoreManager.mjs';
import { processHierarchically } from '../../utils/ragProcessing.mjs';

const docsRagInjest = async (ai, config) => {
  const searchAreaTPA = config.tpa;
  const reprocess = config.reprocess;

  for (const area of TPA_TPSA_OPTIONS) {
    if (searchAreaTPA) {
      if (area.tpa === searchAreaTPA) {
        console.log(`Processing TPA: ${area.tpa}`);

        for (const section of area.sections) {
          console.log(`  Pulling docs for section: ${section.id}`);
          const docs = await zendeskApiPull(
            `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/help_center/articles/search.json?section=${section.id}`,
            'GET'
          );

          if (docs?.results && docs.results.length > 0) {
            console.log(
              `    Found ${docs.results.length} articles in section ${section.id}.`
            );
            for (const doc of docs.results) {
              const updated = new Date(doc.updated_at);
              let result = null;

              if (!reprocess) {
                const docSearch = await docsSearch(doc.title);
                if (docSearch.success && docSearch.data.length > 0) {
                  const uploaded = docSearch.data[0].timestamp.toDate();
                  if (uploaded > updated) {
                    console.log(
                      `      Doc "${doc.title}" already exists and is up-to-date, skipping`
                    );
                  } else {
                    console.log(
                      `      New version of "${doc.title}" available or reprocessing requested. Processing...`
                    );
                    await docsDelete(doc.title);
                    const processedDoc = await processHierarchically(
                      ai,
                      doc,
                      'doc'
                    );
                    result = await addDocToFirestore(
                      processedDoc,
                      area.tpa,
                      doc.id.toString()
                    );
                  }
                } else {
                  console.log(
                    `      Doc "${doc.title}" not found in Firestore. Processing...`
                  );
                  const processedDoc = await processHierarchically(
                    ai,
                    doc,
                    'doc'
                  );
                  result = await addDocToFirestore(
                    processedDoc,
                    area.tpa,
                    doc.id.toString()
                  );
                }
              } else {
                console.log(
                  `      Reprocessing enabled. Forcing processing of "${doc.title}"...`
                );
                await docsDelete(doc.title);
                const processedDoc = await processHierarchically(
                  ai,
                  doc,
                  'doc'
                );
                result = await addDocToFirestore(
                  processedDoc,
                  area.tpa,
                  doc.id.toString()
                );
              }
              return result;
            }
          } else {
            console.log(`    No articles found in section: ${section.id}`);
          }
        }
      }
    } else {
      if (area.sections) {
        for (const section of area.sections) {
          console.log(`  Pulling docs for section: ${section.id}`);
          const docs = await zendeskApiPull(
            `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/help_center/articles/search.json?section=${section.id}`,
            'GET'
          );

          if (docs?.results && docs.results.length > 0) {
            console.log(
              `    Found ${docs.results.length} articles in section ${section.id}.`
            );
            for (const doc of docs.results) {
              const updated = new Date(doc.updated_at);
              let result = null;

              if (!reprocess) {
                const docSearch = await docsSearch(doc.title);
                if (docSearch.success && docSearch.data.length > 0) {
                  const uploaded = docSearch.data[0].timestamp.toDate();
                  if (uploaded > updated) {
                    console.log(
                      `      Doc "${doc.title}" already exists and is up-to-date, skipping`
                    );
                    continue
                  } else {
                    console.log(
                      `      New version of "${doc.title}" available or reprocessing requested. Processing...`
                    );
                    await docsDelete(doc.title);
                    const processedDoc = await processHierarchically(
                      ai,
                      doc,
                      'doc'
                    );
                    result = await addDocToFirestore(
                      processedDoc,
                      area.tpa,
                      doc.id.toString()
                    );
                  }
                } else {
                  console.log(
                    `      Doc "${doc.title}" not found in Firestore. Processing...`
                  );
                  const processedDoc = await processHierarchically(
                    ai,
                    doc,
                    'doc'
                  );
                  result = await addDocToFirestore(
                    processedDoc,
                    area.tpa,
                    doc.id.toString()
                  );
                }
              } else {
                console.log(
                  `      Reprocessing enabled. Forcing processing of "${doc.title}"...`
                );
                await docsDelete(doc.title);
                const processedDoc = await processHierarchically(
                  ai,
                  doc,
                  'doc'
                );
                result = await addDocToFirestore(
                  processedDoc,
                  area.tpa,
                  doc.id.toString()
                );
              }
               await new Promise((resolve) => setTimeout(resolve, 15 * 1000));
            }
          } else {
            console.log(`    No articles found in section: ${section.id}`);
          }
        }
      }
    }
  }

  console.log('Docs RAG Ingest process completed.');
  return
};

export default docsRagInjest;
