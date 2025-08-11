import { Type } from '@google/genai';

const generatePromptContent = (docs, tickets, selectedAI) => {
  if (selectedAI === 'gemini') {
    return {
      prompt: `You are a specialist in generating consolidated knowledge base articles based on a list of related Zendesk support tickets. Your task is to analyze the provided documentation and Zendesk tickets, identify common issues or themes, and create comprehensive knowledge base articles summarizing the information.

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
      jsonSchema: {
        type: Type.ARRAY,
        description:
          'An array of objects containing Ticket IDs and Knowledge Base Articles',
        items: {
          type: Type.OBJECT,
          description:
            'Knowledge base articles providing information not included in the documentation.',
          properties: {
            'Ticket IDs': {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              },
              description:
                'The original Ticket ID(s) associated with this article, as an array of strings. Use an empty array if no specific ID is known.',
            },
            'Knowledge Base Article': {
              type: Type.OBJECT,
              description:
                'A single object containing question, answer and count, forming a knowledge base article.',
              properties: {
                question: {
                  type: Type.STRING,
                  description: 'A concise question that this article answers.',
                },
                answer: {
                  type: Type.STRING,
                  description:
                    'The full answer content in HTML format for this question. This string MUST be valid, well-formed HTML.',
                },
                count: {
                  type: Type.STRING,
                  description:
                    'A count of how many times this issue was present in the tickets',
                },
              },
              propertyOrdering: ['question', 'answer', 'count'],
              required: ['question', 'answer', 'count'],
            },
            tpa: {
              type: Type.STRING,
              description: 'tpa category for ticket sorting',
            },
            tpsa: {
              type: Type.STRING,
              description: 'tpsa sub category for ticket sorting',
            },

            minItems: 1,
          },
        },
        propertyOrdering: [
          'Ticket IDs',
          'Knowledge Base Article',
          'tpa',
          'tpsa',
        ],
        required: ['Ticket IDs', 'Knowledge Base Article', 'tpa', 'tpsa'],
      },
    };
  }
  if (selectedAI === 'openai') {
    return {
      prompt: [
        {
          role: 'system',
          content:
            'You are a specialist in generating consolidated knowledge base articles based on a list of related Zendesk support tickets. Your task is to analyze the provided documentation and Zendesk tickets, identify common issues or themes, and create comprehensive knowledge base articles summarizing the information.',
        },
        {
          role: 'user',
          content: `First, review the current documentation:
    
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
    
    Important notes on the JSON structure:
    - "Ticket IDs": Use the Ticket ID(s) that provided the information source for the Knowledge Base Article in the object. Use an array of strings, even if there is a single string.
    - "Knowledge Base Article": This must be a single Q&A object. It should also contain a count of how many times the issue the article is solving was present in <zendesk_tickets>.
    
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
    
    Critical JSON and HTML escaping rules:
    - The entire output must be valid and parsable JSON.
    - The 'answer' field's value must contain valid HTML. All HTML tags, attributes, and content within this string must be correct and properly structured.
    - Do not include any unescaped characters that would break the JSON string or the HTML.
    - Do not include any JSON block formatting.
    
    Your final output must be an array representing knowledge base article/s summarizing the provided tickets. Ensure that you follow all the specified structure and formatting requirements.`,
        },
      ],
      jsonSchema: {
        type: 'object',
        properties: {
          articles: {
            type: 'array',
            description:
              'An array of objects containing Ticket IDs and Knowledge Base Articles',
            items: {
              type: 'object',
              description:
                'Knowledge base articles providing information not included in the documentation.',
              properties: {
                'Ticket IDs': {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                  description:
                    'The original Ticket ID(s) associated with this article, as an array of strings. Use an empty array if no specific ID is known.',
                },
                'Knowledge Base Article': {
                  type: 'object',
                  description:
                    'A single object containing question, answer and count, forming a knowledge base article.',
                  properties: {
                    question: {
                      type: 'string',
                      description:
                        'A concise question that this article answers.',
                    },
                    answer: {
                      type: 'string',
                      description:
                        'The full answer content in HTML format for this question. This string MUST be valid, well-formed HTML.',
                    },
                    count: {
                      type: 'string',
                      description:
                        'A count of how many times this issue was present in the tickets',
                    },
                  },
                  required: ['question', 'answer', 'count'],
                  additionalProperties: false,
                },
              },
              required: ['Ticket IDs', 'Knowledge Base Article'],
              additionalProperties: false,
            },
          },
        },
        required: ['articles'],
        additionalProperties: false,
        strict: true,
      },
    };
  }
};

export default generatePromptContent;
