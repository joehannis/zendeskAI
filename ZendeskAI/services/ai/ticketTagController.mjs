import { jsonrepair } from 'jsonrepair';
import { canMakeRequest } from '../../utils/rateLimiter.mjs';
import splitTickets from '../../utils/splitTickets.mjs';
import ticketTagAICall from './ticketTagAICall.mjs';

const ticketTagController = async (tickets) => {
  const apiLimit = 150000;
  const rpmLimit = 150;

  const initialTokenEstimateResponse = await ticketTagAICall(
    tickets,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:countTokens'
  );

  console.log(
    'Token Count for this call: ',
    initialTokenEstimateResponse.totalTokens
  );

  let chunksArray = [];

  if (initialTokenEstimateResponse.totalTokens < apiLimit) {
    chunksArray.push(tickets);
    chunksArray.flat(Infinity);
  } else {
    const initialSplit = canMakeRequest(
      initialTokenEstimateResponse.totalTokens,
      apiLimit,
      rpmLimit
    );

    chunksArray = await splitTickets(
      tickets,
      null,
      initialSplit.acceptableChunkSize
    );

    chunksArray.flat(Infinity);
  }

  const chunkResults = [];

  for (const [index, chunk] of chunksArray.entries()) {
    let attempt = 0;
    const maxAttempts = 5;
    const initialDelay = 1000;

    while (attempt < maxAttempts) {
      attempt++;
      console.log(
        `Making API call for unsorted tickets: chunk ${
          index + 1
        } (attempt ${attempt})...`
      );

      try {
        const result = await ticketTagAICall(
          chunk,
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
        );

        if (!result) {
          console.error(`No result returned for chunk ${index + 1}`);
          break;
        }

        chunkResults.push(result);

        break;
      } catch (error) {
        let retryDelayFromApi = 0;
        try {
          const errorDetails = error.response?.data?.error?.details;
          if (errorDetails) {
            const retryInfo = errorDetails.find(
              (detail) =>
                detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
            );
            if (retryInfo && retryInfo.retryDelay) {
              retryDelayFromApi = parseInt(retryInfo.retryDelay) * 1000;
            }
          } else {
            console.log(error);
          }
        } catch (parseError) {
          console.error(
            'Failed to parse error details for retryDelay:',
            JSON.stringify(parseError)
          );
        }

        if (error.response && error.response.status === 429) {
          const delay =
            retryDelayFromApi > 0
              ? retryDelayFromApi
              : initialDelay * Math.pow(2, attempt - 1);

          console.warn(
            `Rate limit hit for chunk ${
              index + 1
            }. Retrying in ${delay}ms (from API: ${
              retryDelayFromApi > 0 ? 'yes' : 'no'
            })...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          console.error(`Error for chunk ${index + 1}:`, JSON.stringify(error));
          break;
        }
      }
    }

    if (attempt >= maxAttempts && chunkResults.length <= index) {
      throw new Error(
        `Failed to generate content for chunk ${
          index + 1
        } after ${maxAttempts} attempts.`
      );
    }
  }

  let allParsedResults = [];

  for (const [index, result] of chunkResults.entries()) {
    if (!result || !result.candidates || result.candidates.length === 0) {
      console.error(
        `Skipping chunk ${
          index + 1
        } as it had no valid candidates or failed during the API call.`
      );
      continue; // Move to the next chunk
    }

    const candidate = result.candidates[0];
    let currentChunkRawText = ''; // Accumulate all parts for the current chunk's response

    // Concatenate all text parts from the current candidate's content
    candidate?.content?.parts?.forEach((part) => {
      currentChunkRawText += part.text;
    });

    try {
      // Repair the raw text to fix any malformed JSON issues within this chunk's response
      const cleanedJsonString = currentChunkRawText
        .replace(/`/g, '')
        .replace(/json/g, '')
        .trim();
      const repairedChunkText = jsonrepair(cleanedJsonString);
      // Parse the repaired text into a JavaScript object/array
      const parsedChunk = JSON.parse(repairedChunkText);

      // If it's a single object (and not null/undefined)
      allParsedResults.push(parsedChunk);
    } catch (jsonProcessingError) {
      // Log detailed error if JSON repair or parsing fails for a chunk
      console.error(
        `Failed to repair or parse JSON for chunk ${index + 1}: ${
          jsonProcessingError.message
        }`,
        'Raw text that caused error:',
        currentChunkRawText
      );
      // Return an error status, indicating failure to process one or more chunks
      return {
        status: 'error',
        error: `Failed to parse JSON for one or more chunks. Error in chunk ${
          index + 1
        }: ${jsonProcessingError.message}`,
      };
    }
  }
  if (allParsedResults.length > 0) {
    return allParsedResults.flat(Infinity);
  } else {
    return {
      status: 'error',
      error: `No valid results after processing chunks`,
    };
  }
};

export default ticketTagController;
