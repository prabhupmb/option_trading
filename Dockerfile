# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Receive the Vite build-time secret as a Docker build arg.
# Must be declared before RUN npm run build so Vite can see it.
ARG VITE_INDIA_TRADE_SECRET
ENV VITE_INDIA_TRADE_SECRET=$VITE_INDIA_TRADE_SECRET

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
