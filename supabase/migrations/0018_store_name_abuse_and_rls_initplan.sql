-- Phase 3.x follow-ups, combined:
--   1. Store-name abuse protection: extend the create_store_quickstart reserved-word guard with
--      brand/authority impersonation terms so a seller can't claim a storefront slug that
--      impersonates Stoop or support (matches RESERVED in lib/utils/slug.ts). Obscenity/slur
--      screening of the display name happens in app code (lib/security/store-name.ts).
--   2. RLS initplan fix: image_uploads_owner_insert re-evaluated auth.uid() per row
--      (Supabase auth_rls_initplan lint). Wrap it in (select auth.uid()) so the planner hoists
--      it to a single per-statement evaluation — same treatment 0010 applied to the seller policies.

-- 1. Reserved-word guard. Recreate the function; only the reserved-word array changes (route
-- collisions + brand impersonation). Body is otherwise identical to 0015 — keep them in lockstep.
create or replace function public.create_store_quickstart(
  p_user_id uuid,
  p_display_name text,
  p_contact_email text,
  p_store_name text,
  p_slug_base text,
  p_item_name text,
  p_price_cents integer,
  p_pickup_method public.pickup_method
)
returns table (store_id uuid, slug text)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_seller_id uuid;
  v_store_id uuid;
  v_slug text;
  v_base text;
  v_candidate text;
  v_suffix text;
  v_attempt integer;
begin
  v_base := lower(regexp_replace(coalesce(p_slug_base, ''), '[^a-z0-9]+', '-', 'g'));
  v_base := regexp_replace(v_base, '(^-+|-+$)', '', 'g');
  v_base := regexp_replace(left(v_base, 40), '-+$', '');

  if v_base is null then
    v_base := 'stoop';
  end if;
  if v_base = '' then
    v_base := 'stoop';
  end if;
  -- Keep in sync with RESERVED in lib/utils/slug.ts (route collisions + brand impersonation).
  if v_base = any(array[
    'admin', 'api', 'app', 'b', 's', 'o', 'dashboard', 'settings',
    'health', 'static', '_next', 'auth', 'login', 'signup',
    'stoop', 'support', 'help', 'official', 'billing', 'payments',
    'team', 'staff', 'about', 'contact', 'terms', 'privacy'
  ]) then
    v_base := rtrim(left(v_base || '-stoop', 40), '-');
  end if;

  -- One seller per auth user (sellers.user_id is unique). Guard up front so a double-clicked
  -- magic link surfaces as a clean error the callback falls through on, not a half-built tenant.
  if exists (select 1 from public.sellers s where s.user_id = p_user_id) then
    raise exception 'seller already exists for this user'
      using errcode = 'unique_violation';
  end if;

  insert into public.sellers (user_id, display_name, contact_email)
  values (p_user_id, p_display_name, p_contact_email)
  returning id into v_seller_id;

  -- Slugs are globally unique. Try the readable base first, then use bounded random suffixes on
  -- collision so a popular name cannot force an unbounded sequential retry walk.
  v_candidate := v_base;
  for v_attempt in 0..8 loop
    begin
      insert into public.stores (seller_id, slug, name, pickup_method)
      values (v_seller_id, v_candidate, p_store_name, p_pickup_method)
      returning id, slug into v_store_id, v_slug;
      exit;
    exception when unique_violation then
      if v_attempt = 8 then
        raise exception 'could not allocate store slug'
          using errcode = 'unique_violation';
      end if;

      v_suffix := substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
      v_candidate := rtrim(left(v_base, 33), '-') || '-' || v_suffix;
    end;
  end loop;

  insert into public.products (store_id, name, price_cents)
  values (v_store_id, p_item_name, p_price_cents);

  store_id := v_store_id;
  slug := v_slug;
  return next;
end;
$$;

revoke all on function public.create_store_quickstart(
  uuid, text, text, text, text, text, integer, public.pickup_method
) from public;
grant execute on function public.create_store_quickstart(
  uuid, text, text, text, text, text, integer, public.pickup_method
) to service_role;
drop function if exists public.create_store_quickstart(
  text, text, text, text, text, integer, public.pickup_method
);

-- 2. RLS initplan fix for the image_uploads insert policy.
drop policy if exists image_uploads_owner_insert on public.image_uploads;
create policy image_uploads_owner_insert on public.image_uploads
  for insert to authenticated with check (
    private.is_store_owner(store_id)
    and requested_by = (select auth.uid())
    and status = 'pending'
    and key_final is null
  );
