import articleAICall from '../services/ai/articleAICall.mjs';
import ticketTagAICall from '../services/ai/ticketTagAICall.mjs';
const geminiAPILimit = 1048576;

const splitTickets = async (tickets, docs = null, initialChunkCount) => {
  let currentTicketChunkCount = initialChunkCount;
  const originalTicketCount = tickets.length;

  let allChunksValid = false;
  let finalChunks = [];

  while (!allChunksValid) {
    console.log(
      `Attempting to split into ${currentTicketChunkCount} chunk(s)...`
    );

    const chunkSize = Math.max(
      1,
      Math.ceil(originalTicketCount / currentTicketChunkCount)
    );
    let tempChunksForValidation = [];
    let chunksTokenEstimates = []; // Reset for each iteration

    for (let i = 0; i < originalTicketCount; i += chunkSize) {
      const chunkedTickets = tickets.slice(i, i + chunkSize);
      if (chunkedTickets.length > 0) {
        if (docs) {
          tempChunksForValidation.push({
            docs: docs,
            tickets: chunkedTickets,
          });
        } else {
          tempChunksForValidation.push(chunkedTickets);
        }
      }
    }

    allChunksValid = true; // Assume valid until proven otherwise
    let maxTokensInChunk = 0;

    for (const chunk of tempChunksForValidation) {
      let tokenEstimateResponse;
      try {
        if (docs) {
          tokenEstimateResponse = await articleAICall(
            chunk.docs,
            chunk.tickets,
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:countTokens'
          );
        } else {
          tokenEstimateResponse = await ticketTagAICall(
            chunk,
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:countTokens'
          );
        }

        const tokenEstimate = tokenEstimateResponse.totalTokens;
        chunksTokenEstimates.push(tokenEstimate);
        maxTokensInChunk = Math.max(maxTokensInChunk, tokenEstimate);

        if (tokenEstimate > geminiAPILimit) {
          console.log(
            `A chunk is still too large, token count: ${tokenEstimate} (Limit: ${geminiAPILimit})`
          );
          allChunksValid = false; // Mark as invalid
        }
      } catch (error) {
        console.error(
          'Error counting tokens for a chunk:',
          JSON.stringify(error)
        );
        // Decide how to handle errors: re-attempt, throw, or treat as invalid
        allChunksValid = false; // Treat error as invalid, force more chunks
        break; // Stop processing chunks if an error occurs
      }
    }

    if (!allChunksValid) {
      // If any chunk was too large, increase chunk count for the next iteration
      // A more sophisticated approach might be to calculate how much to increment
      // based on `maxTokensInChunk` vs `geminiAPILimit`.
      // For simplicity, we'll just increment by 1, or by a factor if the overflow is large.
      const overflowFactor = Math.ceil(maxTokensInChunk / geminiAPILimit);
      currentTicketChunkCount += Math.max(1, overflowFactor); // Ensure we increase by at least 1
    } else {
      // All chunks are valid, we can break the loop
      finalChunks = tempChunksForValidation;
      console.log(
        `Successfully split tickets into ${finalChunks.length} chunks. All within token limits.`
      );
    }
  }

  return finalChunks;
};

export default splitTickets;
