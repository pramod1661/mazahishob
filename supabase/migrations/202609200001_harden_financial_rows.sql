-- Protect every user-owned financial row and prevent duplicate EMI postings.
-- This migration is idempotent and is safe to re-run.

begin;

do $$
declare
  table_name text;
  policy_record record;
begin
  foreach table_name in array array[
    'expenses',
    'incomes',
    'loans',
    'emi_payments',
    'prepayment_payments'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'Required table public.% does not exist.', table_name;
    end if;

    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format(
      'revoke all on table public.%I from anon, public',
      table_name
    );
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated',
      table_name
    );

    for policy_record in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = table_name
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        policy_record.policyname,
        table_name
      );
    end loop;

    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name || '_owner_only',
      table_name
    );

    execute format(
      'create index if not exists %I on public.%I (user_id)',
      table_name || '_user_id_idx',
      table_name
    );
  end loop;
end
$$;

create index if not exists emi_payments_user_loan_idx
  on public.emi_payments (user_id, loan_id);

create index if not exists prepayment_payments_user_loan_idx
  on public.prepayment_payments (user_id, loan_id);

do $$
begin
  if exists (
    select 1
    from public.emi_payments
    where emi_due_date is not null
    group by user_id, loan_id, emi_due_date
    having count(*) > 1
  ) then
    raise warning 'Duplicate EMI due-date rows exist; clean them before adding emi_payments_user_loan_due_uq.';
  else
    execute 'create unique index if not exists emi_payments_user_loan_due_uq
      on public.emi_payments (user_id, loan_id, emi_due_date)
      where emi_due_date is not null';
  end if;
end
$$;

commit;
