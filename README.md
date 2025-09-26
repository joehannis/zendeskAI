# ZendeskAI

This project is designed to integrate Zendesk, leveraging AI to enhance ticket management and documentation processes. It allows for the fetching of tickets from Zendesk, tagging them with labels using AI, and generating documentation by comparing tickets with existing KB articles.

## Getting Started

To get started with the project, follow these steps:

1. Clone the repository:

   ```bash
   git clone https://github.com/JoePendo/zendeskAI.git
   cd zendeskAI
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

To run the project locally, you need to have the following environment variables set up in a `.env` file in the root directory:

- `ZENDESK_API_TOKEN`: Your Zendesk API token.
- `ZENDESK_SUBDOMAIN`: Your Zendesk subdomain (e.g., `yourcompany`).
- `GOOGLE_API_KEY`: Google Cloud API key with access to Generative AI (this can be modified to use CLI)

Google CLI authentication is required for Firebase and Google Cloud Storage access. You can set this up by running:

```bash
gcloud auth application-default login
```

In production, this is managed by Google Cloud Run.

## Endpoints

The project exposes the following endpoints:

- `POST /`: Fetch tickets from Zendesk based on the provided filters, tag them using AI if needed, generate articles for missing documentation, upload to zendesk and store them in the database.
- `DELETE /deleteArticles`: Delete articles from the database based on the provided zendesk article IDs.

## POST '/' Request Body

- `startDate`: Format: YYYY-MM-DD. Specify the start date for fetching tickets. Default is the first day of the current month.

- `endDate `: Format: YYYY-MM-DD. Specify the end date for filtering tickets. Default is today's date.

- `tpsa`: String. Specify the technical product sub-area for filtering tickets.

- `tpa`: String. Specify the technical product area for pulling documentation.

- `docProcess`: Boolean. This will pull any new Zendesk Articles from the Knowledge base for the specified `--tpa` and and store them in the database. (`tpa` is required for this option).

- `reprocessAllDocs`: Boolean. Will reprocess all documentation from Zendesk.

- `exportTickets`: Boolean. Pull tickets from Zendesk and export to CSV.

Example request body:

```json
{
  "startDate": "2024-10-01",
  "endDate": "2025-01-31",
  "tpsa": "tpsa_hubspot_accounts"
}
```

## DELETE '/deleteArticles' Request Body

- `articleIds`: Array of Zendesk article IDs to be deleted from the database.
  Example request body:

```json
{
  "articleIds": [123456789, 987654321]
}
```

### A note on rate limiting:

This project uses AI to process tickets and articles, which may result in rate limiting by the AI provider.

The project has a local rate limiter, however, if you encounter rate limiting issues, you may need to reduce the size of your request. This can be done by narrowing the date range.

Additionally, the AI services are designed to handle rate limiting gracefully by retrying requests after a delay.

### 503 Errors:

Occasionally, Genini may throw a 503 error. This is typically a temporary issue with the service and it is overloaded. If you encounter a 503 error, please wait a few moments and try your request again.

### Request Timeouts:

Google Cloud Run has a maximum request timeout of 1 hour. If your request takes longer than this, it will be terminated. If you encounter timeout issues, please reduce the size of your request by narrowing the date range or using filters.

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
│   └── firestore/
│       └── firestoreManager.mjs
├── services/
│   ├── ai/
│   │   ├── articleAICall.mjs
│   │   ├── articleCompare.mjs
│   │   ├── articleVectorSearch.mjs
│   │   ├── generateEmbeddings.mjs
│   │   ├── ticketTagAICall.mjs
│   │   └── ticketTagAIController.mjs
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
│   ├── ragProcessing.mjs
│   ├── rateLimiter.mjs
│   ├── splitTickets.mjs
│   ├── ticketFilterLogic.mjs
│   ├── timeout.mjs
│   ├── uploadToGoogleDrive.mjs
│   └── zendeskApiPull.mjs
└── README.md
└── .gitignore
└── package.json
└── package-lock.json

- `api/`: Contains the server-side code, including controllers, routes, and server configuration.
  - `controllers/`: Contains the logic for handling requests and responses.
  - `server/`: Contains the main server file and configuration.

- `constants/`: Contains static json files with data to access our Knowledge Base and Support Tickets.

- `database/`: Contains the database configuration and models. Currently, it uses Firestore for data storage.
  - `firestore/`: Contains Firestore-specific database management code.

- `services/`: Contains business logic and service layer code.
  - `ai/`: Contains AI-related services, such as ticket tagging and comparison.
  - `zendesk/`: Contains services for interacting with Zendesk, including fetching articles and tickets, and posting articles and tags.

- `utils/`: Contains utility functions and helpers.

- `package.json`: Contains project metadata and dependencies.

- `README.md`: This file.

- `.gitignore`: Specifies files and directories to be ignored by Git.

- `package-lock.json`: Contains the exact versions of dependencies installed.
```
