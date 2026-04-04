FROM node:22-slim

RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npx tsc -p tsconfig.build.json
RUN ls dist/src/main.js && echo "BUILD OK"

EXPOSE 3000
CMD ["node", "dist/src/main.js"]
