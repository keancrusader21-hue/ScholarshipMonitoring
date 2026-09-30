-- Run this whole file in Supabase > SQL Editor
create table profiles(id uuid primary key references auth.users on delete cascade, full_name text, email text,
  role text not null default 'scholar' check (role in ('scholar','staff','coordinator','committee','registrar','admin')));
create table scholarships(id bigserial primary key, name text not null unique, max_gwa numeric not null default 2.0,
  max_lowest_grade numeric not null default 2.5, min_units int not null default 15, active boolean default true);
create table scholars(id bigserial primary key, student_no text unique not null, full_name text not null, email text unique not null,
  program text, scholarship_id bigint references scholarships(id),
  status text not null default 'Active' check (status in ('Active','Pending Submission','For Verification','Compliant','With Deficiency','Probationary','For Renewal','Renewed','Disqualified')),
  created_at timestamptz default now());
create table grade_submissions(id bigserial primary key, scholar_id bigint not null references scholars(id), academic_year text not null,
  semester text not null, gwa numeric not null, lowest_grade numeric not null, units int not null, remarks text,
  status text not null default 'Pending' check (status in ('Pending','Verified','Rejected')),
  evaluated boolean default false, submitted_at timestamptz default now(), verified_by uuid, verified_at timestamptz,
  unique(scholar_id, academic_year, semester));
create table deficiencies(id bigserial primary key, scholar_id bigint not null references scholars(id),
  submission_id bigint references grade_submissions(id), description text not null, resolved boolean default false, created_at timestamptz default now());
create table audit_log(id bigserial primary key, action text, record_id bigint, user_id uuid default auth.uid(), details text, created_at timestamptz default now());

-- helpers
create function my_role() returns text language sql stable security definer as $$ select role from profiles where id=auth.uid() $$;
create function my_scholar_id() returns bigint language sql stable security definer as $$
  select id from scholars where lower(email)=lower(auth.jwt()->>'email') $$;
create function is_staff() returns boolean language sql stable as $$ select coalesce(my_role() in ('staff','coordinator','committee','registrar','admin'),false) $$;
create function can_manage() returns boolean language sql stable as $$ select coalesce(my_role() in ('staff','coordinator','admin'),false) $$;

-- auto-create profile on signup (always 'scholar'; promote via SQL below)
create function handle_new_user() returns trigger language plpgsql security definer as $$
begin insert into profiles(id,email,full_name) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.email)); return new; end $$;
create trigger on_signup after insert on auth.users for each row execute function handle_new_user();

-- BR-09 no double verification + BR-08 traceability
create function guard_submission() returns trigger language plpgsql as $$
begin
  if old.status='Verified' and new.status<>'Verified' then raise exception 'Already verified: use an authorized correction process'; end if;
  if old.status='Verified' and (new.gwa<>old.gwa or new.lowest_grade<>old.lowest_grade or new.units<>old.units) then raise exception 'Verified records cannot be edited'; end if;
  if new.status<>old.status then insert into audit_log(action,record_id,details) values('submission '||new.status,new.id,'from '||old.status); end if;
  return new; end $$;
create trigger trg_guard before update on grade_submissions for each row execute function guard_submission();

-- RLS
alter table profiles enable row level security; alter table scholarships enable row level security; alter table scholars enable row level security;
alter table grade_submissions enable row level security; alter table deficiencies enable row level security; alter table audit_log enable row level security;
create policy p_sel on profiles for select using (id=auth.uid() or is_staff());
create policy p_upd on profiles for update using (my_role()='admin');
create policy sch_sel on scholarships for select using (auth.uid() is not null);
create policy sch_all on scholarships for all using (my_role() in ('coordinator','admin')) with check (my_role() in ('coordinator','admin'));
create policy s_sel on scholars for select using (is_staff() or id=my_scholar_id());
create policy s_ins on scholars for insert with check (can_manage());
create policy s_upd on scholars for update using (can_manage());
create policy g_sel on grade_submissions for select using (is_staff() or scholar_id=my_scholar_id());
create policy g_ins on grade_submissions for insert with check (can_manage() or scholar_id=my_scholar_id());
create policy g_upd on grade_submissions for update using (can_manage());
create policy d_sel on deficiencies for select using (is_staff() or scholar_id=my_scholar_id());
create policy d_all on deficiencies for all using (can_manage()) with check (can_manage());
create policy a_ins on audit_log for insert with check (auth.uid() is not null);
create policy a_sel on audit_log for select using (is_staff());

insert into scholarships(name,max_gwa,max_lowest_grade,min_units) values ('University Merit',1.75,2.5,15),('CHED Scholarship',2.0,2.5,15),('Private Grant',2.25,3.0,12);

-- After you sign up your accounts in the app, promote them, e.g.:
-- update profiles set role='coordinator' where email='you@email.com';
