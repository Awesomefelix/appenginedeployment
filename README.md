# GCP Cloud Run API

A production-ready Node.js/Express REST API with JWT authentication, PostgreSQL (Cloud SQL), Swagger docs, and Docker — designed for deployment on GCP Cloud Run.

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | Public | Create account |
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/auth/forgot-password` | Public | Request password reset |
| GET | `/api/users/me` | JWT | Get own profile |
| PATCH | `/api/users/me` | JWT | Update own profile |
| DELETE | `/api/users/me` | JWT | Delete own account |
| GET | `/api/users` | JWT + Admin | List all users (paginated) |
| GET | `/health` | Public | Health check |
| GET | `/api-docs` | Public | Swagger UI |

---

## Local Development

### Prerequisites
- Node.js 20+
- PostgreSQL running locally

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your local DB credentials and a JWT_SECRET

# 3. Run database migrations
npm run migrate

# 4. Start dev server
npm run dev
```

Swagger docs will be at: http://localhost:8080/api-docs

---

## Docker

```bash
# Build image
docker build -t gcp-api .

# Run locally (with local Postgres)
docker run -p 8080:8080 \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=5432 \
  -e DB_NAME=your_db \
  -e DB_USER=your_user \
  -e DB_PASSWORD=your_password \
  -e JWT_SECRET=your_secret \
  -e NODE_ENV=development \
  gcp-api
```

---

## GCP Cloud Run Deployment

### Step 1 — Prerequisites

```bash
# Install and authenticate gcloud CLI
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### Step 2 — Enable required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  containerregistry.googleapis.com
```

### Step 3 — Create Cloud SQL (PostgreSQL) instance

```bash
gcloud sql instances create your-instance-name \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create your_db_name \
  --instance=your-instance-name

# Create user
gcloud sql users create your_db_user \
  --instance=your-instance-name \
  --password=YOUR_DB_PASSWORD
```

### Step 4 — Store secrets in Secret Manager

```bash
echo -n "YOUR_DB_PASSWORD" | gcloud secrets create DB_PASSWORD --data-file=-
echo -n "your_db_name"     | gcloud secrets create DB_NAME --data-file=-
echo -n "your_db_user"     | gcloud secrets create DB_USER --data-file=-
echo -n "YOUR_PROJECT_ID:us-central1:your-instance-name" \
  | gcloud secrets create CLOUD_SQL_INSTANCE_CONNECTION_NAME --data-file=-
openssl rand -base64 64 | gcloud secrets create JWT_SECRET --data-file=-
```

### Step 5 — Grant Cloud Run access to secrets

```bash
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

### Step 6 — Build and deploy

```bash
# Option A: Manual deploy
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/gcp-api
gcloud run deploy gcp-api \
  --image gcr.io/YOUR_PROJECT_ID/gcp-api \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances YOUR_PROJECT_ID:us-central1:your-instance-name \
  --set-env-vars NODE_ENV=production \
  --set-secrets DB_PASSWORD=DB_PASSWORD:latest,JWT_SECRET=JWT_SECRET:latest,DB_NAME=DB_NAME:latest,DB_USER=DB_USER:latest,CLOUD_SQL_INSTANCE_CONNECTION_NAME=CLOUD_SQL_INSTANCE_CONNECTION_NAME:latest

# Option B: CI/CD via Cloud Build (edit cloudbuild.yaml substitutions first)
gcloud builds submit --config cloudbuild.yaml
```

### Step 7 — Run migrations on Cloud SQL

```bash
# Connect via Cloud SQL Auth Proxy to run migrations from your machine
cloud-sql-proxy YOUR_PROJECT_ID:us-central1:your-instance-name &
DB_HOST=127.0.0.1 npm run migrate
```

### Step 8 — Get your service URL

```bash
gcloud run services describe gcp-api --region us-central1 --format='value(status.url)'
```

Update `servers` in `src/config/swagger.js` with your Cloud Run URL.

---

## Making a User an Admin

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@yourdomain.com';
```

---

## Project Structure

```
gcp-api/
├── src/
│   ├── index.js                  # Express app entry point
│   ├── config/
│   │   ├── database.js           # PostgreSQL pool (TCP dev / Unix socket prod)
│   │   └── swagger.js            # OpenAPI spec config
│   ├── controllers/
│   │   ├── authController.js     # register, login, forgotPassword
│   │   └── usersController.js    # getProfile, updateProfile, deleteAccount, listUsers
│   ├── middleware/
│   │   ├── auth.js               # JWT authenticate + requireAdmin
│   │   └── errorHandler.js       # Global error handler
│   ├── routes/
│   │   ├── auth.js               # /api/auth/* (with Swagger JSDoc)
│   │   └── users.js              # /api/users/* (with Swagger JSDoc)
│   └── utils/
│       └── logger.js             # Winston logger (JSON in prod for Cloud Logging)
├── scripts/
│   └── migrate.js                # DB schema migrations
├── Dockerfile                    # Multi-stage production build
├── .dockerignore
├── cloudbuild.yaml               # GCP Cloud Build CI/CD
├── .env.example
└── README.md
```
