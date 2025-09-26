import path from 'path';
import { dispatcher } from '../../utils/timeout.mjs';
import dotenv from 'dotenv';

const __filename = process.argv[1];
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const maxAttempts = 5;
let attempt = 1;

function l2Normalize(vector) {
  if (!vector || vector.length === 0) {
    return [];
  }

  // Calculate the sum of squares
  let sumOfSquares = 0;
  for (let i = 0; i < vector.length; i++) {
    sumOfSquares += vector[i] * vector[i];
  }

  // Calculate the magnitude (Euclidean norm)
  const magnitude = Math.sqrt(sumOfSquares);

  // If magnitude is zero, return the original vector to avoid division by zero
  // (or a zero vector of the same dimension, depending on desired behavior for zero vectors)
  if (magnitude === 0) {
    return vector;
  }

  // Normalize each component
  const normalizedVector = vector.map((component) => component / magnitude);
  return normalizedVector;
}

const generateEmbeddings = async (content, type) => {
  let embeddingsData;

  try {
    const result = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent`,
      {
        method: 'POST',
        dispatcher,
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': process.env.GOOGLE_API_KEY,
        },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: {
            parts: [
              {
                text: content,
              },
            ],
          },
          taskType: type,
          outputDimensionality: 1536,
        }),
      }
    );

    if (!result.ok) {
      const errorText = await result.text();
      console.error(`API Error: ${result.status} ${result.statusText}`);
      console.error(`Error Body:`, JSON.stringify(errorText));
      return null;
    }
    const embeddingsResponse = await result.json();

    const embedding1536 = embeddingsResponse.embedding.values.slice(0, 1536);

    embeddingsData = l2Normalize(embedding1536);

    return embeddingsData;
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
        console.warn(error);
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
        `Rate limit hit for embedding. Retrying in ${delay}ms (from API: ${
          retryDelayFromApi > 0 ? 'yes' : 'no'
        })...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    } else {
      console.error(`Error for embedding:`, JSON.stringify(error));
      throw error;
    }

    if (attempt >= maxAttempts) {
      throw new Error(
        `Failed to generate emedding after ${maxAttempts} attempts.`
      );
    }

    console.error('Error generating batch embeddings:', JSON.stringify(error));
    return;
  }
};

export default generateEmbeddings;
