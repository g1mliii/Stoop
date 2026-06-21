import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Phase 5.10 grep guard: the platform-fee percentage must always be interpolated from
// formatBps(PLATFORM_FEE_BPS) — never typed as a literal "3%" in product code, whether quoted
// (string) or bare in JSX text/comments. If the fee ever changes, a stray literal would silently
// lie to sellers. This is the CI guard the plan calls for, run as part of `npm run test` (and
// therefore `npm run verify`). The negative lookbehind avoids matching larger numbers like "13%".

const APP_DIR = join(process.cwd(), "app");
const LITERAL_3_PERCENT = /(?<!\d)3%/;
const CODE_EXT = /\.(tsx?|jsx?)$/;

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(full);
      }
      return CODE_EXT.test(entry.name) ? [full] : [];
    })
  );
  return files.flat();
}

describe("platform fee literal guard", () => {
  it("has no hard-coded '3%' literal anywhere under app/", async () => {
    const files = await collectFiles(APP_DIR);
    const offenders: string[] = [];
    for (const file of files) {
      const contents = await readFile(file, "utf8");
      if (LITERAL_3_PERCENT.test(contents)) {
        offenders.push(file);
      }
    }
    expect(offenders, "interpolate formatBps(PLATFORM_FEE_BPS) instead").toEqual([]);
  });
});
