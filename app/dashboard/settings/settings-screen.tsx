"use client";

import { AlertCircle, Check } from "lucide-react";
import { useId, useState, useTransition, type ReactNode } from "react";

import { Button } from "@/app/components/ui/button";
import { Dialog } from "@/app/components/ui/dialog";
import { Input, Select, Textarea, Toggle } from "@/app/components/ui/form";
import { Toast } from "@/app/components/ui/toast";
import { ImageUpload } from "@/app/components/upload/image-upload";
import {
  deleteAccount,
  setStoreActive,
  updateContactInfo,
  updateStoreSettings
} from "@/lib/actions/settings";
import type { PickupMethod, StoreVisibility } from "@/lib/schemas/store";
import { cn } from "@/lib/utils/cn";

type StoreSettings = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  description: string | null;
  logo_url: string | null;
  visibility: StoreVisibility;
  pickup_method: PickupMethod;
  pickup_window_label: string | null;
  pickup_public_note: string | null;
  accept_pay_at_pickup: boolean;
  is_active: boolean;
};

type Contact = {
  display_name: string;
  contact_email: string;
  contact_phone_e164: string | null;
  contact_address: string | null;
};

const VISIBILITY_OPTIONS: { value: StoreVisibility; label: string }[] = [
  { value: "qr_only", label: "QR only" },
  { value: "building", label: "Visible in my building" },
  { value: "nearby", label: "Visible to nearby buildings" }
];

const PICKUP_OPTIONS: { value: PickupMethod; label: string }[] = [
  { value: "message_after_order", label: "Message after order" },
  { value: "lobby_pickup", label: "Lobby / front desk pickup" },
  { value: "scheduled_window", label: "Set a pickup window" }
];

export function SettingsScreen({
  contact,
  store,
  stripeReady
}: {
  contact: Contact;
  store: StoreSettings;
  stripeReady: boolean;
}) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="font-display text-36 leading-none text-ink">Settings</h1>
        <p className="mt-1.5 font-mono text-12 tracking-[0.04em] text-ink-3">
          store · payments · building
        </p>
      </div>

      <StripeSection ready={stripeReady} />
      <StoreInfoSection store={store} />
      <ContactSection contact={contact} />
      <DangerSection initialActive={store.is_active} />
    </section>
  );
}

function SectionCard({
  children,
  description,
  title
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-5 shadow-sm sm:p-6">
      <h2 className="text-16 font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-1 text-12 text-ink-2">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function StripeSection({ ready }: { ready: boolean }) {
  return (
    <SectionCard
      title="Payments"
      description="Stoop never holds your money. Customers pay directly into your Stripe account; Stoop takes a fee at the point of sale."
    >
      <div
        className={cn(
          "flex items-center gap-4 rounded-md border px-4 py-4",
          ready ? "border-verdigris bg-verdigris-3" : "border-marigold bg-marigold-3"
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-pill shadow-sm",
            ready ? "bg-verdigris text-surface" : "bg-marigold text-ink"
          )}
        >
          {ready ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        </span>
        <div className="flex-1">
          <p className="text-14 font-semibold text-ink">
            {ready
              ? "Stripe connected · payouts enabled"
              : "One more step — connect your bank."}
          </p>
          <p className="mt-0.5 text-12 text-ink-2">
            {ready
              ? "Manage charges, payouts, and bank details in Stripe."
              : "Until Stripe's connected, customers can't pay online. You can still take pay-at-pickup orders."}
          </p>
        </div>
        <Button variant={ready ? "secondary" : "ink"} size="sm" disabled>
          {ready ? "Manage in Stripe" : "Connect Stripe"}
        </Button>
      </div>
      {!ready ? (
        <p className="mt-2 text-12 text-ink-3">Online payments open up soon.</p>
      ) : null}
    </SectionCard>
  );
}

function StoreInfoSection({ store }: { store: StoreSettings }) {
  const formId = useId();
  const [name, setName] = useState(store.name);
  const [category, setCategory] = useState(store.category ?? "");
  const [description, setDescription] = useState(store.description ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(store.logo_url);
  const [logoUploadId, setLogoUploadId] = useState<string | null | undefined>(
    undefined
  );
  const [logoCleared, setLogoCleared] = useState(false);
  const [visibility, setVisibility] = useState<StoreVisibility>(store.visibility);
  const [pickupMethod, setPickupMethod] = useState<PickupMethod>(store.pickup_method);
  const [windowLabel, setWindowLabel] = useState(store.pickup_window_label ?? "");
  const [publicNote, setPublicNote] = useState(store.pickup_public_note ?? "");
  const [payAtPickup, setPayAtPickup] = useState(store.accept_pay_at_pickup);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setErrors({});
    setSaved(false);
    setFormError(null);
    startTransition(async () => {
      const result = await updateStoreSettings({
        name: name.trim(),
        category,
        description,
        visibility,
        pickup_method: pickupMethod,
        pickup_window_label: windowLabel,
        pickup_public_note: publicNote,
        accept_pay_at_pickup: payAtPickup,
        logo_upload_id: logoUploadId ?? undefined,
        clear_logo: logoCleared
      });
      if (result.ok) {
        setSaved(true);
      } else if (result.fieldErrors) {
        setErrors(result.fieldErrors);
      } else {
        setFormError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <SectionCard
      title="Store info"
      description="What customers see at the top of your storefront."
    >
      <div className="flex flex-col gap-4">
        <Field label="Logo">
          <ImageUpload
            storeId={store.id}
            value={logoUrl}
            previewAlt="Store logo"
            onChange={(url, uploadId) => {
              setLogoUrl(url);
              setLogoUploadId(uploadId);
              setLogoCleared(url === null);
            }}
            label="Add logo"
          />
        </Field>

        <Field id={`${formId}-name`} label="Store name" error={errors.name}>
          <Input
            id={`${formId}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={`${formId}-category`} label="Category" error={errors.category}>
            <Input
              id={`${formId}-category`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Bakery"
            />
          </Field>
          <Field id={`${formId}-public-link`} label="Public link">
            <Input
              id={`${formId}-public-link`}
              value={`/s/${store.slug}`}
              readOnly
              numeric
              className="text-left"
            />
          </Field>
        </div>

        <Field
          id={`${formId}-description`}
          label="One-liner"
          error={errors.description}
        >
          <Input
            id={`${formId}-description`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Small-batch cookies and seasonal bakes."
          />
        </Field>

        <Field id={`${formId}-pickup-method`} label="Pickup method">
          <Select
            id={`${formId}-pickup-method`}
            value={pickupMethod}
            onChange={(e) => setPickupMethod(e.target.value as PickupMethod)}
          >
            {PICKUP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        {pickupMethod === "scheduled_window" ? (
          <Field id={`${formId}-pickup-window`} label="Pickup window">
            <Input
              id={`${formId}-pickup-window`}
              value={windowLabel}
              onChange={(e) => setWindowLabel(e.target.value)}
              placeholder="Today 5pm–7pm"
            />
          </Field>
        ) : null}

        <Field
          id={`${formId}-pickup-public-note`}
          label="Pickup note (public)"
          error={errors.pickup_public_note}
        >
          <Textarea
            id={`${formId}-pickup-public-note`}
            value={publicNote}
            onChange={(e) => setPublicNote(e.target.value)}
            placeholder="Meet in the lobby or at the front desk."
          />
        </Field>

        <label className="flex items-center gap-3">
          <Toggle
            checked={payAtPickup}
            onChange={(e) => setPayAtPickup(e.target.checked)}
          />
          <span className="text-14 text-ink">Accept pay-at-pickup orders</span>
        </label>

        <Field label="Visibility">
          <div className="flex flex-wrap gap-1.5">
            {VISIBILITY_OPTIONS.map((option) => {
              const selected = visibility === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setVisibility(option.value)}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-pill border px-3 py-1 text-12 transition-colors duration-fast ease-stoop",
                    selected
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-surface text-ink-2 hover:bg-paper-2"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-12 text-ink-3">
            Used only for building-bazaar grouping. We never publish your unit number.
          </p>
        </Field>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
          {saved ? <Toast tone="success">Saved</Toast> : null}
          {formError ? <Toast tone="danger">{formError}</Toast> : null}
        </div>
      </div>
    </SectionCard>
  );
}

function ContactSection({ contact }: { contact: Contact }) {
  const formId = useId();
  const [displayName, setDisplayName] = useState(contact.display_name);
  const [phone, setPhone] = useState(contact.contact_phone_e164 ?? "");
  const [address, setAddress] = useState(contact.contact_address ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setErrors({});
    setSaved(false);
    setFormError(null);
    startTransition(async () => {
      const result = await updateContactInfo({
        display_name: displayName.trim(),
        contact_phone_e164: phone,
        contact_address: address
      });
      if (result.ok) {
        setSaved(true);
      } else if (result.fieldErrors) {
        setErrors(result.fieldErrors);
      } else {
        setFormError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <SectionCard
      title="Your contact info"
      description="Only you see this. It never appears on your storefront."
    >
      <div className="flex flex-col gap-4">
        <Field
          id={`${formId}-display-name`}
          label="Your name"
          error={errors.display_name}
        >
          <Input
            id={`${formId}-display-name`}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
        <Field id={`${formId}-email`} label="Email">
          <Input id={`${formId}-email`} value={contact.contact_email} readOnly />
        </Field>
        <Field
          id={`${formId}-phone`}
          label="Phone (optional)"
          error={errors.contact_phone_e164}
        >
          <Input
            id={`${formId}-phone`}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+14155550100"
          />
        </Field>
        <Field
          id={`${formId}-address`}
          label="Mailing address"
          error={errors.contact_address}
        >
          <Input
            id={`${formId}-address`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="120 Maple St, Toronto, ON M5V 2K7"
          />
          <p className="mt-1 text-12 text-ink-3">
            Used on the bottom of drop emails — required by anti-spam law.
          </p>
        </Field>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
          {saved ? <Toast tone="success">Saved</Toast> : null}
          {formError ? <Toast tone="danger">{formError}</Toast> : null}
        </div>
      </div>
    </SectionCard>
  );
}

function DangerSection({ initialActive }: { initialActive: boolean }) {
  const [active, setActive] = useState(initialActive);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleActive() {
    const next = !active;
    setError(null);
    startTransition(async () => {
      const result = await setStoreActive(next);
      if (result.ok) {
        setActive(next);
      } else {
        setError("That didn't save — try again.");
      }
    });
  }

  return (
    <SectionCard
      title="Danger zone"
      description="These actions affect your whole stoop."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-14 font-semibold text-ink">
              {active ? "Your stoop is open" : "Your stoop is hidden"}
            </p>
            <p className="text-12 text-ink-2">
              {active
                ? "Deactivating hides your storefront and stops new orders."
                : "Reactivate to take orders again."}
            </p>
          </div>
          <Button
            variant={active ? "danger" : "secondary"}
            onClick={toggleActive}
            disabled={isPending}
          >
            {active ? "Deactivate store" : "Reactivate store"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div>
            <p className="text-14 font-semibold text-ink">Delete account</p>
            <p className="text-12 text-ink-2">
              Permanently removes your stoop, products, and orders. This can&apos;t be
              undone.
            </p>
          </div>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Delete account
          </Button>
        </div>

        {error ? <Toast tone="danger">{error}</Toast> : null}
      </div>

      {confirmOpen ? (
        <Dialog open onClose={() => setConfirmOpen(false)} title="Delete your account?">
          <div className="flex flex-col gap-4">
            <p className="text-14 text-ink-2">
              This removes everything and can&apos;t be undone. Type{" "}
              <b className="font-mono text-ink">delete my account</b> to confirm.
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="delete my account"
              aria-label="Type delete my account to confirm"
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={isPending}
              >
                Keep my account
              </Button>
              <Button
                variant="danger"
                disabled={
                  isPending || confirmText.trim().toLowerCase() !== "delete my account"
                }
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteAccount(confirmText);
                    if (!result.ok) {
                      setError(result.error ?? "We couldn't delete your account.");
                    }
                  })
                }
              >
                {isPending ? "Deleting…" : "Delete forever"}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </SectionCard>
  );
}

function Field({
  children,
  error,
  id,
  label
}: {
  children: ReactNode;
  error?: string;
  id?: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {id ? (
        <label htmlFor={id} className="text-14 font-semibold text-ink">
          {label}
        </label>
      ) : (
        <span className="text-14 font-semibold text-ink">{label}</span>
      )}
      {children}
      {error ? <p className="text-13 text-danger">{error}</p> : null}
    </div>
  );
}
