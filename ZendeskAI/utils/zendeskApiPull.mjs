import path from 'path';
import dotenv from 'dotenv';

const __filename = process.argv[1];
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const zendeskApiPull = async (url, method, attempt = 1, maxRetries = 5) => {
  const authHeader = `Basic ${Buffer.from(
    `${process.env.ZENDESK_EMAIL}/token:${process.env.ZENDESK_API_KEY}`
  ).toString('base64')}`;

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
  });

  // Handle rate limiting with Retry-After (seconds), otherwise exponential backoff
  if (url.includes('comments.json') && response.status === 404) {
    console.warn(`Skipping ticket ${url} as it has been deleted`);
  } else if (response.status === 429 && attempt <= maxRetries) {
    `429 rate limit. Attempt ${attempt}/${maxRetries}. Retrying in 15s...`;

    await new Promise((r) => setTimeout(r, 15000));
    return zendeskApiPull(url, method, attempt + 1, maxRetries);
  } else if (!response.ok) {
    let errorBodyText = '';
    try {
      errorBodyText = await response.text();
    } catch {
      /* ignore parsing errors */
    }
    const err = new Error(
      `Zendesk request failed (${response.status} ${response.statusText}) for ${url}`
    );
    err.status = response.status;
    err.body = errorBodyText;
    console.warn(JSON.stringify(err));
  }

  return response.json();
};

export default zendeskApiPull;
