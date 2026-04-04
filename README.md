# NYAMA API

Backend API de la marketplace de cuisine camerounaise — Douala & Yaoundé.

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Runtime | Node.js 20+ |
| Framework | NestJS (TypeScript strict) |
| Base de données | PostgreSQL 15+ avec PostGIS |
| ORM | Prisma |
| Cache / Sessions / GPS | Redis 7+ |
| WebSocket | Socket.IO |
| Auth | JWT RS256 (OTP SMS uniquement) |
| Paiements | NotchPay / CamPay (Orange Money + MTN MoMo) |
| Monnaie | FCFA (XAF) |
| Déploiement | Railway |

## Prérequis

- Node.js >= 20
- PostgreSQL >= 15 avec extension PostGIS
- Redis >= 7
- npm >= 10

## Installation locale

```bash
# 1. Cloner le dépôt
git clone https://github.com/10021987z/nyama-api.git
cd nyama-api

# 2. Installer les dépendances
npm install

# 3. Copier et configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# 4. Générer les clés RSA pour JWT
mkdir -p keys
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem

# 5. Activer PostGIS sur la base de données
psql -U postgres -d nyama_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# 6. Générer le client Prisma et appliquer les migrations
npx prisma generate
npx prisma migrate dev --name init

# 7. (Optionnel) Seed de données de test
npm run seed
```

## Démarrage

```bash
# Développement (hot reload)
npm run start:dev

# Production
npm run build
npm run start:prod
```

L'API est disponible sur `http://localhost:3000/api/v1`

## Déploiement sur Railway

### 1. Créer le projet

1. Connecter le repo GitHub sur [railway.app](https://railway.app)
2. Ajouter un service **PostgreSQL** depuis le marketplace Railway
3. Ajouter un service **Redis** depuis le marketplace Railway

### 2. Variables d'environnement

Configurer les variables suivantes dans les settings Railway (voir `.env.production.example`) :

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Auto-injectée par Railway PostgreSQL |
| `REDIS_URL` | Auto-injectée par Railway Redis |
| `JWT_SECRET` | Secret JWT (min 32 caractères) |
| `JWT_REFRESH_SECRET` | Secret refresh token (min 32 caractères) |
| `OTP_SECRET` | Secret OTP |
| `CORS_ORIGINS` | Origines autorisées (séparées par virgule) |
| `NODE_ENV` | `production` |
| `PORT` | `3000` (par défaut) |

### 3. Build et déploiement

Railway détecte automatiquement le `railway.toml` et exécute :

```
npm ci → npm run build (prisma generate + nest build) → prisma migrate deploy
```

Le service démarre avec `node dist/main.js` sur le port 3000.

### 4. Vérification

```bash
# Healthcheck
curl https://your-app.railway.app/api/v1

# Logs
railway logs
```

## Structure des modules

```
src/
├── auth/           # OTP SMS + JWT RS256 (access 15min / refresh 30j)
├── users/          # Profils utilisateurs (client, cook, rider, admin)
├── cooks/          # Profils cuisinières + zones de service
├── menu/           # Plats, catégories, disponibilité
├── orders/         # Cycle de vie commandes
├── payments/       # Orange Money + MTN MoMo via NotchPay/CamPay
├── deliveries/     # Assignation et suivi livraisons
├── riders/         # Profils benskineurs + positions GPS temps réel
├── reviews/        # Avis clients sur cuisinières et livreurs
├── notifications/  # Push notifications + SMS
└── analytics/      # Tableau de bord admin + métriques
```

## Rôles utilisateurs

| Rôle | Description |
|------|-------------|
| `client` | Commande des plats |
| `cook` | Cuisinière de quartier, gère son menu |
| `rider` | Benskineur (livreur moto) |
| `admin` | Gestion globale de la plateforme |

## Flux d'authentification

```
1. POST /api/v1/auth/otp/send    → Envoi OTP par SMS
2. POST /api/v1/auth/otp/verify  → Vérifie OTP → retourne access_token + refresh_token
3. POST /api/v1/auth/token/refresh → Renouvelle l'access token
4. POST /api/v1/auth/logout      → Révoque le refresh token
```

## Flux commande

```
PENDING → CONFIRMED → PREPARING → READY → PICKED_UP → DELIVERED
                                        ↘ CANCELLED
```

## Variables d'environnement

- Développement : voir [.env.example](.env.example)
- Production : voir [.env.production.example](.env.production.example)

## Commandes utiles

```bash
# Prisma Studio (interface graphique BDD)
npx prisma studio

# Linting
npm run lint

# Tests unitaires
npm run test

# Tests e2e
npm run test:e2e

# Vérifier la connexion Redis
redis-cli ping
```

## Villes couvertes

- **Douala** — Akwa, Bonanjo, Bonapriso, Bali, Makepe, Logpom, Ndokoti...
- **Yaoundé** — Centre-ville, Bastos, Nlongkak, Mvog-Mbi, Essos...
