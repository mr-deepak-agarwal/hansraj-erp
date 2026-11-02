-- Optional starter data. Safe to run more than once.
insert into classes (name, section) values
  ('Nursery', 'A'), ('1', 'A'), ('2', 'A'), ('3', 'A'), ('4', 'A'), ('5', 'A')
on conflict do nothing;

insert into subjects (name) values
  ('English'), ('Hindi'), ('Mathematics'), ('Science'), ('Social Studies')
on conflict do nothing;

insert into exams (name, term, max_marks)
select 'Unit Test 1', 'Term 1', 25
where not exists (select 1 from exams where name = 'Unit Test 1');

insert into exams (name, term, max_marks)
select 'Half Yearly', 'Term 1', 100
where not exists (select 1 from exams where name = 'Half Yearly');
