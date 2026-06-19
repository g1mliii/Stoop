import { createServer } from "node:http";

import sharp from "sharp";

// Phase 3.5 step B (native). Re-encodes uploads to clean WebP. Re-encoding is itself the
// polyglot defense: anything sharp can't decode as a real raster image is rejected, and a
// successful decode strips any trailing/leading non-image payload.

const PORT = 8080;
const MAX_EDGE = 2048;
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const GENERIC_REASON = "That image didn't work — try a JPG or PNG under 4 MB.";

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function reject(res, reason) {
  send(res, 422, JSON.stringify({ reason }), {
    "Content-Type": "application/json"
  });
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BYTES) {
      throw new Error("too large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const server = createServer((req, res) => {
  if (req.method !== "POST" || !req.url?.startsWith("/process")) {
    send(res, 404, "not found");
    return;
  }

  void (async () => {
    let buf;
    try {
      buf = await readBody(req);
    } catch {
      reject(res, GENERIC_REASON);
      return;
    }

    try {
      const image = sharp(buf, { failOn: "error" });
      const meta = await image.metadata();

      // Reject svg (vector / script-bearing), unknown formats, and animated frames.
      if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
        reject(res, GENERIC_REASON);
        return;
      }
      if ((meta.pages ?? 1) > 1) {
        reject(res, "Animated images aren't supported yet — try a still photo.");
        return;
      }

      const { data, info } = await image
        .rotate() // bake EXIF orientation, then drop all metadata (default) to strip EXIF
        .resize({
          width: MAX_EDGE,
          height: MAX_EDGE,
          fit: "inside",
          withoutEnlargement: true
        })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });

      send(res, 200, data, {
        "Content-Type": "image/webp",
        "X-Image-Width": String(info.width),
        "X-Image-Height": String(info.height)
      });
    } catch {
      reject(res, GENERIC_REASON);
    }
  })();
});

server.listen(PORT, () => {
  console.log(`image-processor container listening on ${PORT}`);
});
