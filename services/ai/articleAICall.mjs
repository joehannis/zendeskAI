import path from 'path';
import dotenv from 'dotenv';
import { dispatcher } from '../../utils/timeout.mjs';

const __filename = process.argv[1];
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

const articleAICall = async (docs, tickets, url) => {
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
          contents: [
            {
              parts: [
                {
                  text: `You are a specialist in generating consolidated knowledge base articles based on a list of related Zendesk support tickets. Your task is to analyze the provided documentation and Zendesk tickets, identify common issues or themes, and create comprehensive knowledge base articles summarizing the information.

First, review the current documentation:

<documentation>
${JSON.stringify(docs, null, 2)}
</documentation>

Next, analyze the content of the Zendesk tickets:

<zendesk_tickets>
${JSON.stringify(tickets, null, 2)}
</zendesk_tickets>

To complete this task, follow these steps:

1. Carefully review the documentation and Zendesk tickets content.
2. Identify common issues, themes, or questions that are not adequately addressed in the current documentation.
3. Create an array of JSON objects that represent complete knowledge base articles summarizing the provided tickets.
4. Some tickets may be spam. If you identify any spam tickets, please exclude them from the analysis.

Important notes on the JSON structure:
- "Ticket IDs": Use the Ticket ID(s) that provided the information source for the Knowledge Base Article in the object. Use an array of strings, even if there is a single string.
- "Knowledge Base Article": This must be a single Q&A object. It should also contain a count of how many times the issue the article is solving was present in <zendesk_tickets>.
- "tpa": Every ticket contains this field and tickets are grouped by this. Do not edit it, just return the value.
- "tpsa": Every ticket contains this field and tickets are grouped by this. Do not edit it, just return the value.

When generating the article:
1. For each distinct question or sub-topic identified from the tickets, create a separate object.
2. Formulate clear, concise questions for the "question" field of each object.
3. Provide step-by-step solutions or explanations in HTML format for the "answer" field, using only tags that Zendesk considers safe for its articles. Make the answer concise and easy to understand.
4. Do not consolidate multiple questions into one article. Each article should be a single question, and a single answer.
5. Use clear, concise, easy-to-understand, professional, and friendly language.
6. If applicable, mention including screenshots, diagrams, or videos in the 'answer' text (e.g., "See Figure 1 for a screenshot.").
7. Recommend adding links by including valid HTML <a> tags with href attributes.
8. Ensure that the content of the question and answer is not already included in the output within another object.
9. Do not include any references to a specific ticket number or tpa/tpsa code in the question or answer.
10. Name the JSON key in exactly the same string as the schema. All objects should have the same format. For example, use 'Knowledge Base Article' as a key, DO NOT use 'knowledge_base_article'

Critical JSON and HTML escaping rules:
- The entire output must be valid and parsable JSON.
- The 'answer' field's value must contain valid HTML. All HTML tags, attributes, and content within this string must be correct and properly structured.
- Do not include any unescaped characters that would break the JSON string or the HTML.
- Do not include any JSON block formatting.

Your final output must be an array representing knowledge base article/s summarizing the provided tickets. Ensure that you follow all the specified structure and formatting requirements. Do not add anything other than valid, parsable JSON to the output`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'ARRAY',
              description:
                'An array of objects containing Ticket IDs and Knowledge Base Articles',

              minItems: 1,
              items: {
                type: 'OBJECT',
                description:
                  'Knowledge base articles providing information not included in the documentation.',
                properties: {
                  'Ticket IDs': {
                    type: 'ARRAY',
                    items: {
                      type: 'STRING',
                    },
                    description:
                      'The original Ticket ID(s) associated with this article, as an array of strings. Use an empty array if no specific ID is known.',
                  },
                  'Knowledge Base Article': {
                    type: 'OBJECT',
                    description:
                      'A single object containing question, answer and count, forming a knowledge base article.',
                    properties: {
                      question: {
                        type: 'STRING',
                        description:
                          'A concise question that this article answers.',
                      },
                      answer: {
                        type: 'STRING',
                        description:
                          'The full answer content in HTML format for this question. This string MUST be valid, well-formed HTML.',
                      },
                      count: {
                        type: 'STRING',
                        description:
                          'A count of how many times this issue was present in the tickets',
                      },
                    },
                    propertyOrdering: ['question', 'answer', 'count'],
                    required: ['question', 'answer', 'count'],
                  },
                  tpa: {
                    type: 'STRING',
                    description: 'tpa category for ticket sorting',
                  },
                  tpsa: {
                    type: 'STRING',
                    description: 'tpsa sub category for ticket sorting',
                  },
                },
                propertyOrdering: [
                  'Ticket IDs',
                  'Knowledge Base Article',
                  'tpa',
                  'tpsa',
                ],
                required: [
                  'Ticket IDs',
                  'Knowledge Base Article',
                  'tpa',
                  'tpsa',
                ],
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
                  text: `You are a specialist in generating consolidated knowledge base articles based on a list of related Zendesk support tickets. Your task is to analyze the provided documentation and Zendesk tickets, identify common issues or themes, and create comprehensive knowledge base articles summarizing the information.

First, review the current documentation:

<documentation>
${JSON.stringify(docs, null, 2)}
</documentation>

Next, analyze the content of the Zendesk tickets:

<zendesk_tickets>
${JSON.stringify(tickets, null, 2)}
</zendesk_tickets>

To complete this task, follow these steps:

1. Carefully review the documentation and Zendesk tickets content.
2. Identify common issues, themes, or questions that are not adequately addressed in the current documentation.
3. Create an array of JSON objects that represent complete knowledge base articles summarizing the provided tickets.
4. Some tickets may be spam. If you identify any spam tickets, please exclude them from the analysis.
5. Do not include any customer-specific information in the articles, such as email addresses, names or identifiers.

Important notes on the JSON structure:
- "Ticket IDs": Use the Ticket ID(s) that provided the information source for the Knowledge Base Article in the object. Use an array of strings, even if there is a single string.
- "Knowledge Base Article": This must be a single Q&A object. It should also contain a count of how many times the issue the article is solving was present in <zendesk_tickets>.
- "tpa": Every ticket contains this field and tickets are grouped by this. Do not edit it, just return the value.
- "tpsa": Every ticket contains this field and tickets are grouped by this. Do not edit it, just return the value.

When generating the article:
1. For each distinct question or sub-topic identified from the tickets, create a separate object.
2. Formulate clear, concise questions for the "question" field of each object.
3. Provide step-by-step solutions or explanations in HTML format for the "answer" field, using only tags that Zendesk considers safe for its articles. Make the answer concise and easy to understand.
4. Do not consolidate multiple questions into one article. Each article should be a single question, and a single answer.
5. Use clear, concise, easy-to-understand, professional, and friendly language.
6. If applicable, mention including screenshots, diagrams, or videos in the 'answer' text (e.g., "See Figure 1 for a screenshot.").
7. Recommend adding links by including valid HTML <a> tags with href attributes.
8. Ensure that the content of the question and answer is not already included in the output within another object.
9. Do not include any references to a specific ticket number or tpa/tpsa code in the question or answer.
10. Name the JSON key in exactly the same string as the schema. All objects should have the same format. For example, use 'Knowledge Base Article' as a key, DO NOT use 'knowledge_base_article'

Critical JSON and HTML escaping rules:
- The entire output must be valid and parsable JSON.
- The 'answer' field's value must contain valid HTML. All HTML tags, attributes, and content within this string must be correct and properly structured.
- Do not include any unescaped characters that would break the JSON string or the HTML.
- Do not include any JSON block formatting.

Your final output must be an array representing knowledge base article/s summarizing the provided tickets. Ensure that you follow all the specified structure and formatting requirements. Do not add anything other than valid, parsable JSON to the output`,
                },
              ],
            },
          ],
        }),
      });
    }
    if (!result.ok) {
      const errorText = await result.text();
      console.error(
        JSON.stringify(`API Error: ${result.status} ${result.statusText}`)
      );
      console.error(JSON.stringify(`Error Body: ${errorText}`));
      return null;
    }

    const data = await result.json();
    return data;
  } catch (error) {
    console.error(
      JSON.stringify('An error occurred during the API call:', error)
    );
    return null;
  }
};

export default articleAICall;
