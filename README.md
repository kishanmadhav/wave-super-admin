# Wave Super Admin Portal

Internal platform operator console for Wave — manage users, catalog, pipelines, disputes, wallets, and system configuration.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Radix UI |
| Backend | NestJS 11 · TypeScript |
| Database / Auth | Supabase (shared with Wave CMS Portal) |

## Ports

| Service | Port |
|---|---|
| Frontend (Next.js) | `3002` |
| Backend (NestJS) | `3003` |
| CMS Portal (ref) | `3000` |
| CMS Backend (ref) | `3001` |

## Getting started

### 1. Frontend

```bash
cd frontend
# copy .env.example → .env and fill in values
npm install
npm run dev        # http://localhost:3002
```

### 2. Backend

```bash
cd backend
# copy .env.example → .env and fill in values
npm install
npm run start:dev  # http://localhost:3003
# Swagger docs → http://localhost:3003/api/docs
```

### 3. Seed admin users

```bash
cd backend
node ../scripts/seed-admins.mjs
```

## Environment variables

### Frontend (`frontend/.env`)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=http://localhost:3003
```

### Backend (`backend/.env`)

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
PORT=3003
FRONTEND_URL=http://localhost:3002
```

## Login flow

1. User submits email + password on `/login`
2. Frontend calls `supabase.auth.signInWithPassword` → Supabase JWT
3. Frontend calls `GET /auth/me` on the backend with the JWT
4. Backend's `AdminAuthGuard` verifies the JWT via Supabase JWKS and checks `admin_users` table
5. If active admin → returns role + permissions → redirect to `/overview`

## Pages

| Route | Description |
|---|---|
| `/login` | Admin sign-in |
| `/overview` | Operations cockpit — KPIs, alerts, queue counts |
| `/users` | User list with search / filter / suspend / ban |
| `/users/[id]` | User detail — releases, ledger, disputes, notes |
| `/creators` | Artists and Labels |
| `/catalog` | Releases + Tracks with metadata scores |
| `/pipelines` | Creator verification & release review queues |
| `/disputes` | Dispute case management |
| `/disputes/[id]` | Dispute detail with actions |
| `/wallets` | Ledger explorer, fan wallets, manual adjustments |
| `/system` | Platform parameters, feature flags, taxonomies |
| `/audit` | Full audit trail |

## Database

Requires `schema-4.sql` to be applied on top of the Wave CMS Portal schema.  
Located at: `../wave-cms-portal/db/schema-4.sql`
