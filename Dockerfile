# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# ─── Vite build-time env vars ────────────────────────────────
# Declared as ARG so they can be passed via --build-arg.
# Promoted to ENV so Vite's process.env picks them up during build.
# NEVER echo values — only check presence.
ARG VITE_INDIA_TRADE_SECRET
ARG VITE_API_KEY
ARG VITE_WEBHOOK_APPROVE_USER
ARG VITE_WEBHOOK_UPGRADE_USER
ARG VITE_WEBHOOK_PORTFOLIO_REFRESH

ENV VITE_INDIA_TRADE_SECRET=$VITE_INDIA_TRADE_SECRET \
    VITE_API_KEY=$VITE_API_KEY \
    VITE_WEBHOOK_APPROVE_USER=$VITE_WEBHOOK_APPROVE_USER \
    VITE_WEBHOOK_UPGRADE_USER=$VITE_WEBHOOK_UPGRADE_USER \
    VITE_WEBHOOK_PORTFOLIO_REFRESH=$VITE_WEBHOOK_PORTFOLIO_REFRESH

# Fail fast if the trade secret is missing
RUN if [ -z "$VITE_INDIA_TRADE_SECRET" ]; then \
      echo "ERROR: VITE_INDIA_TRADE_SECRET is empty. Pass it as a --build-arg." >&2; \
      exit 1; \
    fi && echo "VITE_INDIA_TRADE_SECRET is set (length: $(printf '%s' "$VITE_INDIA_TRADE_SECRET" | wc -c | tr -d ' '))"

# Build the app (Vite bakes import.meta.env.* here)
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 8080 (Cloud Run uses this by default)
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
