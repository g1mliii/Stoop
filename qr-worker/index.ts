import {
  buildingQrCacheKey,
  isQrFormat,
  qrCacheKey,
  qrFormatMeta,
  type QrFormat
} from "../lib/qr/cache-key";
import { buildFlyerPdf, type FlyerPageSize } from "../lib/qr/flyer";
import type { QrGeneratorRequest } from "../lib/qr/generator-request";
import {
  bazaarUrl,
  qrPngForUrl,
  qrSvgForUrl,
  storefrontQrPng,
  storefrontQrSvg,
  storefrontUrl
} from "../lib/qr/poster";

type Env = {
  APP_BASE_URL: string;
  QR_BUCKET: R2Bucket;
};

const FONT_KEYS = {
  display: "fonts/instrument-serif.ttf",
  body: "fonts/inter-tight.ttf"
} as const;

function error(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePayload(value: unknown): QrGeneratorRequest | null {
  if (!isRecord(value) || !isRecord(value.store)) return null;
  const { format, scope, store, building } = value;
  if (
    typeof format !== "string" ||
    (scope !== "store" && scope !== "building") ||
    typeof store.id !== "string" ||
    typeof store.slug !== "string" ||
    typeof store.name !== "string" ||
    typeof store.visibility !== "string" ||
    (store.description !== null && typeof store.description !== "string")
  ) {
    return null;
  }
  if (scope === "building") {
    if (
      !isRecord(building) ||
      typeof building.id !== "string" ||
      typeof building.publicSlug !== "string" ||
      typeof building.displayName !== "string" ||
      (building.accessType !== "open" && building.accessType !== "invite") ||
      (building.inviteCode !== null && typeof building.inviteCode !== "string")
    ) {
      return null;
    }
  }

  return value as QrGeneratorRequest;
}

function toBytes(value: Uint8Array | string): Uint8Array {
  return typeof value === "string" ? new TextEncoder().encode(value) : value;
}

async function loadFont(bucket: R2Bucket, key: string): Promise<Uint8Array | undefined> {
  try {
    const object = await bucket.get(key);
    return object ? new Uint8Array(await object.arrayBuffer()) : undefined;
  } catch {
    return undefined;
  }
}

async function generateStore(
  format: QrFormat,
  store: QrGeneratorRequest["store"],
  env: Env
): Promise<Uint8Array> {
  switch (format) {
    case "svg":
      return toBytes(await storefrontQrSvg(store.slug, env.APP_BASE_URL));
    case "png-512":
      return storefrontQrPng(store.slug, 512, env.APP_BASE_URL);
    case "png-1024":
      return storefrontQrPng(store.slug, 1024, env.APP_BASE_URL);
    case "pdf-letter":
    case "pdf-a4": {
      const qrPng = storefrontQrPng(store.slug, 1024, env.APP_BASE_URL);
      const [display, body] = await Promise.all([
        loadFont(env.QR_BUCKET, FONT_KEYS.display),
        loadFont(env.QR_BUCKET, FONT_KEYS.body)
      ]);
      const pageSize: FlyerPageSize = format === "pdf-a4" ? "a4" : "letter";
      return buildFlyerPdf({
        storeName: store.name,
        tagline: store.description,
        storefrontUrl: storefrontUrl(store.slug, env.APP_BASE_URL),
        qrPng,
        pageSize,
        fonts: { display, body }
      });
    }
  }
}

async function generateBuilding(
  format: QrFormat,
  building: NonNullable<QrGeneratorRequest["building"]>,
  env: Env
): Promise<Uint8Array> {
  const url = bazaarUrl(
    building.publicSlug,
    building.accessType === "invite" ? building.inviteCode : null,
    env.APP_BASE_URL
  );
  switch (format) {
    case "svg":
      return toBytes(await qrSvgForUrl(url));
    case "png-512":
      return qrPngForUrl(url, 512);
    case "png-1024":
      return qrPngForUrl(url, 1024);
    case "pdf-letter":
    case "pdf-a4": {
      const qrPng = qrPngForUrl(url, 1024);
      const [display, body] = await Promise.all([
        loadFont(env.QR_BUCKET, FONT_KEYS.display),
        loadFont(env.QR_BUCKET, FONT_KEYS.body)
      ]);
      const pageSize: FlyerPageSize = format === "pdf-a4" ? "a4" : "letter";
      return buildFlyerPdf({
        storeName: building.displayName,
        storefrontUrl: url,
        caption: "Sellers in your building — scan to see today's drops.",
        qrPng,
        pageSize,
        fonts: { display, body }
      });
    }
  }
}

function downloadName(format: QrFormat, slug: string, scope: "store" | "building"): string {
  const meta = qrFormatMeta(format);
  const family = scope === "building" ? "stoop-bazaar" : "stoop";
  const kind = meta.ext === "pdf" ? "flyer" : "qr";
  return `${family}-${kind}-${slug}.${meta.ext}`;
}

async function serveQrAsset(opts: {
  bucket: R2Bucket;
  cacheKey: string;
  contentType: string;
  downloadName: string;
  customMetadata: Record<string, string>;
  generate: () => Promise<Uint8Array>;
}): Promise<Response> {
  const headers = {
    "Content-Type": opts.contentType,
    "Content-Disposition": `attachment; filename="${opts.downloadName}"`,
    "Cache-Control": "private, max-age=3600"
  };
  try {
    const cached = await opts.bucket.get(opts.cacheKey);
    if (cached) return new Response(cached.body, { headers });
  } catch {
    // Cache miss-on-error: the seller still receives a fresh asset.
  }

  const bytes = await opts.generate();
  try {
    await opts.bucket.put(opts.cacheKey, bytes, {
      httpMetadata: { contentType: opts.contentType },
      customMetadata: opts.customMetadata
    });
  } catch {
    // Cache writes are best-effort; delivery takes priority.
  }

  return new Response(bytes as BodyInit, { headers });
}

async function generate(request: Request, env: Env): Promise<Response> {
  const payload = parsePayload(await request.json().catch(() => null));
  if (!payload || !isQrFormat(payload.format)) {
    return error("Pick a download format.", 400);
  }

  const { format, store } = payload;
  if (payload.scope === "building") {
    const building = payload.building;
    if (!building) return error("Your stoop isn't grouped into a building yet.", 404);
    if (building.accessType === "invite" && !building.inviteCode) {
      return error("Rotate the invite code before printing this poster.", 409);
    }
    const cacheKey = await buildingQrCacheKey(building.id, {
      slug: building.publicSlug,
      accessType: building.accessType,
      inviteCode: building.inviteCode,
      name: building.displayName,
      format
    });
    return serveQrAsset({
      bucket: env.QR_BUCKET,
      cacheKey,
      contentType: qrFormatMeta(format).contentType,
      downloadName: downloadName(format, building.publicSlug, "building"),
      customMetadata: {
        scope: "building",
        slug: building.publicSlug,
        accessType: building.accessType,
        name: building.displayName
      },
      generate: () => generateBuilding(format, building, env)
    });
  }

  const cacheKey = await qrCacheKey(store.id, {
    slug: store.slug,
    visibility: store.visibility,
    name: store.name,
    description: store.description,
    format
  });
  return serveQrAsset({
    bucket: env.QR_BUCKET,
    cacheKey,
    contentType: qrFormatMeta(format).contentType,
    downloadName: downloadName(format, store.slug, "store"),
    customMetadata: {
      slug: store.slug,
      visibility: store.visibility,
      name: store.name,
      description: store.description ?? ""
    },
    generate: () => generateStore(format, store, env)
  });
}

export default {
  fetch(request, env): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/generate") {
      return Promise.resolve(error("We couldn't make that QR download.", 404));
    }
    return generate(request, env);
  }
} satisfies ExportedHandler<Env>;
