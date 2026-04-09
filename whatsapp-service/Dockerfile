FROM node:20-slim

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy application code
COPY . .

# Create auth_info directory
RUN mkdir -p auth_info

EXPOSE 3001

CMD ["node", "index.js"]
