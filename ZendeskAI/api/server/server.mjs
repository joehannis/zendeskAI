import express from 'express';
import cors from 'cors';
import zendeskAIController from '../controllers/zendeskAIController.mjs';
import { OAuth2Client } from 'google-auth-library';
import credentials from '../../client-secret.json' with { type: 'json' };
import authorisedEmails from '../../authorizedEmails.json' with { type: 'json' };
import { deleteArticlesByZendeskId } from '../../database/firestore/firestoreManager.mjs';

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
app.use(
  cors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Authorization',
  })
);
app.set('trust proxy', true)

const port = process.env.PORT || 3000;

const defaultConfig = {
  selectedAI: 'gemini',
  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0],
  endDate: null,
  tpa: null,
  tpsa: null,
  docsProcess: false,
  reprocessAllDocs: false,
  exportTickets: false,
};

app.locals.config = defaultConfig;

const validAIs = ['default', 'gemini'];

const { client_secret, client_id, redirect_uris } = credentials.web;

const oauth2Client = new OAuth2Client({
  clientId: client_id,
  clientSecret: client_secret,
  redirectUri: redirect_uris[0], // Change to redirect_uris[1] for local testing
});


let tokens = null;

let articleIdsToDelete = null;

app.get('/auth', (req, res) => {
  const forDeleteArticles = req.query.endpoint === 'deleteArticles';
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Important: this ensures we get a refresh token
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/user.emails.read',
      'openid',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    prompt: 'consent', // Force consent screen to ensure we get refresh token
    state: forDeleteArticles ? 'deleteArticles' : 'zendeskAI',
    redirect_uri: redirect_uris[0], // Change to redirect_uris[1] for local testing
  });

  res.send(`Please click this link to authorize the application: ${authUrl}`);
});

app.get('/oauth2callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('OAuth error:', JSON.stringify(error));
    return res.status(400).send(`
      <html>
        <head><title>Authorization Denied</title></head>
        <body>
          <h1>Authorization Denied</h1>
          <p>Authorization was cancelled: ${error}</p>
          <p><a href="/auth">Try again</a></p>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send(`
      <html>
        <head><title>Authorization Error</title></head>
        <body>
          <h1>Authorization Error</h1>
          <p>Authorization code not received.</p>
          <p><a href="/auth">Try again</a></p>
        </body>
      </html>
    `);
  }

  try {
    ({ tokens } = await oauth2Client.getToken(code));
    const authenticateResponse = await fetch(
      'https://people.googleapis.com/v1/people/me?personFields=emailAddresses',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );
    const authenticateData = await authenticateResponse.json();
    const userEmail = authenticateData.emailAddresses?.[0]?.value;
    if (!userEmail || !userEmail.endsWith('@pendo.io')) {
      return res.status(403).send(`
        <html>
          <head><title>Access Denied</title></head>
          <body>
            <h1>❌ Access Denied</h1>
            <p>Your account (${
              userEmail || 'unknown'
            }) is not authorized to use this application.</p>
            <p>Please use a @pendo.io account.</p>
          </body>
        </html>
      `);
    }
    if (!authorisedEmails.includes(userEmail)) {
      return res.status(403).send(`
        <html>
          <head><title>Access Denied</title></head>
          <body>
            <h1>❌ Access Denied</h1>
            <p>Your account (${userEmail}) is not authorized to use this application.</p>
</body>
        </html>
      `);
    }

    if (tokens) {
      oauth2Client.setCredentials(tokens);
      console.log(`Starting request from ${userEmail}`);
    }
  } catch (err) {
    console.error('Error retrieving access token:', JSON.stringify(err));
    if (tokens) {
      await oauth2Client.revokeToken(tokens.refresh_token);
      console.log('Token revoked successfully.');
    }
    res.status(500).send(`
      <html>
        <head><title>Authorization Failed</title></head>
        <body>
          <h1>❌ Authorization Failed</h1>
          <p>Error: ${err.message}</p>
          <p><a href="/auth">Try again</a></p>
        </body>
      </html>
    `);
  }

  const { state } = req.query;

  if (state === 'deleteArticles') {
    try {
      const deleteResults = await deleteArticlesByZendeskId(articleIdsToDelete);
      return res.status(200).json({
        message: 'Delete operation completed.',
        results: deleteResults,
      });
    } catch (deleteError) {
      console.error('Error during article deletion:', JSON.stringify(deleteError));
      return res.status(500).json({
        message: 'An error occurred while deleting articles.',
        error: JSON.stringify(deleteError.message),
      });
    }
  }

  if (state === 'zendeskAI') {
    try {
      const response = await zendeskAIController(
        app.locals.config,
        oauth2Client
      );
      res.status(200).json({
        response: response,
        configUsed: app.locals.config,
        processStatus: 'completed',
      });
      Object.assign(app.locals.config, defaultConfig);
    } catch (processError) {
      console.error(
        'Error during Zendesk AI process initiation:',
        processError
      );
      res.status(500).json({
        message:
          'Configuration updated, but an error occurred while initiating the process.',
        error: processError.message,
        configUsed: app.locals.config,
      });
    } finally {
      // 2. Revoke the token after the job is complete, regardless of success or failure.
      if (tokens) {
        await oauth2Client.revokeToken(tokens.access_token);
        console.log('Token revoked successfully.');
        return;
      } else {
        console.log('No refresh token available to revoke.');
        return;
      }
    }
  }
});

app.post('/', async (req, res) => {
  const queryParams = req.body;

  const tempConfig = { ...app.locals.config };

  if (queryParams.selectedAI) {
    const newAI = queryParams.selectedAI.toLowerCase();
    if (!validAIs.includes(newAI)) {
      return res.status(400).json({
        error: `Invalid AI specified: '${newAI}'. Valid options are: ${validAIs.join(
          ', '
        )}`,
      });
    }
    tempConfig.selectedAI = newAI;
  }

  if (queryParams.startDate) {
    const date = new Date(queryParams.startDate);
    if (isNaN(date.getTime())) {
      return res
        .status(400)
        .json({ error: 'Invalid startDate format. Use YYYY-MM-DD.' });
    }
    tempConfig.startDate = queryParams.startDate;
  } else if (queryParams.startDate === '') {
    tempConfig.startDate = null;
  }

  if (queryParams.endDate) {
    const date = new Date(queryParams.endDate);
    if (isNaN(date.getTime())) {
      return res
        .status(400)
        .json({ error: 'Invalid endDate format. Use YYYY-MM-DD.' });
    }
    tempConfig.endDate = queryParams.endDate;
  } else if (queryParams.endDate === '') {
    tempConfig.endDate = null;
  }

  if (queryParams.tpa !== undefined) {
    tempConfig.tpa = queryParams.tpa === '' ? null : queryParams.tpa;
  }
  if (queryParams.tpsa !== undefined) {
    tempConfig.tpsa = queryParams.tpsa === '' ? null : queryParams.tpsa;
  }

  // Handle boolean flags: 'true'/'false' strings to actual booleans
  if (queryParams.docsProcess !== undefined) {
    tempConfig.docsProcess = queryParams.docsProcess === 'true';
  }
  if (queryParams.reprocessAllDocs !== undefined) {
    tempConfig.reprocessAllDocs = queryParams.reprocessAllDocs === 'true';
  }
  if (queryParams.exportTickets !== undefined) {
    tempConfig.exportTickets = queryParams.exportTickets === 'true';
  }

  try {
    if (tempConfig.tpa && tempConfig.tpsa) {
      throw new Error(
        'Configuration Error: Please only define either tpa or tpsa, not both'
      );
    }

    if (tempConfig.docsProcess && tempConfig.tpsa) {
      throw new Error(
        `Configuration Error: Please define tpa with docsPocess or no filter`
      );
    }

    if (
      (tempConfig.reprocessAllDocs && tempConfig.docsProcess) ||
      (tempConfig.reprocessAllDocs && tempConfig.tpa) ||
      (tempConfig.reprocessAllDocs && tempConfig.tpsa) ||
      (tempConfig.reprocessAllDocs && tempConfig.startDate) ||
      (tempConfig.reprocessAllDocs && tempConfig.endDate) ||
      (tempConfig.reprocessAllDocs && tempConfig.exportTickets)

    ) {
      throw new Error(
        `Configuration Error: reprocessAllDocs cannot be called without docsProcess and tpa`
      );
    }

  

    if (
      (tempConfig.exportTickets && !tempConfig.tpa && !tempConfig.tpsa) ||
      (tempConfig.exportTickets && tempConfig.docsProcess) ||
      (tempConfig.exportTickets && tempConfig.reprocessAllDocs)
    ) {
      throw new Error(
        `Configuration Error: exportTickets can only be used with tpa, tpsa, startDate and endDate`
      );
    }
   
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  Object.assign(app.locals.config, tempConfig);

  try {
    console.log(
      'Initiating Zendesk AI process with current configuration:',
      JSON.stringify(app.locals.config)
    );

    res.redirect('/auth');
    return;
  } catch (processError) {
    console.error('Error during Zendesk AI process initiation:', processError);
    res.status(500).json({
      message:
        'Configuration updated, but an error occurred while initiating the process.',
      error: processError.message,
      configUsed: app.locals.config,
    });
  }
});

app.delete('/deleteArticles', async (req, res) => {
  const { articleIds } = req.body;

  if (!Array.isArray(articleIds) || articleIds.length === 0) {
    return res
      .status(400)
      .json({ error: 'articleIds must be a non-empty array.' });
  }

  articleIdsToDelete = articleIds;


  return res.redirect('/auth?endpoint=deleteArticles');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

export default app;
