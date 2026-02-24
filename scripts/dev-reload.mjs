import http from "node:http";
import { resolve } from "node:path";
import chokidar from "chokidar";

const PORT = 35729;
const distDir = resolve(process.cwd(), "dist");

const clients = new Set();

const server = http.createServer((req, res) => {
  if (req.url !== "/events") {
    res.writeHead(404);
    res.end();
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });

  res.write("event: connected\n");
  res.write("data: ok\n\n");

  clients.add(res);

  req.on("close", () => {
    clients.delete(res);
  });
});

function broadcastReload() {
  for (const client of clients) {
    client.write("event: reload\n");
    client.write(`data: ${Date.now()}\n\n`);
  }
}

const watcher = chokidar.watch(distDir, {
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 200,
    pollInterval: 100
  }
});

watcher.on("all", () => {
  broadcastReload();
});

server.listen(PORT, () => {
  console.log(`[dev-reload] listening on http://localhost:${PORT}/events`);
  console.log(`[dev-reload] watching ${distDir}`);
});

process.on("SIGINT", async () => {
  await watcher.close();
  server.close(() => process.exit(0));
});
