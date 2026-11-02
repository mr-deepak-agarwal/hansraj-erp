-- School ERP schema v2 for Supabase (Postgres 15+).
-- Run in Supabase Dashboard -> SQL Editor. Safe to re-run, and safe to run over the v1 schema:
-- it adds the new tables/columns and REPLACES all row-level-security policies.

create sequence if not exists admission_seq;
create sequence if not exists receipt_seq;

-- =====================================================================
-- Users / roles
-- roles: admin, teacher, hr, accounts (staff) and parent
-- =====================================================================
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  email text,
  role text not null default 'parent',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table profiles add column if not exists email text;
alter table profiles add column if not exists active boolean not null default true;
alter table profiles alter column role set default 'parent';
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin','teacher','hr','accounts','parent'));
update profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

-- Least privilege: the very first user becomes admin, everybody after that starts as
-- 'parent' (which sees nothing until children are linked). Roles are NEVER read from
-- user-supplied sign-up data. The admin sets real roles from the app's Users page.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    case when exists (select 1 from profiles) then 'parent' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- =====================================================================
-- Academic setup
-- =====================================================================
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  section text,
  unique (name, section)
);

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists exams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  term text,
  max_marks int not null default 100 check (max_marks > 0),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Students, parents, admissions
-- =====================================================================
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  admission_no text not null unique
    default ('ADM' || to_char(now(), 'YY') || lpad(nextval('admission_seq')::text, 4, '0')),
  full_name text not null,
  dob date,
  gender text check (gender in ('M','F','O')),
  class_id uuid references classes on delete set null,
  guardian_name text,
  guardian_phone text,
  address text,
  status text not null default 'active' check (status in ('active','left')),
  created_at timestamptz not null default now()
);
create index if not exists students_class_idx on students (class_id);

-- One parent login can be linked to many children (and a child to many parents).
create table if not exists parent_students (
  parent_id uuid not null references profiles on delete cascade,
  student_id uuid not null references students on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);
create index if not exists parent_students_student_idx on parent_students (student_id);

create table if not exists admissions (
  id uuid primary key default gen_random_uuid(),
  applicant_name text not null,
  dob date,
  gender text check (gender in ('M','F','O')),
  applying_class_id uuid references classes on delete set null,
  guardian_name text,
  guardian_phone text,
  notes text,
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','enrolled')),
  student_id uuid references students on delete set null,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Fees
-- =====================================================================
create table if not exists fee_invoices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students on delete cascade,
  title text not null,
  amount numeric(10,2) not null check (amount > 0),
  due_date date not null,
  created_at timestamptz not null default now()
);
create index if not exists fee_invoices_student_idx on fee_invoices (student_id);

create table if not exists fee_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references fee_invoices on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  paid_on date not null default current_date,
  mode text not null default 'cash' check (mode in ('cash','upi','card','bank','cheque')),
  receipt_no text not null unique default ('RCP' || lpad(nextval('receipt_seq')::text, 5, '0')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists fee_payments_invoice_idx on fee_payments (invoice_id);

create or replace view fee_invoice_balances with (security_invoker = true) as
select i.*,
       coalesce(sum(p.amount), 0) as paid,
       i.amount - coalesce(sum(p.amount), 0) as balance
from fee_invoices i
left join fee_payments p on p.invoice_id = i.id
group by i.id;

create or replace view fee_summary with (security_invoker = true) as
select coalesce((select sum(amount) from fee_invoices), 0) as billed,
       coalesce((select sum(amount) from fee_payments), 0) as collected;

-- =====================================================================
-- Attendance and marks
-- =====================================================================
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students on delete cascade,
  date date not null,
  status text not null check (status in ('present','absent','late')),
  unique (student_id, date)
);
create index if not exists attendance_date_idx on attendance (date);

create table if not exists marks (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams on delete cascade,
  student_id uuid not null references students on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  marks_obtained numeric(6,2) not null check (marks_obtained >= 0),
  unique (exam_id, student_id, subject_id)
);

-- =====================================================================
-- Timetable
-- =====================================================================
create table if not exists periods (
  period int primary key check (period between 1 and 12),
  label text,
  start_time time not null,
  end_time time not null
);
insert into periods (period, label, start_time, end_time) values
  (1, 'Period 1', '08:00', '08:40'), (2, 'Period 2', '08:40', '09:20'),
  (3, 'Period 3', '09:20', '10:00'), (4, 'Period 4', '10:20', '11:00'),
  (5, 'Period 5', '11:00', '11:40'), (6, 'Period 6', '11:40', '12:20'),
  (7, 'Period 7', '12:50', '13:30'), (8, 'Period 8', '13:30', '14:10')
on conflict (period) do nothing;

create table if not exists timetable_slots (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes on delete cascade,
  day int not null check (day between 1 and 6),            -- 1 = Monday ... 6 = Saturday
  period int not null references periods (period),
  subject_id uuid references subjects on delete set null,
  teacher_id uuid references profiles on delete set null,
  room text,
  unique (class_id, day, period)
);
-- A teacher cannot be in two classes in the same period.
create unique index if not exists tt_teacher_unique
  on timetable_slots (teacher_id, day, period) where teacher_id is not null;

-- =====================================================================
-- Library
-- =====================================================================
create table if not exists books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  isbn text,
  category text,
  copies int not null default 1 check (copies >= 0),
  created_at timestamptz not null default now()
);

create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references books on delete cascade,
  student_id uuid not null references students on delete cascade,
  issued_on date not null default current_date,
  due_on date not null,
  returned_on date,
  fine numeric(8,2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists loans_open_idx on loans (book_id) where returned_on is null;
create index if not exists loans_student_idx on loans (student_id);

-- Never lend more copies than the library owns (row lock stops two people racing).
create or replace function check_book_available() returns trigger
language plpgsql as $$
declare total int; lent int;
begin
  select copies into total from books where id = new.book_id for update;
  select count(*) into lent from loans where book_id = new.book_id and returned_on is null;
  if lent >= coalesce(total, 0) then
    raise exception 'No copies of this book are available';
  end if;
  return new;
end $$;

drop trigger if exists loans_check_available on loans;
create trigger loans_check_available before insert on loans
  for each row execute function check_book_available();

create or replace view book_availability with (security_invoker = true) as
select b.*, b.copies - (count(l.id) filter (where l.returned_on is null))::int as available
from books b
left join loans l on l.book_id = b.id
group by b.id;

-- =====================================================================
-- Staff directory (HR)
-- =====================================================================
create table if not exists staff_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  designation text,
  department text,
  phone text,
  email text,
  joined_on date,
  status text not null default 'active' check (status in ('active','left')),
  notes text,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Security helpers (SECURITY DEFINER so policies don't recurse into profiles' own RLS)
-- =====================================================================
create or replace function auth_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active
$$;

create or replace function my_student_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select ps.student_id
  from parent_students ps
  join profiles p on p.id = ps.parent_id
  where ps.parent_id = auth.uid() and p.active and p.role = 'parent'
$$;

revoke all on function auth_role(), my_student_ids() from public, anon;
grant execute on function auth_role(), my_student_ids() to authenticated;
grant usage on sequence admission_seq, receipt_seq to authenticated;

-- =====================================================================
-- Row Level Security: enable everywhere, wipe old policies, create the new ones
-- =====================================================================
do $$
declare t text; p record;
begin
  for t in select unnest(array[
    'profiles','classes','subjects','exams','periods','timetable_slots','students',
    'parent_students','admissions','fee_invoices','fee_payments','attendance','marks',
    'books','loans','staff_members'
  ]) loop
    execute format('alter table %I enable row level security', t);
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on %I', p.policyname, t);
    end loop;
  end loop;
end $$;

-- Reference data: any active signed-in user can read, only admin can change.
do $$
declare t text;
begin
  for t in select unnest(array['classes','subjects','exams','periods','timetable_slots']) loop
    execute format('create policy "signed-in read" on %I for select to authenticated using (auth_role() is not null)', t);
    execute format('create policy "admin write" on %I for all to authenticated using (auth_role() = ''admin'') with check (auth_role() = ''admin'')', t);
  end loop;
end $$;

-- profiles: everyone sees themselves, staff see staff, only admin changes anything.
create policy "own profile" on profiles for select to authenticated using (id = auth.uid());
create policy "staff read profiles" on profiles for select to authenticated
  using (auth_role() in ('admin','teacher','hr','accounts'));
create policy "admin manage profiles" on profiles for all to authenticated
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- students: admin writes; admin/teacher/accounts read; a parent reads only their children.
create policy "staff read students" on students for select to authenticated
  using (auth_role() in ('admin','teacher','accounts'));
create policy "parent reads own children" on students for select to authenticated
  using (id in (select my_student_ids()));
create policy "admin write students" on students for all to authenticated
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- parent <-> child links: admin manages, a parent sees their own links.
create policy "admin manage links" on parent_students for all to authenticated
  using (auth_role() = 'admin') with check (auth_role() = 'admin');
create policy "parent reads own links" on parent_students for select to authenticated
  using (parent_id = auth.uid());

-- admissions: admin only.
create policy "admin admissions" on admissions for all to authenticated
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- fees: admin + accounts; parents read their children's.
create policy "accounts manage invoices" on fee_invoices for all to authenticated
  using (auth_role() in ('admin','accounts')) with check (auth_role() in ('admin','accounts'));
create policy "parent reads own invoices" on fee_invoices for select to authenticated
  using (student_id in (select my_student_ids()));
create policy "accounts manage payments" on fee_payments for all to authenticated
  using (auth_role() in ('admin','accounts')) with check (auth_role() in ('admin','accounts'));
create policy "parent reads own payments" on fee_payments for select to authenticated
  using (invoice_id in (select id from fee_invoices where student_id in (select my_student_ids())));

-- attendance + marks: admin + teachers; parents read their children's.
create policy "teachers manage attendance" on attendance for all to authenticated
  using (auth_role() in ('admin','teacher')) with check (auth_role() in ('admin','teacher'));
create policy "parent reads own attendance" on attendance for select to authenticated
  using (student_id in (select my_student_ids()));
create policy "teachers manage marks" on marks for all to authenticated
  using (auth_role() in ('admin','teacher')) with check (auth_role() in ('admin','teacher'));
create policy "parent reads own marks" on marks for select to authenticated
  using (student_id in (select my_student_ids()));

-- library: catalogue readable by all; admin + teachers run the library; parents see their children's loans.
create policy "signed-in read books" on books for select to authenticated using (auth_role() is not null);
create policy "library staff manage books" on books for all to authenticated
  using (auth_role() in ('admin','teacher')) with check (auth_role() in ('admin','teacher'));
create policy "library staff manage loans" on loans for all to authenticated
  using (auth_role() in ('admin','teacher')) with check (auth_role() in ('admin','teacher'));
create policy "parent reads own loans" on loans for select to authenticated
  using (student_id in (select my_student_ids()));

-- staff directory: HR + admin.
create policy "hr manage staff" on staff_members for all to authenticated
  using (auth_role() in ('admin','hr')) with check (auth_role() in ('admin','hr'));
