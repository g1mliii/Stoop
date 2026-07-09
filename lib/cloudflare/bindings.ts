import { getCloudflareContext } from "@opennextjs/cloudflare";

export type ImageQueue = Queue;

type WorkerBindings = {
  UPLOADS_BUCKET?: R2Bucket;
  QR_BUCKET?: R2Bucket;
  IMAGE_QUEUE?: ImageQueue;
  QR_GENERATOR?: Fetcher;
};

function workerBindings(): WorkerBindings | null {
  try {
    return getCloudflareContext().env;
  } catch {
    return null;
  }
}

/** R2 bucket holding seller uploads (pending + cleaned). Null outside the Worker runtime. */
export function getUploadsBucket(): R2Bucket | null {
  return workerBindings()?.UPLOADS_BUCKET ?? null;
}

/** R2 bucket caching generated QR assets + holding the flyer fonts. Null outside the Worker. */
export function getQrBucket(): R2Bucket | null {
  return workerBindings()?.QR_BUCKET ?? null;
}

/** Producer side of the image-processing queue. Null outside the Worker runtime. */
export function getImageQueue(): ImageQueue | null {
  return workerBindings()?.IMAGE_QUEUE ?? null;
}

/** Internal Worker that generates cached QR downloads without bloating the storefront bundle. */
export function getQrGenerator(): Fetcher | null {
  return workerBindings()?.QR_GENERATOR ?? null;
}
