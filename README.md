# ZendeskAI

This project is designed to integrate Zendesk and Jira, leveraging AI to enhance ticket management and documentation processes. It allows for the fetching of tickets from Zendesk, tagging them with labels using AI, and generating documentation by comparing tickets with existing KB articles.

# NOTE
This is a sanatised version of the production code. It requires the file `./constants/zendesk-techincal-product-areas.json` to run. This is an array of objects containing zendesk labels (technical product areas: `tpa` and technical product sub areas: `tpsa` in this case) and then relevant documentation sections from Zendesk Articles. Example Object:
```javascript
   {
    "id": 12345678,
    "type": "tagger",
    "title": "Agent Technical Product Sub-area",
    "tpa": "tpa_agent",
    "sections": [
      {
        "id": 12345678,
      },
    ],
    "custom_field_options": [
      {
        "value": "tpsa_agent_settings",
        "default": false
      },
      {
        "value": "tpsa_guide_delivery",
        "default": false
      },
      {
        "value": "tpsa_salesforce_agent_interactions",
        "default": false
      },
      {
        "value": "tpsa_session_replay",
        "default": false
      },
      {
        "value": "tpsa_agent_config",
        "default": false
      },
      {
        "value": "tpsa_snippet_install",
        "default": false
      }
    ]
  }
```
## Getting Started

To get started with the project, follow these steps:

1. Clone the repository:

   ```bash
   git clone https://github.com/joehannis/zendeskAI-public.git
   cd zendeskAI-public
   ```

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Start the server:

   ```bash
   node api/server/server.mjs
   ```

4. Server running at `http://localhost:3000`.

## Required

To run the project, you need to have the following environment variables set up in a `.env` file in the root directory:

- `ZENDESK_API_TOKEN`: Your Zendesk API token.
- `ZENDESK_SUBDOMAIN`: Your Zendesk subdomain (e.g., `yourcompany`).
- `GOOGLE_API_KEY`: Google Cloud API key with access to Generative AI (this can be modified to use CLI)

Google CLI authentication is required for Firebase and Google Cloud Storage access. You can set this up by running:

```bash
gcloud auth application-default login
```

### Optional

- `OPENAI_API_KEY`: OpenAI API key for alternative AI services.

## Query Params

- `startDate=`: Format: YYYY-MM-DD. Specify the start date for fetching tickets. Default is the first day of the current month. (Required).
- `selectedAI=`: String. Accepts 'gemini' or 'openai'. Default is 'gemini'

- `endDate=`: Format: YYYY-MM-DD. Specify the end date for filtering tickets.

- `tpsa=`: String. Specify the technical product sub-area for filtering tickets.

- `tpa=`: String. Specify the technical product area for pulling documentation.

- `docProcess=`: Boolean. Specify the document processing option. This will pull any new Zendesk Articles from the Knowledge base for the specified `--tpa` and and store them in the database. (`tpa=` is required for this option).

- `reprocess=`: Boolean. Specify the reprocessing option. This will delete all Zendesk Articles stored in the project for the supplied `tpa` and re-fetch them from the Knowledge Base. (`doc-process` && `tpa=` are required for this option).

- `exportTickets=`: Boolean. Pull tickets from Zendesk and export to CSV.

- `exportArticles=`: Boolean. Pull previously generated AI articles from Zendesk and ezport to PDF (`tpa=` is required).

**A note on rate limiting:** This project uses AI to process tickets and articles, which may result in rate limiting by the AI provider.

The project has a local rate limiter, however, if you encounter rate limiting issues, you may need to reduce the size of your request. This can be done by narrowing the date range.

Additionally, the AI services are designed to handle rate limiting gracefully by retrying requests after a delay.

## Project Structure

The project follows a standard structure:

```
ZendeskAI/
├── api/
│   ├── controllers/
│   ├── server/
├── constants/
│   ├── section-ids.json
│   └── zendesk-technical-product-areas.json
├── database/
│   └── zendeskDocs/
├── services/
│   ├── ai/
│   │   ├── articleCompare.mjs
│   │   ├── articleVectorSearch.mjs
│   │   ├── agenerateEmbeddings.mjs
│   │   └── ticketTagAI.mjs
│   ├── zendesk/
│   │   ├── docsRagIngest.mjs
│   │   ├── fetchArticles.mjs
│   │   ├── fetchDocs.mjs
│   │   ├── fetchTickets.mjs
│   └── └── postArticle.mjs
├── utils/
│   ├── dateProcessing.mjs
│   ├── exportTickets.mjs
│   ├── dateProcessing.mjs
│   ├── fetchZendeskArticlesForReview.mjs
│   ├── generatePromptContent.mjs
│   ├── ragProcessing.mjs
│   ├── rateLimiter.mjs
│   ├── splitTickets.mjs
│   ├── ticketFilterLogic.mjs
│   └── zendeskApiPull.mjs
└── README.md
└── .gitignore
└── package.json
└── package-lock.json

- `api/`: Contains the server-side code, including controllers, routes, and server configuration.
  - `controllers/`: Contains the logic for handling requests and responses.
  - `server/`: Contains the main server file and configuration.

- `constants/`: Contains static json files with data to access our Knowledge Base and Support Tickets.

- `database/`: Contains the database configuration and models. When pulling Knowledge Base documents from Zendesk Articles, they are stored here.
  - `zendeskDocs/`: Contains the Zendesk articles fetched from the Knowledge Base.

- `services/`: Contains business logic and service layer code.
  - `ai/`: Contains AI-related services, such as ticket tagging and comparison.
  - `jira/`: Contains services for fetching data from Jira.
  - `zendesk/`: Contains services for interacting with Zendesk, including fetching articles and tickets, and posting articles and tags.

- `utils/`: Contains utility functions and helpers.

- `package.json`: Contains project metadata and dependencies.

- `README.md`: This file.

- `.gitignore`: Specifies files and directories to be ignored by Git.

- `package-lock.json`: Contains the exact versions of dependencies installed.
```
