FROM node:22-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npx nest build

EXPOSE 3000
# Applique les migrations Prisma au démarrage avant de lancer l'API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
