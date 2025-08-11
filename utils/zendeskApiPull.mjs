import path from 'path';
import dotenv from 'dotenv';

const __filename = process.argv[1];
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const zendeskApiPull = async (url, method) => {
  const authHeader = `Basic ${Buffer.from(
    `${process.env.ZENDESK_EMAIL}/token:${process.env.ZENDESK_API_KEY}`
  ).toString('base64')}`;

  const response = await fetch(url, {
    method: `${method}`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
  });
  let attempt = 1;
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const delaySeconds = retryAfter ? parseInt(retryAfter, 10) : attempt * 5;
    console.warn(
      `Rate limit hit. Retrying in ${delaySeconds} seconds. Attempt ${attempt}...`
    );
    await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
    return zendeskApiPull(url, method, attempt + 1);
  } else if (!response.ok) {
    const errorBody = await response.json();
    console.error(
      `Error fetching Zendesk data from ${url}:`,
      response.status,
      errorBody
    );
  }

  const data = await response.json();
  return data;
};

export default zendeskApiPull;
