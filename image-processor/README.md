# aptbazaar image processor (Phase 3.5)

Separate Cloudflare Worker + Container that cleans seller image uploads. The main app
(`../`) is the **producer** — it PUTs raw bytes to R2 and enqueues a job. This service is the
**consumer**: it reads the bytes, hands them to a Node + `sharp` container for re-encoding, and
writes the cleaned WebP back to R2 while flipping the `image_uploads` row to `ready`/`rejected`.

Native `sharp` cannot run inside a Workers isolate, so the heavy lifting lives in the container;
the worker only orchestrates R2 + Queue + Supabase.

## What it does per job

1. Read `key_pending` bytes from the `UPLOADS_BUCKET` R2 bucket.
2. Forward them to the container `POST /process`. The container:
   - MIME-sniffs with `sharp` (rejects `image/svg+xml`, unknown formats),
   - rejects animated GIF/WebP (`pages > 1`),
   - re-encodes to WebP at max 2048px edge, baking + stripping EXIF (re-encode neutralizes polyglots).
3. On success: PUT cleaned bytes to `uploads/<store_id>/<uuid>.webp` (immutable cache), delete the
   pending key, set the row `ready` with `key_final` + dimensions.
4. On rejection: delete the pending key, set the row `rejected` with a neighborly `reason`.

## One-time setup

```sh
# from repo root — create shared infra (names must match both wrangler.jsonc files)
npx wrangler r2 bucket create aptbazaar-uploads
npx wrangler queues create image-processing
npx wrangler queues create image-processing-dlq

# expose the bucket publicly (or attach a custom domain) and set the resulting base URL as
# NEXT_PUBLIC_UPLOADS_BASE_URL in the main app's wrangler.jsonc + .env.local.
```

## Deploy

```sh
cd image-processor
npm install
npx wrangler secret put SUPABASE_SECRET_KEY   # service role key — server-only (repeat with --env preview)
npm run deploy                                 # production: builds the container image + deploys the worker
npx wrangler deploy --env preview              # preview: consumes image-processing-preview → aptbazaar-uploads-preview
```

Deploy **both** environments. The default deploy consumes the production `image-processing` queue;
the preview deploy consumes `image-processing-preview` (what the main app's preview + local `wrangler
dev` produce to). Skip the preview deploy and preview/local uploads enqueue to a queue with no
consumer and sit `pending` until the client times out.

The main app needs no extra deploy step beyond the R2 + Queue **producer** bindings already in
`../wrangler.jsonc`.

## Notes

- Cost: containers bill per request + per-second; MVP volume (~hundreds/day) is ~$1/mo.
- No long-lived S3 keys — R2 is reached through the binding; Supabase through the service role secret.
- This package is intentionally excluded from the root `tsconfig.json` and ESLint config; it has its
  own deploy toolchain.
