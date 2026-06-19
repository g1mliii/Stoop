import "server-only";

import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers
} from "obscenity";

import { WATCHLIST_TERMS } from "@/lib/security/store-name-watchlist";

// Phase 3.x: abuse screening for the two public-facing surfaces a seller chooses — the store
// display name and (via slugify) its /s/[slug] URL. Both ride straight onto the storefront and
// the auto-aggregated building bazaar, so a vile name is our brand exposure, not just theirs.
//
// Two tiers (see the signup posture decision):
//   - "block": obvious slurs / hard obscenity. Rejected at signup before any magic link is sent.
//   - "flag":  borderline terms (impersonation, regulated categories) from the watchlist. Allowed
//              through, but written to audit_log so a human can review and take the store down.
//
// This is intentionally server-only: the obscenity dataset is heavy and has no business in the
// client bundle. The signup form already round-trips validation through the server action, so the
// block decision surfaces as an ordinary field error.
//
// Hard truth: no list is ever complete. This catches the cheap, obvious abuse; the audit_log
// review queue + takedown path is the real backstop for everything obfuscation slips past.

// Obscenity ships an obfuscation-aware matcher (leetspeak, spacing, diacritics, homoglyphs) seeded
// from the LDNOOBW word list. Built once at module load — the dataset compile is not cheap.
const obsceneMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers
});

// Whole-word watchlist matching against the normalized name. Anchored on word boundaries so
// "weed" flags but "tweed" does not. Built once; the source list is small.
const escapeRegExp = (term: string): string =>
  term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const watchlistPattern = new RegExp(
  `\\b(?:${WATCHLIST_TERMS.map(escapeRegExp).join("|")})\\b`,
  "i"
);

export type ScreenAction = "allow" | "flag" | "block";

export interface ScreenResult {
  action: ScreenAction;
  /** Matched watchlist terms (flag tier only). Empty for block/allow. */
  terms: string[];
}

// Mirror the cheap normalization slugify does, minus the hyphenation, so obfuscation that leans on
// case/diacritics/punctuation collapses to the same surface the matcher inspects.
function normalize(raw: string): string {
  return raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Screen a seller-chosen store name. Pure and synchronous so the signup server action can gate on
 * it before sending a magic link. The caller decides what to do with each tier (block → reject,
 * flag → allow + audit).
 */
export function screenStoreName(raw: string): ScreenResult {
  const normalized = normalize(raw);

  // Run the obscene matcher on both the normalized name and a de-spaced variant. Spacing is one of
  // the recommended transformers, but collapsing it ourselves catches names where punctuation, not
  // whitespace, was used to break a word apart (e.g. "f.u.c.k").
  const despaced = normalized.replace(/[^a-z0-9]+/g, "");
  if (obsceneMatcher.hasMatch(normalized) || obsceneMatcher.hasMatch(despaced)) {
    return { action: "block", terms: [] };
  }

  const matches = normalized.match(watchlistPattern);
  if (matches) {
    return { action: "flag", terms: [matches[0]] };
  }

  return { action: "allow", terms: [] };
}
