# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FitGirl Subgraph is a GraphQL subgraph service that provides an API for FitGirl game releases. It reads from the SQLite database shared with fitgirl-discord-notifier and exposes queries, mutations, and subscriptions for the dashboard-web frontend.

## Commands

```bash
bun install              # Install dependencies
bun run build            # Compile TypeScript to dist/
bun run lint             # Run Biome linter/formatter
bun run lint:fix         # Auto-fix lint issues
bun run typecheck        # Run TypeScript type checking
bun test                 # Run all tests
bun run test:coverage    # Run tests with coverage (95% threshold)
bun run start            # Run service (requires .env file)
```

Run a single test file:
```bash
bun test src/repositories/games.repository.test.ts
```

## Architecture

```
GraphQL API Flow:

Queries/Mutations ────► Apollo Server ────► GamesRepository ────► SQLite DB
                              │
                              └────► QbittorrentPublisher ────► RabbitMQ
                                                                   │
                                                                   ▼
                                                           qbittorrent.downloads.add

Subscriptions:

RabbitMQ ────► (future: progress consumer) ────► PubSub ────► GraphQL WebSocket
```

### Key Components

- **`src/index.ts`**: Service entry point. Initializes database, RabbitMQ, and starts GraphQL server.

- **`src/graphql/`**: GraphQL layer
  - `schema.ts` - Federation-compatible type definitions
  - `resolvers.ts` - Query, Mutation, Subscription resolvers
  - `server.ts` - Apollo Server + WebSocket setup
  - `pubsub.ts` - GraphQL subscriptions pubsub

- **`src/repositories/games.repository.ts`**: Data access for games table with filtering, pagination, and mutations.

- **`src/publishers/qbittorrent.publisher.ts`**: Publishes download requests to qBittorrent exchange.

- **`src/database/database.ts`**: SQLite database manager (read-write mode).

## GraphQL Operations

### Queries
- `games(filter, pagination)` - Paginated games list sorted by pub_date DESC
- `game(id, guid)` - Single game lookup
- `activeDownloads` - Games with download_started_at but no download_completed_at
- `recentGames(limit)` - Most recent games

### Mutations
- `startDownload(gameId)` - Publishes to qbittorrent exchange, updates download_started_at
- `setRating(gameId, rating)` - Updates single rating column (upvote/downvote/null)
- `updateGameName(gameId, correctedName)` - Updates corrected_name column

### Subscriptions
- `downloadProgress(gameId)` - Filtered by gameId (optional)
- `newRelease` - New game release events

## Database

Shares SQLite database with fitgirl-discord-notifier at `DATABASE_PATH`. Opens with write access for mutations.

Key columns used:
- `rating` - Single rating per game (not per user)
- `corrected_name` - User-editable name correction
- `download_started_at`, `download_completed_at` - Download status tracking

## RabbitMQ Topology

| Resource | Name |
|----------|------|
| Exchange (publish) | `qbittorrent` (topic, durable) |
| Routing key | `downloads.add` |

## Environment Variables

Required: `DATABASE_PATH`, `RABBITMQ_URL`

Optional: `GRAPHQL_PORT` (4004), `GRAPHQL_WS_PORT` (4005), `LOKI_HOST`, `LOG_LEVEL` (info)

## Federation

This service is a subgraph in the dashboard Apollo Federation gateway. The `Game` type is a federation entity with `@key(fields: "id")`.

Gateway configuration should include:
```json
{
  "name": "fitgirl",
  "url": "http://fitgirl-subgraph:4004/graphql",
  "wsUrl": "ws://fitgirl-subgraph:4005/graphql"
}
```
