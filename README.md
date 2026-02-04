# fitgirl-subgraph

GraphQL subgraph service for FitGirl game releases. Provides queries, mutations, and subscriptions for the dashboard plugin.

## Links

- [GitHub](https://github.com/Xmerr/fitgirl-subgraph)
- [Docker Hub](https://hub.docker.com/r/xmer/fitgirl-subgraph)

## Quick Start

```bash
docker run -d \
  -e DATABASE_PATH=/app/data/fitgirl.db \
  -e RABBITMQ_URL=amqp://user:pass@host:5672 \
  -v fitgirl-data:/app/data \
  -p 4004:4004 \
  -p 4005:4005 \
  xmer/fitgirl-subgraph:latest
```

## Docker Compose

```yaml
services:
  fitgirl-subgraph:
    image: xmer/fitgirl-subgraph:latest
    container_name: fitgirl-subgraph
    restart: unless-stopped
    environment:
      - DATABASE_PATH=/app/data/fitgirl.db
      - RABBITMQ_URL=${RABBITMQ_URL}
      - GRAPHQL_PORT=4004
      - GRAPHQL_WS_PORT=4005
      - LOKI_HOST=${LOKI_HOST:-}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    volumes:
      - fitgirl-data:/app/data
    ports:
      - "4004:4004"
      - "4005:4005"
    networks:
      - dashboard

volumes:
  fitgirl-data:
    external: true

networks:
  dashboard:
    external: true
```

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_PATH` | Yes | Path to SQLite database (shared with fitgirl-discord-notifier) | `/app/data/fitgirl.db` |
| `RABBITMQ_URL` | Yes | AMQP connection URI | `amqp://user:pass@host:5672` |
| `GRAPHQL_PORT` | No | HTTP GraphQL port | `4004` |
| `GRAPHQL_WS_PORT` | No | WebSocket port for subscriptions | `4005` |
| `LOKI_HOST` | No | Grafana Loki endpoint | `http://loki:3100` |
| `LOG_LEVEL` | No | Log level | `info` |

## Ports

| Port | Purpose |
|------|---------|
| 4004 | HTTP GraphQL endpoint |
| 4005 | WebSocket endpoint for subscriptions |

## Volumes

| Volume | Required | Description |
|--------|----------|-------------|
| `/app/data` | Yes | SQLite database storage (shared with fitgirl-discord-notifier) |

## GraphQL Schema

### Queries

- `games(filter, pagination)` - List games sorted by pub_date descending
- `game(id, guid)` - Get single game by ID or GUID
- `activeDownloads` - Get games currently downloading
- `recentGames(limit)` - Get most recent games

### Mutations

- `startDownload(gameId)` - Start downloading via qBittorrent
- `setRating(gameId, rating)` - Set game rating (upvote/downvote/null)
- `updateGameName(gameId, correctedName)` - Update corrected name

### Subscriptions

- `downloadProgress(gameId)` - Subscribe to download progress events
- `newRelease` - Subscribe to new game releases

## How to Run

### Development

```bash
bun install
bun run start
```

### Production

Use Docker or the Docker Compose configuration above.

## Federation

This service is designed to work as a subgraph in an Apollo Federation gateway. Configure the gateway to include:

```json
{
  "name": "fitgirl",
  "url": "http://fitgirl-subgraph:4004/graphql",
  "wsUrl": "ws://fitgirl-subgraph:4005/graphql"
}
```
