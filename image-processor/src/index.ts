import { Container, getContainer } from "@cloudflare/containers";

// Phase 3.5 step B. This worker is deployed SEPARATELY from the main app (it owns the Queue
// CONSUMER, the R2 bucket, and the sharp container). The main app is only the producer.
//
// For each job: read the pending bytes from R2, hand them to the container for sharp re-encoding
// (native sharp can't run in a Workers isolate), then write the cleaned WebP back to R2 and flip
// the image_uploads row to ready/rejected via the Supabase service role.

type Env = ImageProcessorEnv & {
  SUPABASE_SECRET_KEY: string;
};

interface ImageJob {
  upload_id: string;
  store_id: string;
  key_pending: string;
}

export class ImageProcessor extends Container {
  override defaultPort = 8080;
  override sleepAfter = "3m";
}

async function patchRow(
  env: Env,
  id: string,
  patch: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/image_uploads?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(patch)
  });
  if (!res.ok) {
    throw new Error(`supabase patch failed: ${res.status}`);
  }
}

async function processJob(env: Env, job: ImageJob): Promise<void> {
  const pending = await env.UPLOADS_BUCKET.get(job.key_pending);
  if (!pending) {
    await patchRow(env, job.upload_id, {
      status: "rejected",
      reason: "That image didn't work — try uploading it again."
    });
    return;
  }

  const container = getContainer(env.IMAGE_PROCESSOR, job.store_id);
  const result = await container.fetch("http://container/process", {
    method: "POST",
    headers: {
      "Content-Type": pending.httpMetadata?.contentType ?? "application/octet-stream"
    },
    body: pending.body
  });

  if (result.status === 422) {
    const { reason } = (await result.json()) as { reason: string };
    await env.UPLOADS_BUCKET.delete(job.key_pending);
    await patchRow(env, job.upload_id, { status: "rejected", reason });
    return;
  }
  if (!result.ok) {
    throw new Error(`container processing failed: ${result.status}`);
  }

  const width = Number(result.headers.get("X-Image-Width") ?? "0");
  const height = Number(result.headers.get("X-Image-Height") ?? "0");
  const cleaned = await result.arrayBuffer();

  const keyFinal = `uploads/${job.store_id}/${crypto.randomUUID()}.webp`;
  await env.UPLOADS_BUCKET.put(keyFinal, cleaned, {
    httpMetadata: {
      contentType: "image/webp",
      cacheControl: "public, max-age=31536000, immutable"
    }
  });

  // Mark ready BEFORE removing the pending object. If this patch throws, the job retries with the
  // pending bytes still in place; deleting first would make the retry see no pending object and
  // wrongly reject an upload we already cleaned.
  await patchRow(env, job.upload_id, {
    status: "ready",
    key_final: keyFinal,
    width,
    height,
    reason: null
  });

  // Best-effort cleanup. A leftover pending object is harmless and must not fail (and re-queue)
  // an upload the row already records as ready.
  await env.UPLOADS_BUCKET.delete(job.key_pending).catch(() => {});
}

export default {
  async queue(batch: MessageBatch<ImageJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processJob(env, message.body);
        message.ack();
      } catch (error) {
        console.error("image job failed", error);
        message.retry();
      }
    }
  }
};
