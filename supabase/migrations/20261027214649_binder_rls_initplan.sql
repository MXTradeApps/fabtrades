-- Binder page RLS: evaluate auth.uid() once per query instead of once per row.
--
-- Written as `auth.uid() = user_id`, Postgres re-runs auth.uid() for every row it
-- scans; wrapped in a scalar subquery it becomes an initPlan evaluated once. The
-- Binder page reads every live binder_entries row for the user (thousands for
-- large collections), so this is the policy on its hottest path. Same rules,
-- same tables; only the evaluation plan changes. Supabase's performance advisor
-- flags these as auth_rls_initplan.

ALTER POLICY "Users can view own binder entries" ON public.binder_entries
  USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert own binder entries" ON public.binder_entries
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can update own binder entries" ON public.binder_entries
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete own binder entries" ON public.binder_entries
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own binders" ON public.binders
  USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert own binders" ON public.binders
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can update own binders" ON public.binders
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete own binders" ON public.binders
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can view own binder share" ON public.binder_shares
  USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert own binder share" ON public.binder_shares
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can update own binder share" ON public.binder_shares
  USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete own binder share" ON public.binder_shares
  USING ((select auth.uid()) = user_id);
