-- The cost snapshot is an internal service-role-only table. Its grants already revoke every
-- browser role; this explicit policy documents that model and satisfies the RLS policy advisor.
create policy cost_snapshot_service_role_all on public.cost_snapshot
  for all to service_role
  using (true)
  with check (true);
