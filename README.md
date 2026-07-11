# Mattermost Slapper

A Mattermost bot that resolves music links to Spotify and Apple Music. Reply to a message containing a YouTube, Spotify, or Apple Music link with `@slapper`, and it responds with cross-platform links.

## Example

```
User: Check out this song https://youtube.com/watch?v=dQw4w9WgXcQ
User: @slapper

Slapper: 🎵 **Never Gonna Give You Up — Rick Astley**
         [Spotify](https://...) · [Apple Music](https://...)
```

Or inline:

```
User: @slapper https://youtube.com/watch?v=dQw4w9WgXcQ
```

## Architecture

```
┌─────────────────────────────────────────────┐
│  Mattermost Server                          │
│  ┌──────────────┐  ┌────────────────────┐  │
│  │  REST API    │  │  WebSocket Events  │  │
│  └──────┬───────┘  └─────────┬──────────┘  │
└─────────┼─────────────────────┼─────────────┘
          │                     │
          ▼                     ▼
┌─────────────────────────────────────────────┐
│  Slapper Bot                                │
│  ┌──────────────┐  ┌────────────────────┐  │
│  │  MM Client   │  │  WS Listener       │  │
│  └──────────────┘  └────────────────────┘  │
│  ┌──────────────┐  ┌────────────────────┐  │
│  │  URL Extract  │  │  Bot Handler       │  │
│  └──────────────┘  └────────────────────┘  │
│  ┌──────────────┐  ┌────────────────────┐  │
│  │  Odesli API  │  │  Fastify Health    │  │
│  └──────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────┘
```

The bot connects **outbound** to Mattermost via WebSocket — no public domain or inbound webhooks needed.

## Mattermost Setup

### 1. Enable Bot Accounts

Go to **System Console → Integrations → Bot Accounts** and enable bot account creation.

### 2. Create the Bot

Go to **Integrations → Bot Accounts → Add Bot Account**:

- Username: `slapper`
- Display Name: `Slapper`
- Description: `Music link resolver`
- Role: Member (not System Admin)

### 3. Copy the Bot Token

After creation, copy the access token. You will not see it again.

### 4. Add Bot to Team

Go to the team's **Members** page and add `slapper`.

### 5. Invite Bot to Channels

In each channel you want the bot to monitor, run:

```
/invite @slapper
```

The bot must be a member of every channel it watches. It cannot see messages in channels it hasn't joined.

## Environment Variables

| Variable            | Required | Default    | Description                   |
| ------------------- | -------- | ---------- | ----------------------------- |
| `MATTERMOST_URL`    | Yes      | —          | Mattermost server URL (https) |
| `MATTERMOST_TOKEN`  | Yes      | —          | Bot access token              |
| `SLAPPER_MENTION`   | No       | `@slapper` | Trigger mention               |
| `ODESLI_COUNTRY`    | No       | `US`       | Country code for Odesli       |
| `PORT`              | No       | `3000`     | Health check port             |
| `LOG_LEVEL`         | No       | `info`     | debug, info, warn, error      |
| `CACHE_TTL_SECONDS` | No       | `86400`    | URL resolution cache TTL      |

## Local Development

```bash
git clone https://github.com/Qureshi-Inc/mattermost-slapper.git
cd mattermost-slapper
npm install
cp .env.example .env
# Edit .env with your Mattermost URL and bot token
npm run dev
```

## Testing

```bash
npm test
```

Tests mock all external APIs — no credentials needed.

## Build

```bash
npm run build
npm start
```

## Docker

```bash
docker build -t mattermost-slapper .
docker run --env-file .env -p 3000:3000 mattermost-slapper
```

Or with docker-compose:

```bash
docker-compose up
```

## Coolify Deployment

1. In Coolify, create a new resource → **Docker** build pack
2. Connect the GitHub repository: `Qureshi-Inc/mattermost-slapper`
3. Set branch: `main`
4. Set build pack: **Dockerfile**
5. Add environment variables:

```env
MATTERMOST_URL=https://your-mattermost-instance.com
MATTERMOST_TOKEN=your-bot-token-here
SLAPPER_MENTION=@slapper
ODESLI_COUNTRY=US
PORT=3000
LOG_LEVEL=info
CACHE_TTL_SECONDS=86400
```

6. Set health check path: `/health`
7. No public domain is required for bot functionality — the bot connects outbound
8. Port 3000 is used for internal health checks only
9. Enable automatic deployment from the `main` branch

### Network Requirements

- The container must have outbound access to your Mattermost server and `api.song.link`
- If Mattermost uses a private hostname, the Coolify server must be able to resolve it
- If Mattermost uses a self-signed certificate, add the CA certificate to the container's trust store via a mounted volume at `/usr/local/share/ca-certificates/` and run `update-ca-certificates`. Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Supported Input URLs

- `youtube.com` / `www.youtube.com` / `m.youtube.com`
- `youtu.be`
- `music.youtube.com`
- `open.spotify.com`
- `music.apple.com`

## Troubleshooting

| Issue                     | Solution                                                               |
| ------------------------- | ---------------------------------------------------------------------- |
| Bot not responding        | Check it's invited to the channel with `/invite @slapper`              |
| WebSocket disconnecting   | Check `MATTERMOST_URL` is correct and reachable                        |
| "couldn't resolve" errors | The Odesli API may be rate-limiting or the link is unsupported         |
| Duplicate responses       | Should not happen — dedup is built in. Check logs for reconnect storms |

## Security

- Bot token is never logged or committed
- Container runs as non-root user
- TLS validation is never disabled
- External API responses are sanitized before Mattermost Markdown output
- Only `http:` and `https:` URLs are accepted from the resolver
- The bot ignores its own messages to prevent loops
- The bot does not require admin permissions

## Limitations

- Odesli/Songlink is the only resolver — if it's down, resolution fails
- In-memory cache is lost on restart (acceptable for MVP)
- No Redis or persistent storage
- Rate limits from Odesli are handled with retry but not queued

## Replacing the Resolver

The `MusicResolver` interface in `src/music/types.ts` defines the contract:

```typescript
interface MusicResolver {
  resolve(url: string): Promise<ResolvedSong | null>;
}
```

Implement this interface with any provider and swap it in `src/index.ts`.

## License

MIT
