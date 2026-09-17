create table if not exists public.verification_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  skill_name text not null,
  token text not null unique,
  method text not null,
  outcome text not null,
  evidence_summary text not null,
  evidence_url text null,
  reason text not null,
  "timestamp" timestamptz not null,
  signals jsonb not null default '[]'::jsonb,
  analysis jsonb null,
  created_at timestamptz not null default now()
);

alter table public.verification_records enable row level security;

create index if not exists verification_records_student_id_idx
  on public.verification_records (student_id);

create index if not exists verification_records_skill_name_idx
  on public.verification_records (skill_name);

-- The token column's table-level UNIQUE constraint supplies the unique index.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'verification_records'
      and policyname = 'Students can view their own verification records'
  ) then
    create policy "Students can view their own verification records"
      on public.verification_records
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.student_profiles
          where student_profiles.id = verification_records.student_id
            and student_profiles.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'verification_records'
      and policyname = 'Students can create their own verification records'
  ) then
    create policy "Students can create their own verification records"
      on public.verification_records
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.student_profiles
          where student_profiles.id = verification_records.student_id
            and student_profiles.user_id = auth.uid()
        )
      );
  end if;
end
$$;

-- Verification queries to run after applying this migration:
--
-- select to_regclass('public.verification_records');
--
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'verification_records'
-- order by ordinal_position;
--
-- select relrowsecurity
-- from pg_class
-- where oid = 'public.verification_records'::regclass;
--
-- select policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename = 'verification_records';
--
-- select
--   tc.constraint_name,
--   kcu.column_name,
--   ccu.table_schema as foreign_table_schema,
--   ccu.table_name as foreign_table_name,
--   ccu.column_name as foreign_column_name
-- from information_schema.table_constraints tc
-- join information_schema.key_column_usage kcu
--   on tc.constraint_name = kcu.constraint_name
--  and tc.table_schema = kcu.table_schema
-- join information_schema.constraint_column_usage ccu
--   on ccu.constraint_name = tc.constraint_name
--  and ccu.table_schema = tc.table_schema
-- where tc.constraint_type = 'FOREIGN KEY'
--   and tc.table_schema = 'public'
--   and tc.table_name = 'verification_records';
--
-- select indexname, indexdef
-- from pg_indexes
-- where schemaname = 'public'
--   and tablename = 'verification_records';
