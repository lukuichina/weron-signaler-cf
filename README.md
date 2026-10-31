# weron-signaler-cf

Cloudflare Workers-based signaling server for [weron](https://github.com/pojntfx/weron) VPN.

This is a lightweight WebSocket relay that enables P2P connectivity between weron clients by exchanging WebRTC offers, answers, and ICE candidates over an encrypted channel.

## Architecture

```
weron client A ──WebSocket──▶ Cloudflare Worker (RelayRoom DO) ──WebSocket──▶ weron client B
```

- **Transport**: WebSocket over Cloudflare Workers (Durable Object)
- **Encryption**: AES-256-GCM (end-to-end, key derived from `--password`)
- **Signaling**: WebRTC offer/answer + ICE candidate exchange
- **P2P**: Direct UDP connection after signaling, with NAT punch fallback via relay

## Requirements

- [Cloudflare Workers](https://workers.cloudflare.com/) account with Durable Objects enabled
- [Wrangler CLI](https://developers.cloudflare.com/wrangler/) (`npm install -g @cloudflare/wrangler`)

## Local Development

```bash
# Install dependencies
npm install

# Start local server
npx wrangler dev --ip 0.0.0.0 --port 8788
```

The server listens on `http://0.0.0.0:8788/signaler`.

## Usage

### Run a weron client

```bash
./weron.linux-x86_64 vpn ethernet \
  --community mycommunity \
  --password mypassword \
  --key mykey \
  --raddr ws://<worker-host>:8788/signaler?community=mycommunity \
  -v 7
```

### Parameters

| Flag | Description |
|------|-------------|
| `--community` | Community name (shared between peers) |
| `--password` | AES encryption password (shared between peers) |
| `--key` | Static key for key derivation |
| `--raddr` | Relay WebSocket URL |
| `-v 7` | Verbose logging (trace level) |

## Configuration

All configuration is done via `wrangler.toml`:

```toml
name = "weron-signaler-cf"
main = "src/worker.js"
compatibility_date = "2024-09-23"

[durable_objects]
bindings = [
  { name = "RELAY_ROOM", class_name = "RelayRoom" }
]

[[migrations]]
tag = "v1"
new_sqlite_classes = ["RelayRoom"]

[vars]
WS_PATH = "signaler"
HEARTBEAT_INTERVAL = "10"
RATE_LIMIT_PER_MINUTE = "120"
CACHE_SAVE_INTERVAL = "300"
LOCAL_DEPLOY = "false"
GATEWAY_NAME = "weron-signaler-cf"
ALLOW_P2P = "1"
DISABLE_RELAY = "0"
WHITE_TOKEN = ""
LOG_PASSWORD = ""
```

## Project Structure

```
src/
├── worker.js              # Worker entry point, routes WebSocket requests
└── worker/
    └── relay_room.js      # Durable Object: manages client connections and message forwarding
```

## Key Design Decisions

### BinaryMessage over TextMessage

weron clients send AES-GCM encrypted binary data over WebSocket. Cloudflare Workers Runtime performs strict UTF-8 validation on text frames, which corrupts binary payloads containing invalid UTF-8 sequences.

**Solution**: Go clients use `websocket.BinaryMessage` instead of `websocket.TextMessage`. This bypasses UTF-8 decoding entirely, ensuring encrypted bytes are transmitted intact through the relay.

See: `/root/github/weron/pkg/wrtcconn/adapter.go` line 906.

### Relay Message Forwarding

The relay does not inspect or decrypt messages. It simply forwards raw bytes between clients in the same community. Encryption is end-to-end between weron clients.

## Deployment

```bash
# Publish to Cloudflare
npx wrangler deploy
```

After deployment, the worker URL becomes available. Use it as the `--raddr` for weron clients.

## License

See the parent [weron](https://github.com/pojntfx/weron) project for licensing.