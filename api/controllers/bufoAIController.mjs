import generateEmbeddings from '../../services/ai/generateEmbeddings.mjs';
import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { hierarchicalVectorSearch } from '../../database/firestore/firestoreManager.mjs';
import zendeskApiPull from '../../utils/zendeskApiPull.mjs';

const __filename = process.argv[1];

const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const bufoAIController = async (req, res) => {
  console.log('bufoAI called');
  const params = req.query;
  if (params.auto) {
    const commentsObject = await zendeskApiPull(
      `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/tickets/${params.ticketId}/comments.json`,
      'GET'
    );

    const ticketComments = commentsObject.comments
      .map((comment) => {
        return `${comment.plain_body} \n\n`;
      })
      .join(' ');

    const questionPrompt = `Take this ticket thread and summarise the contents into a question for an AI agent to answer: ${ticketComments}. Do not include any customer information the the response and just respond with the question.`;
    const aiQuestion = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: questionPrompt,
    });

    const embedding = await generateEmbeddings(
      ai,
      aiQuestion.text,
      'QUESTION_ANSWERING'
    );

    console.log('Generating response');

    const results = await hierarchicalVectorSearch(
      embedding,
      'retrievalEmbedding',
      0.7,
      true
    );

    const textArray = results.data.map((result) => {
      return result.fullDocText
        ? result.fullDocText
        : result.fullArticleText
        ? result.fullArticleText
        : result.sectionText
        ? result.sectionText
        : result.chunkText
        ? result.chunkText
        : console.log(result);
    });

    const answerPrompt = `You are an expert Support Engineer for our product. Your task is to answer questions from other support engineers using the provided documentation. Follow these instructions carefully:

    1. Review the following documents related to our product:
    <documents>
    ${textArray}
    </documents>

    2. You will be answering this question from another support engineer:
    <question>
    ${aiQuestion.text}
    </question>

    3. Analyze the documents:
       - Carefully read through each document in the array.
       - Identify key information relevant to the question.
       - Note any specific features, troubleshooting steps, or technical details that may be useful.

    4. Formulate your answer:
       - Use only information found in the provided documents.
       - If the exact answer isn't in the documents, retutn "No Answer Found"
       - If there's not enough information to answer the question, state this clearly.
       - Maintain a professional and knowledgeable tone.

    5. Before providing your final answer, use a <scratchpad> to organize your thoughts and relevant information from the documents. This will help you structure a comprehensive response.

    6. Provide your answer in the following format:
       <answer>
       [Your detailed response here. Include specific references to the documents where appropriate, but do not quote directly. Explain technical concepts clearly, assuming the other support engineer has a good understanding of the product.]
       </answer>

       <confidence>
       [State your confidence level in your answer on a scale of 1-10, where 1 is least confident and 10 is most confident. Briefly explain why you chose this confidence level.]
       </confidence>

       <further_steps>
       [If applicable, suggest any further steps the support engineer should take, such as additional documentation to consult or escalation procedures.]
       </further_steps>

    Remember, your goal is to provide accurate, helpful information based solely on the provided documents. Do not include information from external sources or personal knowledge outside of what's given in the documents.`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: answerPrompt,
    });

    console.log('Response sent');

    return { sources: results.sources, aiResponse: aiResponse.text };
  }

  // if (params.question) {
  //   const question = req.body.question;
  //   const embedding = await generateEmbeddings(
  //     ai,
  //     question,
  //     'QUESTION_ANSWERING'
  //   );

  //   const results = await hierarchicalVectorSearch(
  //     embedding,
  //     'retrievalEmbedding',
  //     0.7,
  //     true
  //   );

  //   const textArray = results.data.map((result) => {
  //     return result.fullDocText
  //       ? result.fullDocText
  //       : result.fullArticleText
  //       ? result.fullArticleText
  //       : result.sectionText
  //       ? result.sectionText
  //       : result.chunkText
  //       ? result.chunkText
  //       : console.log(result);
  //   });

  //   console.log(textArray);

  // const prompt = `You are an expert Support Engineer for our product. Your task is to answer questions from other support engineers using the provided documentation. Follow these instructions carefully:

  // 1. Review the following documents related to our product:
  // <documents>
  // ${textArray}
  // </documents>

  // 2. You will be answering this question from another support engineer:
  // <question>
  // ${question}
  // </question>

  // 3. Analyze the documents:
  //    - Carefully read through each document in the array.
  //    - Identify key information relevant to the question.
  //    - Note any specific features, troubleshooting steps, or technical details that may be useful.

  // 4. Formulate your answer:
  //    - Use only information found in the provided documents.
  //    - If the exact answer isn't in the documents, retutn "No Answer Found"
  //    - If there's not enough information to answer the question, state this clearly.
  //    - Maintain a professional and knowledgeable tone.

  // 5. Before providing your final answer, use a <scratchpad> to organize your thoughts and relevant information from the documents. This will help you structure a comprehensive response.

  // 6. Provide your answer in the following format:
  //    <answer>
  //    [Your detailed response here. Include specific references to the documents where appropriate, but do not quote directly. Explain technical concepts clearly, assuming the other support engineer has a good understanding of the product.]
  //    </answer>

  //    <confidence>
  //    [State your confidence level in your answer on a scale of 1-10, where 1 is least confident and 10 is most confident. Briefly explain why you chose this confidence level.]
  //    </confidence>

  //    <further_steps>
  //    [If applicable, suggest any further steps the support engineer should take, such as additional documentation to consult or escalation procedures.]
  //    </further_steps>

  // Remember, your goal is to provide accurate, helpful information based solely on the provided documents. Do not include information from external sources or personal knowledge outside of what's given in the documents.`;

  //   const aiResponse = await ai.models.generateContent({
  //     model: 'gemini-2.5-pro',
  //     contents: prompt,
  //   });

  //   return { sources: results.sources, aiResponse: aiResponse };
  // }
};

export default bufoAIController;
