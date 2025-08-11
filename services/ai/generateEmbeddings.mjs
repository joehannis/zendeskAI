import path from 'path';
import dotenv from 'dotenv';

const __filename = process.argv[1];
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

const generateEmbeddings = async (ai, content, type) => {
  let embeddingsData;
  try {
    const embeddingsResponse = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: content,
      taskType: type,
      outputDimensionality: 1536,
    });

    const embedding768 = embeddingsResponse.embeddings[0].values.slice(0, 1536);

    embeddingsData = l2Normalize(embedding768);

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
        `Rate limit hit for embedding. Retrying in ${delay}ms (from API: ${
          retryDelayFromApi > 0 ? 'yes' : 'no'
        })...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    } else {
      console.error(`Error for embedding:`, error);
      throw error;
    }

    if (attempt >= maxAttempts) {
      throw new Error(
        `Failed to generate emedding after ${maxAttempts} attempts.`
      );
    }

    console.error('Error generating batch embeddings:', error);
    return;
  }
};

export default generateEmbeddings;
