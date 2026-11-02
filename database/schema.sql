-- School ERP — students table (legacy column names preserved)
-- Run in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text not null,
  fathername text not null,
  adhar text not null,
  mobile text not null,
  emailid text,
  city text,
  address text,
  stdclass text not null,
  stddiv text not null,
  createdon timestamptz not null default timezone('utc', now()),
  constraint students_adhar_key unique (adhar),
  constraint students_gender_check check (gender in ('Male', 'Female', 'Other')),
  constraint students_adhar_check check (adhar ~ '^[0-9]{12}$'),
  constraint students_mobile_check check (mobile ~ '^[0-9]{10}$')
);

create index if not exists students_createdon_idx on public.students (createdon desc);
create index if not exists students_stdclass_stddiv_idx on public.students (stdclass, stddiv);

comment on table public.students is 'Student master records for School ERP registration';
comment on column public.students.adhar is 'Aadhaar number (legacy column name)';
comment on column public.students.emailid is 'Student/guardian email (legacy column name)';
comment on column public.students.stdclass is 'Class / grade (legacy column name)';
comment on column public.students.stddiv is 'Division / section (legacy column name)';

alter table public.students enable row level security;

drop policy if exists "service_insert_students" on public.students;
drop policy if exists "service_select_students" on public.students;

-- Backend uses the service role key (bypasses RLS). These policies cover
-- authenticated access if the table is queried from a trusted context.
create policy "service_insert_students"
  on public.students
  for insert
  to authenticated
  with check (true);

create policy "service_select_students"
  on public.students
  for select
  to authenticated
  using (true);
