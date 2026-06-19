"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";

import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/form";
import { requestMagicLink } from "@/lib/auth/magic-link";

export function LoginForm({ linkExpired }: { linkExpired: boolean }) {
  const fieldId = useId();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await requestMagicLink(email);
      setMessage(result.message);
    });
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <p className="font-mono text-12 uppercase tracking-[0.12em] text-verdigris">
        Welcome back
      </p>
      <h1 className="mt-2 font-display text-28 text-ink">Sign in to Stoop</h1>
      <p className="mt-2 text-15 text-ink-2">
        We&apos;ll email you a link — no password to remember.
      </p>

      {linkExpired ? (
        <p className="mt-4 rounded-md border border-warning bg-warning-3 px-4 py-3 text-14 text-ink">
          That link didn&apos;t work — it may have expired. Ask for a fresh one
          below.
        </p>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-md border border-line bg-paper-2 px-4 py-3 text-14 text-ink-2">
          {message}
        </p>
      ) : (
        <form className="mt-5 flex flex-col gap-3" onSubmit={handleSubmit} noValidate>
          <label htmlFor={fieldId} className="text-14 font-semibold text-ink">
            Your email
          </label>
          <Input
            id={fieldId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
            required
          />
          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending ? "Sending…" : "Send me a link"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-13 text-ink-3">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-verdigris">
          Open your stoop
        </Link>
        .
      </p>
    </Card>
  );
}
