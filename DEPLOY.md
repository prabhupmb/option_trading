# Deploy to Google Cloud Run

## Prerequisites
1. **Google Cloud SDK** installed (`gcloud` CLI)
2. **Docker** installed (for local testing, optional)
3. **Google Cloud Project** with billing enabled

## Quick Deploy Steps

### 1. Authenticate with Google Cloud
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 2. Enable Required APIs
```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

### 3. Deploy to Cloud Run (One Command)
```bash
gcloud run deploy signal-feed-ai \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

This command will:
- Build your Docker image automatically
- Push it to Artifact Registry
- Deploy it to Cloud Run

### 4. Get Your App URL
After deployment, you'll see a URL like:
```
https://signal-feed-ai-xxxxx-uc.a.run.app
```

## Optional: Local Testing with Docker
```bash
# Build the image
docker build -t signal-feed-ai .

# Run locally
docker run -p 8080:8080 signal-feed-ai

# Open http://localhost:8080
```

## Environment Variables (if needed)
If your app needs environment variables:
```bash
gcloud run deploy signal-feed-ai \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "API_KEY=your-key"
```
