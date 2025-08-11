import path from 'path';
import dotenv from 'dotenv';
import TPA_TPSA_OPTIONS from '../../constants/zendesk-technical-product-areas.json' with{ type: 'json' };

const __filename = process.argv[1]; 
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { GoogleGenAI,Type } from '@google/genai';

// eslint-disable-next-line no-undef
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const tagTicket = async(ticket) => {
  let response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-05-20',
    contents: `You are a specialist in categorizing support tickets for a software company. Your task is to read the content of a support ticket and assign the correct Technical Product Area (TPA) and Technical Product Sub-Area (TPSA) based on the issue described.

Here is the content of the support ticket:
<ticket_content>
${JSON.stringify(ticket)}
</ticket_content>

And here are the available TPA and TPSA options:
<tpa_tpsa_options>
${JSON.stringify(TPA_TPSA_OPTIONS)}
</tpa_tpsa_options>

Please follow these steps to categorize the ticket:

1. Carefully read the entire ticket content in the field 'Full Public Comments', paying attention to the main technical issue or topic being discussed.

2. Identify the primary Technical Product Area (TPA) that best matches the main issue in the ticket. Consider the overall context and the specific product or feature being discussed. If the ticket contains a TPA, do not change it.

3. Once you've identified the TPA, review the corresponding Technical Product Sub-Areas (TPSAs) for that TPA and select the most relevant one that further specifies the issue. If the ticket contains a TPSA, do not change it. Ensure that the TPA links to the selected TPSA

4. Output your final selection and justification in the same JSON Schema as the ticket, with the relevant fields now completed with the value of the 'value' field in the relevant <tpa_tpsa_options> object. Do not add anything else to the response, and return the full ticket object without JSON block formatting.

Remember to be as specific as possible in your categorization`,
    generationConfig: {
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          'tpa': {
            type: Type.STRING,
          },
          'tpsa': {
            type: Type.STRING
          }
        }
      }
    }

  });

  const productAreaObj = response
    .replace(/^\s*```json\s*/, '')
    .replace(/\s*```\s*$/, '');

  return productAreaObj;
}

const ticketTagAI = async (tickets) => {

  for (const [area, index] of tickets.entries()) {
   
    if (area.tpa === '' || area.tpsa === '') {
      const response = await tagTicket(area.tickets);
      const result = JSON.parse(response);
      area.tpa = result.tpa
      area.tpsa = result.tpsa
    }
  }
  

 
};

export default ticketTagAI;
