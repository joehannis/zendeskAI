import dotenv from 'dotenv';
import path from 'path';
import generatePromptContent from '../../utils/generatePromptContent.mjs';
import {
  canMakeRequest,
  getTotalTokensUsedInMinute,
  getRequestsThisMinute,
  getRequestsToday,
} from '../../utils/rateLimiter.mjs';
import splitTickets from '../../utils/splitTickets.mjs';
import { jsonrepair } from 'jsonrepair';

const __filename = process.argv[1];
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const fetchArticles = async (obj, ai, selectedAI) => {
  const apiLimit = 1048576;
  const rpmLimit = 150;
  for (const [tpaKey, tpaValue] of Object.entries(obj)) {
    for (const [tpsaKey, tpsa] of Object.entries(tpaValue.tpsas)) {
      let chunksArray = [];

      const initialPrompt = generatePromptContent(
        tpaValue.docs,
        tpsa.tickets,
        'gemini'
      );
      const initialTokenEstimateResponse = await ai.models.countTokens({
        model: 'gemini-2.5-pro',
        contents: initialPrompt.prompt,
        generationConfig: { responseSchema: initialPrompt.jsonSchema },
      });

      console.log(
        'Token Count for this call: ',
        initialTokenEstimateResponse.totalTokens
      );

      if (initialTokenEstimateResponse.totalTokens < apiLimit) {
        chunksArray.push({ docs: tpaValue.docs, tickets: tpsa.tickets });
      } else {
        const initialSplit = canMakeRequest(
          initialTokenEstimateResponse.totalTokens,
          apiLimit,
          rpmLimit
        );

        chunksArray = await splitTickets(
          ai,
          tpsa.tickets,
          tpaValue.docs,
          initialSplit.acceptableChunkSize
        );
      }

      const chunkResults = [];

      for (const [index, chunk] of chunksArray.entries()) {
        const chunkContent = generatePromptContent(
          chunk.docs,
          chunk.tickets,
          selectedAI
        );
        let attempt = 0;
        const maxAttempts = 5;
        const initialDelay = 1000;

        while (attempt < maxAttempts) {
          attempt++;
          console.log(
            `Making API call for ${tpaKey}: ${tpsaKey}: chunk ${
              index + 1
            } (attempt ${attempt})...`
          );

          try {
            if (selectedAI === 'gemini') {
              const result = await ai.models.generateContent({
                model: 'gemini-2.5-pro',
                contents: chunkContent.prompt,
                generationConfig: {
                  responseMimeType: 'application/json',
                  responseSchema: chunkContent.jsonSchema,
                },
              });
              chunkResults.push(result);
            }
            if (selectedAI === 'openai') {
              const result = await openai.responses.create({
                model: 'gpt-4o',
                input: chunkContent.prompt,
                text: {
                  format: {
                    type: 'json_schema',
                    name: 'article_response',
                    schema: chunkContent.jsonSchema,
                  },
                },
              });

              chunkResults.push(result);
            }
            break;
          } catch (error) {
            let retryDelayFromApi = 0;
            try {
              const errorDetails = error.response?.data?.error?.details;
              if (errorDetails) {
                const retryInfo = errorDetails.find(
                  (detail) =>
                    detail['@type'] ===
                    'type.googleapis.com/google.rpc.RetryInfo'
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
                parseError
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
              console.error(`Error for chunk ${index + 1}:`, error);
              throw error;
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
        candidate.content.parts.forEach((part) => {
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

          // Assuming the API is designed to return an array of articles for each chunk,
          // or a single object. Handle both cases to correctly accumulate results.

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
        if (!tpsa.articles) {
          tpsa.articles = {};
        }
        tpsa.articles = allParsedResults;
      } else {
        return {
          status: 'error',
          error: `No valid results after processing chunks for ${tpsaKey}`,
        };
      }
    }
  }

  return obj;
};

export default fetchArticles;
