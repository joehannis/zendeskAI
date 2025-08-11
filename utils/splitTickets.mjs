import generatePromptContent from './generatePromptContent.mjs';
const geminiAPILimit = 1048576;

const splitTickets = async (ai, tickets, docs, initialChunkCount) => {
  let currentTicketChunkCount = initialChunkCount;
  const originalTicketCount = tickets.length;
  console.log('original ticket count', originalTicketCount);

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
        tempChunksForValidation.push({
          docs: docs,
          tickets: chunkedTickets,
        });
      }
    }

    allChunksValid = true; // Assume valid until proven otherwise
    let maxTokensInChunk = 0;

    for (const chunk of tempChunksForValidation) {
      const chunkPrompt = generatePromptContent(
        chunk.docs,
        chunk.tickets,
        'gemini'
      );
      try {
        const tokenEstimateResponse = await ai.models.countTokens({
          model: 'gemini-2.5-pro',
          contents: chunkPrompt.prompt,
          generationConfig: { responseSchema: chunkPrompt.jsonSchema },
        });

        const tokenEstimate = tokenEstimateResponse.totalTokens;
        chunksTokenEstimates.push(tokenEstimate);
        maxTokensInChunk = Math.max(maxTokensInChunk, tokenEstimate);

        if (tokenEstimate > geminiAPILimit) {
          console.log(
            `A chunk is still too large, token count: ${tokenEstimate} (Limit: ${geminiAPILimit})`
          );
          allChunksValid = false; // Mark as invalid
          // No need to break here, continue to estimate all for better decision making
        }
      } catch (error) {
        console.error('Error counting tokens for a chunk:', error);
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
