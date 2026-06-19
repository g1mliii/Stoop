// Phase 3.8: empty-state copy, verbatim from the voice cheat sheet. Single source so the
// dashboard surfaces and the component test can't drift from the approved wording.

export const EMPTY_STATES = {
  orders: {
    title: "No orders yet.",
    body: "Print your QR and stick it somewhere people walk past."
  },
  products: {
    title: "Add your first product.",
    body: "List something for sale and it shows up on your storefront right away."
  },
  subscribers: {
    title: "No subscribers yet.",
    body: "Subscribers show up here once people opt in from your storefront."
  },
  scans: {
    title: "No scans yet.",
    body: "Scans show up here once your QR is in the world."
  }
} as const;
