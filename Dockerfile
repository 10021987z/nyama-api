FROM node:22-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npx prisma generate
RUN npx tsc -p tsconfig.build.json || (echo "TSC FAILED" && exit 1)
RUN ls -la dist/src/main.js

EXPOSE 3000
CMD ["node", "dist/src/main.js"]
