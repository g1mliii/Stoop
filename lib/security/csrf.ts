import { optionalEnv } from "@/lib/env";
import {
  STOOP_MUTATION_HEADER,
  STOOP_MUTATION_HEADER_VALUE
} from "@/lib/security/mutation-header";

export {
  STOOP_MUTATION_HEADER,
  STOOP_MUTATION_HEADER_VALUE
} from "@/lib/security/mutation-header";

function originFrom(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function isTrustedMutationRequest(request: Request): boolean {
  if (request.headers.get(STOOP_MUTATION_HEADER) !== STOOP_MUTATION_HEADER_VALUE) {
    return false;
  }

  const requestOrigin = originFrom(request.url);
  const incomingOrigin = originFrom(request.headers.get("origin"));
  if (!requestOrigin || !incomingOrigin) {
    return false;
  }

  const allowedOrigins = new Set<string>([requestOrigin]);
  const configuredAppOrigin = originFrom(optionalEnv("NEXT_PUBLIC_APP_URL"));
  if (configuredAppOrigin) {
    allowedOrigins.add(configuredAppOrigin);
  }

  return allowedOrigins.has(incomingOrigin);
}
