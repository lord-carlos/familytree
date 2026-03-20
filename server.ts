import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = join(__dirname, "uploads");
const DB_PATH = join(__dirname, "data", "family.db");
const PORT = 3000;

if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.run(`
  CREATE TABLE IF NOT EXISTS family_tree (
    id         INTEGER PRIMARY KEY DEFAULT 1,
    name       TEXT    NOT NULL DEFAULT 'My Family',
    data       TEXT    NOT NULL DEFAULT '[]',
    updated_at DATETIME DEFAULT (datetime('now'))
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS images (
    id          TEXT PRIMARY KEY,
    filename    TEXT NOT NULL,
    mime_type   TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT (datetime('now'))
  )
`);
db.run(`INSERT OR IGNORE INTO family_tree (id, data) VALUES (1, '[]')`);

async function handleTreeGet(req: Request): Promise<Response> {
  const row = db.query("SELECT data FROM family_tree WHERE id = 1").get() as { data: string } | null;
  if (!row) return Response.json({ error: "Tree not found" }, { status: 404 });
  return Response.json(JSON.parse(row.data));
}

async function handleTreePut(req: Request): Promise<Response> {
  try {
    const data = await req.json();
    const dataStr = JSON.stringify(data);
    db.run("UPDATE family_tree SET data = ?, updated_at = datetime('now') WHERE id = 1", [dataStr]);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
}

async function handleImageUpload(req: Request, personId: string): Promise<Response> {
  const formData = await req.formData()
  const thumbnail = formData.get("thumbnail")
  const full = formData.get("full")
  
  if (!thumbnail || !(thumbnail instanceof File)) {
    return Response.json({ error: "No thumbnail uploaded" }, { status: 400 })
  }
  if (!full || !(full instanceof File)) {
    return Response.json({ error: "No full image uploaded" }, { status: 400 })
  }

  const timestamp = Date.now()
  const thumbFilename = `${personId}_thumb.webp`
  const fullFilename = `${personId}_full.webp`
  
  const thumbPath = join(UPLOADS_DIR, thumbFilename)
  const fullPath = join(UPLOADS_DIR, fullFilename)

  const [thumbBuffer, fullBuffer] = await Promise.all([
    thumbnail.arrayBuffer(),
    full.arrayBuffer()
  ])
  
  await Promise.all([
    Bun.write(thumbPath, thumbBuffer),
    Bun.write(fullPath, fullBuffer)
  ])

  db.run(
    "INSERT OR REPLACE INTO images (id, filename, mime_type) VALUES (?, ?, ?)",
    [personId, thumbFilename, "image/webp"]
  )

  return Response.json({ 
    thumbnailUrl: `/uploads/${thumbFilename}?v=${timestamp}`,
    fullUrl: `/uploads/${fullFilename}?v=${timestamp}`
  })
}

async function handleStaticFile(filename: string): Promise<Response> {
  const filepath = join(UPLOADS_DIR, filename);
  const file = Bun.file(filepath);
  if (!(await file.exists())) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(file);
}

function serveVueBuild(req: Request): Promise<Response> | Response {
  const url = new URL(req.url);
  let pathname = url.pathname;
  
  if (pathname === "/") pathname = "/index.html";
  
  const filePath = join(__dirname, "client", "dist", pathname);
  const file = Bun.file(filePath);
  
  return file.exists().then(exists => {
    if (exists) return new Response(file);
    const indexFile = Bun.file(join(__dirname, "client", "dist", "index.html"));
    return indexFile.exists().then(indexExists => {
      if (indexExists) return new Response(indexFile);
      return new Response("Not found", { status: 404 });
    });
  });
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/api/tree") {
    return handleTreeGet(req);
  }

  if (req.method === "PUT" && pathname === "/api/tree") {
    return handleTreePut(req);
  }

  const imageUploadMatch = pathname.match(/^\/api\/images\/([^/]+)$/);
  if (req.method === "POST" && imageUploadMatch?.[1]) {
    return handleImageUpload(req, imageUploadMatch[1]);
  }

  if (pathname.startsWith("/uploads/")) {
    const filename = pathname.replace("/uploads/", "");
    return handleStaticFile(filename);
  }

  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return serveVueBuild(req);
}

console.log(`Server running on http://localhost:${PORT}`);
Bun.serve({ port: PORT, hostname: "0.0.0.0", fetch: handleRequest });
