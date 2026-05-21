FROM node:20-alpine

WORKDIR /app

# Install git for git-http protocol
RUN apk add --no-cache git

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY . .

# Create necessary directories
RUN mkdir -p repositories uploads uploads/temp uploads/releases git-repos db

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start
CMD ["node", "server.js"]
