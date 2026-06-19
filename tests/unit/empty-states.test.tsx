import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/app/components/ui/empty-state";
import { EMPTY_STATES } from "@/lib/copy/empty-states";

// Phase 3.8 regression: every dashboard empty state renders its voice-cheat-sheet copy + a CTA.
describe("dashboard empty states", () => {
  it.each(Object.entries(EMPTY_STATES))(
    "%s renders title, body, and CTA",
    (_key, copy) => {
      render(
        <EmptyState
          title={copy.title}
          body={copy.body}
          action={<button type="button">Take action</button>}
        />
      );
      expect(
        screen.getByRole("heading", { name: copy.title })
      ).toBeInTheDocument();
      expect(screen.getByText(copy.body)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Take action" })
      ).toBeInTheDocument();
    }
  );
});
