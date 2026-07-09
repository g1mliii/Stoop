export type QrGeneratorRequest = {
  format: string;
  scope: "store" | "building";
  store: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    visibility: string;
  };
  building?: {
    id: string;
    publicSlug: string;
    displayName: string;
    accessType: "open" | "invite";
    inviteCode: string | null;
  };
};
