# School ERP (Next.js + Supabase)

A small school management app that runs on **Next.js + Supabase only** and deploys on Vercel.

**Modules:** students · admissions · fees · attendance · marks and report cards · timetable · library · staff (HR) · user and role management · parent portal · three AI helpers.

## Roles: who can do what

| | Admin | Teacher | Accounts | HR | Parent |
|---|:-:|:-:|:-:|:-:|:-:|
| Dashboard | ✅ full | ✅ my classes today | ✅ fees | ✅ staff count | own portal |
| Students | ✅ edit | 👁 view | 👁 view | – | own children only |
| Admissions | ✅ | – | – | – | – |
| Fees and receipts | ✅ | – | ✅ | – | own children, view |
| Attendance | ✅ | ✅ | – | – | own children, view |
| Marks / report cards | ✅ | ✅ | – | – | own children, view |
| Timetable | ✅ edit | 👁 view | – | – | own child's class |
| Library (books, issue, return) | ✅ | ✅ | – | – | own child's loans |
| Staff directory | ✅ | – | – | ✅ | – |
| Users, roles, parent links, Setup | ✅ | – | – | – | – |

These rules are enforced in the **database** (Postgres Row Level Security), not only in the menus. Someone who calls Supabase directly with a teacher's login still can't read fees.

## Parents: one login, many children
A parent account is linked to any number of students (`parent_students` table), so a parent with three kids signs in once and sees a card for each child. Link kids in any of these ways:
- Users → *Create a login* → role **parent** → enter admission numbers, comma-separated.
- Users → a parent's *More* → *Link child*.
- A student's profile → *Parent logins* → pick an existing parent.

Each child page shows attendance, fees and receipts, results, class timetable and library loans. Parents are read-only, and fees are paid at the school office (no online payments).

## Setup
1. **Supabase:** create a project. In *SQL Editor* run `supabase/schema.sql`, then optionally `supabase/seed.sql`.
   The schema is safe to re-run. If you ran the earlier version, running this one upgrades it and replaces the permissive policies.
2. **First admin:** *Authentication → Users → Add user* (email + password). **The first user ever created becomes admin.** If you already had a login from the earlier version, it stays admin.
3. In *Authentication → Sign In / Providers*, turn **off** "Allow new users to sign up". Everyone else is created by the admin inside the app (Users page).
4. **Environment:** copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (*Project Settings → API*)
   - `SUPABASE_SERVICE_ROLE_KEY` (same page, `service_role`). **Server only; never expose it.** It's used just by the Users page to create logins and reset passwords, after confirming the caller is an admin.
   - optional `ANTHROPIC_API_KEY` for AI text
5. `npm install && npm run dev`, open http://localhost:3000, sign in as the admin, then:
   **Setup** (classes, subjects, exams, period timings) → **Users** (create teachers, accounts, HR, parents) → **Students**.

## Deploy on Vercel
Push to GitHub, import the repo in Vercel, add the same environment variables (including `SUPABASE_SERVICE_ROLE_KEY`), deploy.

## Module notes
- **Timetable:** Mon–Sat grid by class or by teacher. Period times are editable in Setup. The database blocks a teacher from being in two classes in the same period; the app shows a clear message.
- **Library:** catalogue with live availability; issue to a student by admission number; due date defaults to `LIBRARY_LOAN_DAYS` (14); on return, late fine = days late × `LIBRARY_FINE_PER_DAY` (₹1). The database refuses to lend more copies than exist. Admin and teachers run the library.
- **Staff (HR):** directory of staff records (designation, department, contact, joined date, left/active). It is separate from logins: the admin gives someone a login on the Users page.
- **Users:** create logins, change roles, link parents, reset passwords, disable or enable accounts. Disabling takes effect immediately, including for people already signed in.
- **AI:** dashboard insights (admin), report-card remarks (admin, teacher), fee reminders (admin, accounts). Only first names, marks and amounts are sent. Without a key you get built-in text templates.

## Security notes
- New sign-ups default to the **parent** role (which sees nothing until children are linked). Roles are never taken from sign-up form data.
- Admins can't change their own role or disable themselves, to avoid locking everyone out.
- Passwords you set for users are shown to nobody afterwards. Share them securely and ask people to change them.

## Not built yet
- Teacher-level scoping (any teacher can mark any class; there's no "class teacher" assignment).
- Staff leave, attendance and payroll (HR is a directory only).
- Online fee payment, SMS/WhatsApp sending (reminders are drafted to copy), notices/circulars, transport, hostel.
- Teacher names are hidden from parents on the timetable (subjects and rooms are shown).
- A separate librarian role (teachers and admin run the library for now).
