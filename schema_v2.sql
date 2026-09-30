-- Part II schema. Run once in Supabase > SQL Editor. (Keeps profiles/auth; replaces the old tables and test data.)
drop table if exists audit_log, deficiencies, grade_submissions, scholars, scholarships, scholarship_programs cascade;
drop function if exists guard_submission();

create table scholarship_programs(id bigserial primary key, program_name text unique not null,
  required_gwa numeric not null check (required_gwa between 1 and 5), min_units int not null check (min_units>=0),
  allow_falling_grade boolean not null default false, active boolean not null default true);

create table scholars(id bigserial primary key, student_id text unique not null check (length(trim(student_id))>0),
  full_name text not null, degree_program text not null, year_level int not null check (year_level between 1 and 6),
  scholarship_id bigint not null references scholarship_programs(id), email text unique,
  status text not null default 'Active' check (status in ('Active','For Verification','Compliant','With Deficiency')));

create table grade_submissions(id bigserial primary key, scholar_id bigint not null references scholars(id),
  academic_year text not null, semester text not null check (semester in ('1st','2nd','Summer')),
  gwa numeric not null check (gwa between 1 and 5), units_enrolled int not null check (units_enrolled>=0),
  failed_subjects int not null default 0 check (failed_subjects>=0), incomplete_subjects int not null default 0 check (incomplete_subjects>=0),
  submission_status text not null default 'Pending' check (submission_status in ('Pending','Verified','Returned')),
  evaluation_result text check (evaluation_result in ('Compliant','With Deficiency')), evaluation_notes text,
  submitted_at timestamptz default now(), verified_by uuid references auth.users, verified_at timestamptz,
  unique(scholar_id, academic_year, semester));

create or replace function can_manage() returns boolean language sql stable security definer set search_path=public as
$$ select coalesce((select role in ('admin','staff','coordinator') from profiles where id=auth.uid()),false) $$;
create or replace function my_scholar_id() returns bigint language sql stable security definer set search_path=public as
$$ select id from scholars where lower(email)=lower(auth.jwt()->>'email') $$;

-- New submission -> scholar becomes "For Verification"
create or replace function on_submit() returns trigger language plpgsql security definer set search_path=public as
$$ begin update scholars set status='For Verification' where id=new.scholar_id; return new; end $$;
create trigger trg_submit after insert on grade_submissions for each row execute function on_submit();

-- Verification -> automatic compliance evaluation (the documented rule). Verified records are final.
create or replace function on_verify() returns trigger language plpgsql security definer set search_path=public as $$
declare p scholarship_programs; n text[] := '{}';
begin
  if old.submission_status='Verified' then raise exception 'Verified submissions are final'; end if;
  if new.submission_status='Verified' then
    select sp.* into p from scholars s join scholarship_programs sp on sp.id=s.scholarship_id where s.id=new.scholar_id;
    if new.gwa > p.required_gwa then n := n || format('GWA %s is above the allowed %s', new.gwa, p.required_gwa); end if;
    if new.units_enrolled < p.min_units then n := n || format('Units %s are below the minimum %s', new.units_enrolled, p.min_units); end if;
    if new.failed_subjects > 0 and not p.allow_falling_grade then n := n || format('%s failed subject(s) not allowed', new.failed_subjects); end if;
    new.evaluation_result := case when array_length(n,1) is null then 'Compliant' else 'With Deficiency' end;
    new.evaluation_notes := array_to_string(n,'; ');
    new.verified_at := now(); new.verified_by := auth.uid();
    update scholars set status=new.evaluation_result where id=new.scholar_id;
  end if;
  return new;
end $$;
create trigger trg_verify before update on grade_submissions for each row execute function on_verify();

alter table scholarship_programs enable row level security; alter table scholars enable row level security; alter table grade_submissions enable row level security;
create policy sp_sel on scholarship_programs for select using (auth.uid() is not null);
create policy sp_ins on scholarship_programs for insert with check (can_manage());
create policy sp_upd on scholarship_programs for update using (can_manage());
create policy s_sel on scholars for select using (can_manage() or id=my_scholar_id());
create policy s_ins on scholars for insert with check (can_manage());
create policy s_upd on scholars for update using (can_manage());
create policy g_sel on grade_submissions for select using (can_manage() or scholar_id=my_scholar_id());
create policy g_ins on grade_submissions for insert with check (submission_status='Pending' and (can_manage() or scholar_id=my_scholar_id()));
create policy g_upd on grade_submissions for update using (can_manage());

insert into scholarship_programs(program_name,required_gwa,min_units,allow_falling_grade) values
 ('University Merit',1.75,15,false),('CHED Scholarship',2.0,15,false),('Private Grant',2.5,12,true);
insert into scholars(student_id,full_name,degree_program,year_level,scholarship_id,email) values
 ('2024-0001','Demo Scholar','BSIT',2,(select id from scholarship_programs where program_name='CHED Scholarship'),'demo.scholar@example.com');
