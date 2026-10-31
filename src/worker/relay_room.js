export class RelayRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Map();
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    const id = crypto.randomUUID();
    this.clients.set(id, { ws: server, connectedAt: Date.now() });
    console.log(`[DO] client connected: ${id}, total: ${this.clients.size}`);

    server.addEventListener("message", (event) => {
      const data = event.data;
      let type = typeof data;
      let len = 0;
      if (typeof data === "string") {
        len = data.length;
      } else if (data instanceof ArrayBuffer) {
        len = data.byteLength;
      }
      console.log(`[DO] msg from ${id} type=${type} len=${len}`);
      if (data === null || data === undefined) {
        return;
      }
      if (typeof data === "string") {
        if (data.length === 0) {
          return;
        }
      } else if (data instanceof ArrayBuffer) {
        if (data.byteLength === 0) {
          return;
        }
      }
      // Normalize to binary: Go client sends AES-GCM encrypted binary as TextMessage,
      // but Cloudflare Workers Runtime UTF-8 decodes TextMessage frames, which can
      // corrupt binary payloads (invalid UTF-8 sequences get mangled/truncated).
      // Re-encode as BinaryMessage frame so the peer receives raw bytes intact.
      let payload;
      if (typeof data === "string") {
        payload = new TextEncoder().encode(data);
      } else {
        payload = data;
      }
      for (const [cid, info] of this.clients) {
        const ws = info.ws;
        if (cid === id) continue;
        if (ws.readyState !== 1) continue;
        try {
          ws.send(payload);
          console.log(`[DO] forwarded to ${cid} len=${payload.byteLength || payload.length}`);
        } catch (e) {
          console.log(`[DO] forward error to ${cid}: ${e}`);
        }
      }
    });

    server.addEventListener("close", (evt) => {
      console.log(`[DO] client closed: ${id}`);
      this.clients.delete(id);
    });

    server.addEventListener("error", (evt) => {
      console.log(`[DO] client error: ${id}`);
      this.clients.delete(id);
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}
