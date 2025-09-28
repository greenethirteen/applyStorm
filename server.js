// server.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Static assets with sane caching; HTML is no-cache so you always see latest
app.use(express.static(__dirname, {
  extensions: ["html"],
  etag: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    } else if (/\.(js|css|png|jpg|jpeg|svg|webp|ico)$/i.test(filePath)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  }
}));

// Nice routes
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/app", (_req, res) => res.sendFile(path.join(__dirname, "app.html")));
app.get("/auth", (_req, res) => res.sendFile(path.join(__dirname, "auth.html")));

// Fallback
app.use((_req, res) => res.status(404).sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => {
  console.log(`Web server running on http://localhost:${PORT}`);
});
