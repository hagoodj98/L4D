# Left 4 Dead Community Redesign

This project started as a college redesign assignment.

At first, it was a fully static website with no backend, and the forum content was hardcoded. The goal was to pick an existing site and redesign it. I chose a Left 4 Dead-themed site and rebuilt it with a stronger UI, authentication, and a real database-backed forum.

## What It Is Now

- Express + EJS web app
- PostgreSQL-backed forum posts, replies, and reactions
- Session-based auth with Passport (local + OAuth routes for Google, Twitch, and Discord)
- Unit/integration tests with Vitest and browser E2E tests with Playwright

## Prerequisites

- Node.js 20+
- npm
- PostgreSQL 16+ (or a compatible version)
- `psql` CLI available in your PATH
- Docker Desktop (optional, recommended for consistent setup)

## 1. Install Dependencies

```bash
npm install
```

## 2. Create Environment Variables

Create a `.env` file in the project root:

```env
PG_USER=postgres
PG_HOST=localhost
PG_DATABASE=forum
PG_PASSWORD=postgres
PG_PORT=5432
SESSION_SECRET=replace-with-a-strong-secret

# Optional for local provider auth testing
GOOGLE_CLIENT_ID=test-google-client-id
GOOGLE_CLIENT_SECRET=test-google-client-secret
TWITCH_CLIENT_ID=test-twitch-client-id
TWITCH_CLIENT_SECRET=test-twitch-client-secret
DISCORD_CLIENT_ID=test-discord-client-id
DISCORD_CLIENT_SECRET=test-discord-client-secret
```

## 3. Initialize the Database

Make sure your Postgres server is running and that the `forum` database exists, then run:

```bash
npm run db:init
```

If needed, create the database first:

```bash
createdb forum
```

## 4. Start the Application

Development mode (with auto-restart):

```bash
npm run dev
```

Production-style run:

```bash
npm start
```

The app runs on:

- `http://localhost:3000`

## Run Postgres With Docker (Recommended)

This repo uses `docker-compose.yml` to run only PostgreSQL in Docker.
The Node.js app still runs locally with `npm run dev` or `npm start`.

### 1. Keep your `.env` in project root

Use the same `.env` keys shown above.
Keep `PG_HOST=localhost` so your local Node app can connect to the DB container.

### 2. Start PostgreSQL container

```bash
docker compose up -d db
```

### 3. Start the app locally

```bash
npm run dev
```

Then open:

- `http://localhost:3000`

### 4. Stop containers

```bash
docker compose down
```

### 5. Reset database volume (optional clean slate)

```bash
docker compose down -v
```

On first boot with a fresh volume, Postgres auto-runs `db/init.sql` from the compose mount.

## Useful Commands

Run linting:

```bash
npm run lint
```

Run unit/integration tests:

```bash
npm test
```

Run end-to-end tests:

```bash
npm run test:e2e
```

## Notes

- In test/CI environments, provider credentials can use placeholder values.
- If you want full live OAuth sign-in, use real provider client IDs/secrets and matching callback URLs.

## DB Troubleshooting

If `npm run db:init` fails with an error like:

```text
psql: error: could not translate host name "-U" to address
```

that means your shell variables were empty when `psql` arguments were built.

This project now uses a Node-based `db:init` script that loads `.env` automatically. To fix:

1. Confirm your `.env` file exists in the project root and includes:
   - `PG_HOST`
   - `PG_USER`
   - `PG_DATABASE`
   - `PG_PASSWORD`
   - `PG_PORT`
2. Run:

```bash
npm run db:init
```

If your app crashes with:

```text
error: relation "posts" does not exist
```

your schema has not been initialized yet. Run `npm run db:init` first, then restart the app.
