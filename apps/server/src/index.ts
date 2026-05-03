import { addClient, removeClient } from "./ws";
import { handleRequest } from "./routes";

const PORT = Number(process.env.FLOWMATE_PORT ?? 7842);

const server = Bun.serve({
  port: PORT,
  async fetch(req, server) {
    if (req.headers.get("upgrade") === "websocket") {
      const upgraded = server.upgrade(req);
      if (!upgraded) return new Response("WebSocket upgrade failed", { status: 400 });
      return undefined as any;
    }
    return handleRequest(req);
  },
  websocket: {
    open(ws) {
      addClient(ws);
      ws.send(JSON.stringify({ type: "connected" }));
    },
    close(ws) {
      removeClient(ws);
    },
    message() {},
  },
});

console.log(`FlowMate server running at http://localhost:${PORT}`);
