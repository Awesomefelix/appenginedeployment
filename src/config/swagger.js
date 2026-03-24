const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'GCP Cloud Run API',
      version: '1.0.0',
      description:
        'REST API with user authentication and profile management, deployed on GCP Cloud Run with PostgreSQL (Cloud SQL).',
      contact: {
        name: 'API Support',
        email: 'support@yourdomain.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:8080',
        description: 'Local development',
      },
      {
        url: 'https://your-cloud-run-url.run.app',
        description: 'GCP Cloud Run (production)',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token. Obtain it from /api/auth/login.',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            name: { type: 'string', example: 'Jane Doe' },
            role: { type: 'string', enum: ['user', 'admin'], example: 'user' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'An error occurred' },
            errors: {
              type: 'array',
              items: { type: 'object' },
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User profile management' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
