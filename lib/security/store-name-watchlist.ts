// Phase 3.x: borderline-term watchlist for the soft-flag tier of store-name screening.
//
// These words are NOT auto-rejected — a name containing one is legal-but-worth-a-look, so it
// lands in audit_log for a human to review and (if needed) take the store down. Hard obscenity
// and slurs are handled separately by the obscenity matcher (see store-name.ts), which blocks
// outright. Keep this list conservative: every entry here is something a legitimate seller might
// reasonably use, so over-flagging just creates review noise.
//
// Matching is whole-word against the normalized name (see store-name.ts), so "guns" flags but
// "gunsmith" does not unless added explicitly.

// Brand / authority impersonation — a seller claiming to *be* Stoop or speak for it.
export const IMPERSONATION_TERMS: readonly string[] = [
  "stoop",
  "stoop official",
  "stoop support",
  "stoop team",
  "official stoop",
  "admin",
  "moderator",
  "support team",
  "verified"
];

// Regulated / high-risk categories. Legal to sell in some places, but we want eyes on them
// before they're public next to home bakers in a building bazaar.
export const SENSITIVE_TERMS: readonly string[] = [
  "weed",
  "cannabis",
  "marijuana",
  "vape",
  "vapes",
  "nicotine",
  "cbd",
  "kratom",
  "gun",
  "guns",
  "ammo",
  "firearm",
  "firearms",
  "escort",
  "escorts",
  "casino",
  "gambling",
  "loan",
  "loans",
  "crypto",
  "nft",
  "forex"
];

export const WATCHLIST_TERMS: readonly string[] = [
  ...IMPERSONATION_TERMS,
  ...SENSITIVE_TERMS
];
