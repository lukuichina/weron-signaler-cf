import { RelayRoom } from "./worker/relay_room.js";

export { RelayRoom };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/manager/" || url.pathname.startsWith("/api/manager/")) {
      return new Response("Not Found", { status: 404 });
    }
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
      const community = url.searchParams.get("community") || url.searchParams.get("channel") || "default";
      const id = env.RELAY_ROOM.idFromName(community);
      const stub = env.RELAY_ROOM.get(id);
      return stub.fetch(request);
    }
    if (url.pathname === "/ws" || url.pathname === "/" || url.pathname === "/signaler" || url.pathname === "/room") {
      const community = url.searchParams.get("community") || url.searchParams.get("channel") || "default";
      const id = env.RELAY_ROOM.idFromName(community);
      const stub = env.RELAY_ROOM.get(id);
      return stub.fetch(request);
    }
    return new Response("Weron Cloudflare Worker Signaler is running.", { status: 200 });
  },
};
