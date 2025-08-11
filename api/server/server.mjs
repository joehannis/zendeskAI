import express from 'express';
import cors from 'cors';
import zendeskAIController from '../controllers/zendeskAIController.mjs';
import bufoAIController from '../controllers/bufoAIController.mjs';

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

const port = 3000;

const defaultConfig = {
  selectedAI: 'gemini',
  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0],
  endDate: null,
  tpa: null,
  tpsa: null,
  docsProcess: false,
  reprocess: false,
  tagTickets: false,
  exportTickets: false,
  includeJira: false,
  exportArticles: false,
};

app.locals.config = defaultConfig;

const validAIs = ['default', 'gemini', 'openai'];

app.post('/', async (req, res) => {
  const queryParams = req.query;

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
  if (queryParams.reprocess !== undefined) {
    tempConfig.reprocess = queryParams.reprocess === 'true';
  }
  if (queryParams.tagTickets !== undefined) {
    tempConfig.tagTickets = queryParams.tagTickets === 'true';
  }
  if (queryParams.exportTickets !== undefined) {
    tempConfig.exportTickets = queryParams.exportTickets === 'true';
  }
  if (queryParams.includeJira !== undefined) {
    tempConfig.includeJira = queryParams.includeJira === 'true';
  }
  if (queryParams.exportArticles !== undefined) {
    tempConfig.exportArticles = queryParams.exportArticles === 'true';
  }

  // --- Apply all your original validation rules on the tempConfig before committing ---
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
      (tempConfig.reprocess && !tempConfig.docsProcess) ||
      (tempConfig.reprocess && !tempConfig.tpa) ||
      (tempConfig.reprocess && tempConfig.tpsa)
    ) {
      throw new Error(
        `Configuration Error: reprocess cannot be called without docsProcess and tpa`
      );
    }

    if (
      (tempConfig.tagTickets && tempConfig.docsProcess) ||
      (tempConfig.tagTickets && tempConfig.tpa) ||
      (tempConfig.tagTickets && tempConfig.tpsa)
    ) {
      throw new Error(
        `Configuration Error: tagTickets can only apply to tickets with no product area or partially missing product area data. Cannot be called with tpa or tpsa`
      );
    }

    if (
      (tempConfig.exportTickets && !tempConfig.tpa && !tempConfig.tpsa) ||
      (tempConfig.exportTickets && tempConfig.docsProcess) ||
      (tempConfig.exportTickets && tempConfig.reprocess) ||
      (tempConfig.exportTickets && tempConfig.tagTickets)
    ) {
      throw new Error(
        `Configuration Error: exportTickets can only be used with tpa, tpsa, startDate and endDate`
      );
    }
    if (tempConfig.exportArticles && !tempConfig.tpa) {
      throw new Error(
        `Configuration Error: exportArticles can only be used with tpa`
      );
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  Object.assign(app.locals.config, tempConfig);

  try {
    console.log(
      'Initiating Zendesk AI process with current configuration:',
      app.locals.config
    );

    const articles = await zendeskAIController(app.locals.config);
    res.status(200).json({
      response: articles,
      configUsed: app.locals.config,
      processStatus: 'completed',
    });
    Object.assign(app.locals.config, defaultConfig);
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

app.get('/bufoai', async (req, res) => {
  const response = await bufoAIController(req);
  res.status(200).json({ processStatus: 'completed', response: response });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

export default app;
