"use client";

import { ImagePlus, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/app/components/ui/button";
import { Toast } from "@/app/components/ui/toast";
import { ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES } from "@/lib/schemas/image-upload";
import {
  STOOP_MUTATION_HEADER,
  STOOP_MUTATION_HEADER_VALUE
} from "@/lib/security/mutation-header";
import { cn } from "@/lib/utils/cn";

type UploadState = "idle" | "uploading" | "processing" | "error";

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 40; // ~60s ceiling before we give up and let the seller retry.
const REJECTION_FALLBACK = "That image didn't work — try a JPG or PNG under 4 MB.";

function abortableDelay(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve(true);
    }, ms);

    function onAbort() {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      resolve(false);
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function uploadErrorBody(value: unknown): { error?: string } | null {
  if (!value || typeof value !== "object" || !("error" in value)) {
    return null;
  }
  const { error } = value as { error?: unknown };
  return typeof error === "string" ? { error } : null;
}

export function ImageUpload({
  className,
  label = "Add photo",
  onChange,
  previewAlt = "Uploaded photo",
  storeId,
  value
}: {
  className?: string;
  label?: string;
  onChange: (url: string | null, uploadId?: string | null) => void;
  previewAlt?: string;
  storeId: string;
  value: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(false);
  const activeUploadRef = useRef<AbortController | null>(null);
  const uploadRunRef = useRef(0);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeUploadRef.current?.abort();
    };
  }, []);

  function isActiveRun(runId: number, signal: AbortSignal): boolean {
    return mountedRef.current && uploadRunRef.current === runId && !signal.aborted;
  }

  async function pollUntilDone(
    uploadId: string,
    runId: number,
    signal: AbortSignal
  ) {
    for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
      const shouldContinue = await abortableDelay(POLL_INTERVAL_MS, signal);
      if (!shouldContinue || !isActiveRun(runId, signal)) {
        return;
      }
      setProgress(Math.min(90, 30 + attempt * 3));

      let res: Response;
      try {
        res = await fetch(`/api/upload/${uploadId}`, {
          cache: "no-store",
          signal
        });
      } catch {
        if (!signal.aborted && isActiveRun(runId, signal)) {
          continue;
        }
        return;
      }
      if (!res.ok) {
        continue;
      }
      const body: {
        status: string;
        url: string | null;
        reason: string | null;
      } = await res.json();
      if (!isActiveRun(runId, signal)) {
        return;
      }
      if (body.status === "ready" && body.url) {
        setProgress(100);
        setState("idle");
        onChange(body.url, uploadId);
        return;
      }
      if (body.status === "rejected") {
        setState("error");
        setError(body.reason ?? REJECTION_FALLBACK);
        return;
      }
    }
    if (isActiveRun(runId, signal)) {
      setState("error");
      setError("That upload is taking a while — try again in a moment.");
    }
  }

  async function handleFile(file: File) {
    activeUploadRef.current?.abort();
    const controller = new AbortController();
    activeUploadRef.current = controller;
    const runId = uploadRunRef.current + 1;
    uploadRunRef.current = runId;
    const { signal } = controller;

    setError(null);
    if (!(ALLOWED_UPLOAD_MIME as readonly string[]).includes(file.type)) {
      setState("error");
      setError(REJECTION_FALLBACK);
      return;
    }
    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      setState("error");
      setError(REJECTION_FALLBACK);
      return;
    }

    setState("uploading");
    setProgress(15);

    const form = new FormData();
    form.append("file", file);
    form.append("storeId", storeId);

    let res: Response;
    try {
      res = await fetch("/api/upload", {
        method: "POST",
        headers: {
          [STOOP_MUTATION_HEADER]: STOOP_MUTATION_HEADER_VALUE
        },
        body: form,
        signal
      });
    } catch {
      if (!signal.aborted && isActiveRun(runId, signal)) {
        setState("error");
        setError("We couldn't reach the server — check your connection.");
      }
      return;
    }

    if (!isActiveRun(runId, signal)) {
      return;
    }

    if (!res.ok) {
      const body = uploadErrorBody(await res.json().catch(() => null));
      setState("error");
      setError(body?.error ?? REJECTION_FALLBACK);
      return;
    }

    const { uploadId }: { uploadId: string } = await res.json();
    if (!isActiveRun(runId, signal)) {
      return;
    }
    setState("processing");
    setProgress(30);
    await pollUntilDone(uploadId, runId, signal);
  }

  const busy = state === "uploading" || state === "processing";

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_UPLOAD_MIME.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) {
            void handleFile(file);
          }
        }}
      />

      {value ? (
        <div className="flex items-center gap-3">
          <span className="relative h-16 w-16 overflow-hidden rounded-md border border-line bg-paper-2">
            <Image
              src={value}
              alt={previewAlt}
              fill
              unoptimized
              className="object-cover"
            />
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null, null)}
            disabled={busy}
          >
            <X aria-hidden="true" />
            Remove
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-line bg-paper-2 text-ink-3 transition-colors duration-fast ease-stoop hover:border-verdigris hover:text-verdigris-2 disabled:opacity-50"
        >
          <ImagePlus className="h-5 w-5 stroke-[1.5]" />
          <span className="text-12">{label}</span>
        </button>
      )}

      {busy ? (
        <div className="h-1.5 w-full max-w-48 overflow-hidden rounded-pill bg-paper-3">
          <div
            className="h-full rounded-pill bg-verdigris transition-[width] duration-base ease-stoop"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
      {busy ? (
        <p className="text-12 text-ink-3">
          {state === "uploading" ? "Uploading…" : "Cleaning up your photo…"}
        </p>
      ) : null}

      {state === "error" && error ? (
        <Toast tone="danger" className="self-start">
          {error}
        </Toast>
      ) : null}
    </div>
  );
}
