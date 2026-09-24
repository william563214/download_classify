#!/usr/bin/env node
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtures_root = path.resolve(__dirname, "../fixtures");
const port = Number(process.argv[2] || process.env.MOCK_PORT || 18765);

const host_to_site = {
  "fantia.test": "fantia",
  "fanbox.test": "fanbox",
  "mega.test": "mega",
  "forum.test": "forum",
  "127.0.0.1": "fantia",
  localhost: "fantia",
};

const mime_types = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".bin": "application/octet-stream",
  ".zip": "application/zip",
};

function resolve_site(host_header) {
  const host = (host_header || "").split(":")[0].toLowerCase();
  return host_to_site[host] || "fantia";
}

function safe_join(root, request_path) {
  const decoded = decodeURIComponent(request_path.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(root, normalized);
  if (!full.startsWith(root)) {
    return null;
  }
  return full;
}

const server = http.createServer((req, res) => {
  const url = req.url || "/";
  if (url === "/health") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }

  const site = resolve_site(req.headers.host);
  const site_root = path.join(fixtures_root, site);
  let relative = url === "/" ? "/index.html" : url;
  if (relative.startsWith("/files/")) {
    relative = relative;
  }

  const file_path = safe_join(site_root, relative);
  if (!file_path || !fs.existsSync(file_path) || fs.statSync(file_path).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end(`not found: ${site}${relative}`);
    return;
  }

  const ext = path.extname(file_path).toLowerCase();
  const content_type = mime_types[ext] || "application/octet-stream";
  const body = fs.readFileSync(file_path);
  res.writeHead(200, {
    "content-type": content_type,
    "content-length": body.length,
    "content-disposition":
      ext === ".html" ? "inline" : `attachment; filename="${path.basename(file_path)}"`,
  });
  res.end(body);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`mock sites listening on http://127.0.0.1:${port}`);
  console.log("hosts: fantia.test fanbox.test mega.test forum.test");
});
