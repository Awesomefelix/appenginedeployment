require('dotenv').config();

const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 8080;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// ─── Swagger UI ───────────────────────────────────────────────────────────────
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'GCP API Docs',
    swaggerOptions: { persistAuthorization: true },
  })
);

app.get('/api-docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

app.use(errorHandler);

// ─── Secret Manager ───────────────────────────────────────────────────────────
async function loadSecrets() {
  // Only fetch from Secret Manager in production
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Skipping Secret Manager — using .env file');
    return;
  }

  const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
  const client = new SecretManagerServiceClient();
  const PROJECT_ID = 'project-e850148f-e9b2-4456-99d';

  async function getSecret(name) {
    const [version] = await client.accessSecretVersion({
      name: `projects/${PROJECT_ID}/secrets/${name}/versions/latest`,
    });
    return version.payload.data.toString('utf8');
  }

  logger.info('Loading secrets from Secret Manager...');

  const [
    dbPassword,
    dbUser,
    dbName,
    jwtSecret,
    cloudSqlInstance,
  ] = await Promise.all([
    getSecret('DB_PASSWORD'),
    getSecret('DB_USER'),
    getSecret('DB_NAME'),
    getSecret('JWT_SECRET'),
    getSecret('CLOUD_SQL_INSTANCE_CONNECTION_NAME'),
  ]);

  process.env.DB_PASSWORD                      = dbPassword;
  process.env.DB_USER                          = dbUser;
  process.env.DB_NAME                          = dbName;
  process.env.JWT_SECRET                       = jwtSecret;
  process.env.CLOUD_SQL_INSTANCE_CONNECTION_NAME = cloudSqlInstance;

  logger.info('Secrets loaded successfully');
}

// ─── Start ────────────────────────────────────────────────────────────────────
async function bootstrap() {
  try {
    await loadSecrets();

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Swagger docs: http://localhost:${PORT}/api-docs`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();

module.exports = app;