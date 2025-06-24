# Build stage
FROM node:18-alpine AS builder

# Install ffmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

# Install ffmpeg and other required tools
RUN apk add --no-cache ffmpeg tini

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application
COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p uploads logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/microservice/index.js"]