import TPA_TPSA_OPTIONS from '../../constants/zendesk-technical-product-areas.json' with { type: 'json' };
import path from 'path';
import dotenv from 'dotenv';
import { dispatcher } from '../../utils/timeout.mjs';

const __filename = process.argv[1];
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, './../.env') });

const ticketTagAICall = async (tickets, url) => {
  try {
    let result;
    if (url.includes('generateContent')) {
      result = await fetch(url, {
        method: 'POST',
        dispatcher,
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': process.env.GOOGLE_API_KEY,
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: `You are a specialist in categorizing support tickets for a software company. Your task is to read the content of support tickets and assign the correct Technical Product Area (TPA) and Technical Product Sub-Area (TPSA) based on the issue described. Please follow these steps to categorize a ticket:

1. Carefully read the entire ticket content in the field 'Full Public Comments', paying attention to the main technical issue or topic being discussed.

2. Identify the primary Technical Product Area (TPA) that best matches the main issue in the ticket. Consider the overall context and the specific product or feature being discussed. If the ticket contains a TPA, do not change it.

3. Once you've identified the TPA, review the corresponding Technical Product Sub-Areas (TPSAs) for that TPA and select the most relevant one that further specifies the issue. If the ticket contains a TPSA, do not change it. Ensure that the TPA links to the selected TPSA.

4. Return a parsable JSON without block formatting.

5. Tickets can be spam or non product related, if this is the case please mark the TPA and TPSA as 'none'.

6. All TPAs must start with 'tpa_' and all TPSAs must start with 'tpsa_'.


Remember to be as specific as possible in your categorization.`,
              },
            ],
          },
          contents: [
            {
              parts: [
                {
                  text: `

Here are the support tickets:
                <ticket_content>
                  ${JSON.stringify(tickets, null, 2)}
                </ticket_content>

Here are the available TPA and TPSA options:
                <tpa_tpsa_options>
                  ${JSON.stringify(TPA_TPSA_OPTIONS, null, 2)}
                </tpa_tpsa_options>`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: "ARRAY",
              description:
                'An array of objects containing support tickets categorized with TPA and TPSA.',
              minItems: 1,
              items: {
                type: "OBJECT",
                description:
                  'A single support ticket object with fields for ID, TPA, and TPSA.',
                properties: {
                  id: {
                    type: "STRING",
                    description:
                      'The unique identifier for the support ticket.',
                  },
                  tpa: {
                    type: "STRING",
                    description: 'tpa category for ticket sorting',
                  },
                  tpsa: {
                    type: "STRING",
                    description: 'tpsa sub category for ticket sorting',
                  },
                },
                propertyOrdering: [
                  'id',
                  'tpa',
                  'tpsa',
                ],
                required: ['id', 'tpa', 'tpsa'],
              },
            },
          },
        }),
      });
    } else if (url.includes('countTokens')) {
      result = await fetch(url, {
        method: 'POST',
        dispatcher,
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': process.env.GOOGLE_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a specialist in categorizing support tickets for a software company. Your task is to read the content of support tickets and assign the correct Technical Product Area (TPA) and Technical Product Sub-Area (TPSA) based on the issue described.

Here are the support tickets:
                <ticket_content>
                  ${JSON.stringify(tickets, null, 2)}
                </ticket_content>

And here are the available TPA and TPSA options:
                <tpa_tpsa_options>
                  ${JSON.stringify(TPA_TPSA_OPTIONS, null, 2)}
                </tpa_tpsa_options>

Please follow these steps to categorize a ticket:

                1. Carefully read the entire ticket content in the field 'Full Public Comments', paying attention to the main technical issue or topic being discussed.

2. Identify the primary Technical Product Area(TPA) that best matches the main issue in the ticket.Consider the overall context and the specific product or feature being discussed.If the ticket contains a TPA, do not change it.

3. Once you've identified the TPA, review the corresponding Technical Product Sub-Areas (TPSAs) for that TPA and select the most relevant one that further specifies the issue. If the ticket contains a TPSA, do not change it. Ensure that the TPA links to the selected TPSA

4. Return a parsable JSON without block formatting.

5. Tickets can be spam or non product related, if this is the case please mark the TPA and TPSA as 'none'.

6. All TPAs must start with 'tpa_' and all TPSAs must start with 'tpsa_'.

Remember to be as specific as possible in your categorization`,
                },
              ],
            },
          ],
        }),
      });
    }

    if (!result.ok) {
      const errorText = await result.text();
      console.error(`API Error: ${result.status} ${result.statusText}`);
      console.error(`Error Body: ${JSON.stringify(errorText)}`);
      return null;
    }

    const data = await result.json();
    return data;
  } catch (error) {
    console.error('An error occurred during the API call:', JSON.stringify(error));
    // You might want to return an empty or default value here
    return null;
  }
};

export default ticketTagAICall;
