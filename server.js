const fs = require("fs");
const http = require("http");
const path = require("path");
const { loadEnvFile } = require("./api/_lib/env");

loadEnvFile();

const handlers = {
  "/api/health": require("./api/health"),
  "/api/generate": require("./api/generate"),
  "/api/generate-job": require("./api/generate-job"),
  "/api/generate-status": require("./api/generate-status"),
  "/api/image": require("./api/image"),
  "/api/image-job": require("./api/image-job"),
  "/api/usage": require("./api/usage"),
  "/api/auth/login": require("./api/auth/login"),
  "/api/auth/session": require("./api/auth/session"),
  "/api/admin/account": require("./api/admin/account"),
  "/api/admin/accounts": require("./api/admin/accounts")
};

const rootDir = __dirname;
const port = Number(process.env.PORT || 8000);
const publicRootFiles = new Set(["index.html", "app.js", "styles.css"]);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

function sendText(res, statusCode, text) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(text);
}

function staticPathForUrl(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const normalizedRelativePath = path.normalize(relativePath);
  const isAsset = normalizedRelativePath.startsWith(`assets${path.sep}`) && !normalizedRelativePath.split(path.sep).some((part) => part.startsWith("."));
  if (!publicRootFiles.has(normalizedRelativePath) && !isAsset) {
    return null;
  }
  const filePath = path.resolve(rootDir, normalizedRelativePath);
  if (!filePath.startsWith(rootDir + path.sep) && filePath !== path.join(rootDir, "index.html")) {
    return null;
  }
  return filePath;
}

function serveStatic(req, res) {
  const filePath = staticPathForUrl(req.url);
  if (!filePath) return sendText(res, 403, "Forbidden");

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      return sendText(res, 404, "Not found");
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const handler = handlers[url.pathname];

  if (handler) {
    try {
      await handler(req, res);
    } catch (error) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "SERVER_ERROR", message: error.message }));
      } else {
        res.end();
      }
    }
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    return sendText(res, 404, "API route not found");
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendText(res, 405, "Method not allowed");
  }

  return serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`VISION BRZAZIL Commerce Studio running on port ${port}`);
});
