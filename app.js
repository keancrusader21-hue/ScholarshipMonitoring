// PASTE YOUR ANON/PUBLISHABLE KEY BELOW (copy it from your old app.js line 2)
const SUPABASE_URL='https://oayzaphycarjqrdkjmfh.supabase.co', 
SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9heXphcGh5Y2FyanFyZGtqbWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MTQyNzMsImV4cCI6MjEwNjI5MDI3M30.YCVzBjxLSazOcr2wT5xn2mYKNmz4A2ITsy8yuk6hztA';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s), V=h=>$('#view').innerHTML=h; let me;
const isStaff=()=>['admin','staff','coordinator'].includes(me.role);
const NAV={staff:['Dashboard','Scholars','Scholarship Programs','Grade Submissions','Compliance'],scholar:['Grade Submissions','Compliance']};
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';setTimeout(()=>e.style.display='none',3000)}
const table=(h,r)=>`<div class="tw"><table><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${r.join('')||`<tr><td colspan="${h.length}">Nothing here yet.</td></tr>`}</table></div>`;
const opts=(a,f)=>a.map(x=>`<option value="${x.id}">${esc(f(x))}</option>`).join('');

// Module 1: Authentication
$('#login').onclick=async()=>{const{error}=await db.auth.signInWithPassword({email:$('#email').value,password:$('#pass').value});error?$('#authmsg').textContent=error.message:boot()};
$('#signup').onclick=async()=>{if(!$('#name').value||$('#pass').value.length<6)return $('#authmsg').textContent='Enter your name and a 6+ character password';
 const{error}=await db.auth.signUp({email:$('#email').value,password:$('#pass').value,options:{data:{full_name:$('#name').value}}});
 $('#authmsg').textContent=error?error.message:'Account created. Log in now (new accounts are Scholars).'};
$('#logout').onclick=async()=>{await db.auth.signOut();location.reload()};
async function boot(){const{data:{session}}=await db.auth.getSession();if(!session)return;
 me=(await db.from('profiles').select('*').eq('id',session.user.id).single()).data;
 $('#auth').hidden=true;$('#app').hidden=false;$('#who').textContent=`${me.full_name} (${me.role})`;
 const nav=isStaff()?NAV.staff:NAV.scholar;$('#tabs').innerHTML=nav.map(t=>`<button>${t}</button>`).join('');
 $('#tabs').onclick=e=>e.target.tagName==='BUTTON'&&go(e.target.textContent);go(nav[0])}
function go(t){document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.textContent===t));views[t]()}

const views={
async Dashboard(){const c=(t,f)=>{const q=db.from(t).select('*',{count:'exact',head:true});return f?f(q):q};
 const r=await Promise.all([c('scholars'),c('grade_submissions',q=>q.eq('submission_status','Pending')),c('grade_submissions',q=>q.eq('submission_status','Verified')),c('scholars',q=>q.eq('status','Compliant')),c('scholars',q=>q.eq('status','With Deficiency'))]);
 const L=['Total scholars','Pending grade submissions','Verified submissions','Compliant scholars','With deficiency'];
 V(`<h2>Dashboard</h2><div class="cards">${L.map((l,i)=>`<div class="card"><b>${r[i].count??0}</b>${l}</div>`).join('')}</div>`)},

// Module 3: Scholarship requirements (per program, nothing hard-coded)
async 'Scholarship Programs'(){const{data}=await db.from('scholarship_programs').select('*').order('program_name');
 V(`<h2>Scholarship programs</h2><form class="f" id="nf"><input name="program_name" placeholder="Program name" required><input name="required_gwa" type="number" step="0.01" min="1" max="5" placeholder="Required GWA (highest allowed)" required>
 <input name="min_units" type="number" min="0" placeholder="Minimum units" required><select name="allow_falling_grade"><option value="false">Failing grades not allowed</option><option value="true">Failing grades allowed</option></select><button>Save program</button></form>
 ${table(['Program','Required GWA','Min units','Failing grade','Active'],data.map(p=>`<tr><td>${esc(p.program_name)}</td><td>${p.required_gwa}</td><td>${p.min_units}</td><td>${p.allow_falling_grade?'Allowed':'Not allowed'}</td><td>${p.active?'Yes':'No'}</td></tr>`))}
 <p>Grading scale: 1.0 is the highest and 5.0 is failing, so a GWA must be at or below the required value.</p>`);
 $('#nf').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target));o.allow_falling_grade=o.allow_falling_grade==='true';
  const{error}=await db.from('scholarship_programs').insert(o);toast(error?error.message:'Program saved');if(!error)views['Scholarship Programs']()}},

// Module 2: Scholar management (create, read, update, search, filter)
async Scholars(){const[{data:sc},{data:pr}]=await Promise.all([db.from('scholars').select('*,scholarship_programs(program_name)').order('full_name'),db.from('scholarship_programs').select('*').eq('active',true)]);
 V(`<h2>Scholars</h2><form class="f" id="nf"><input type="hidden" name="id"><input name="student_id" placeholder="Student ID" required><input name="full_name" placeholder="Full name" required><input name="degree_program" placeholder="Degree program" required>
 <select name="year_level" required><option value="">Year level</option>${[1,2,3,4,5].map(n=>`<option>${n}</option>`).join('')}</select><select name="scholarship_id" required><option value="">Scholarship program</option>${opts(pr,p=>p.program_name)}</select>
 <input name="email" type="email" placeholder="Scholar login email (optional)"><button>Save scholar</button></form>
 <div class="row"><input id="q" placeholder="Search Student ID or name"><select id="fp"><option value="">All programs</option>${opts(pr,p=>p.program_name)}</select>
 <select id="fs"><option value="">All statuses</option>${['Active','For Verification','Compliant','With Deficiency'].map(s=>`<option>${s}</option>`).join('')}</select></div><div id="list"></div>`);
 const draw=()=>{const q=$('#q').value.toLowerCase(),p=$('#fp').value,s=$('#fs').value;
  $('#list').innerHTML=table(['Student ID','Name','Degree','Year','Scholarship','Status',''],sc.filter(x=>(!p||x.scholarship_id==p)&&(!s||x.status===s)&&(x.student_id+x.full_name).toLowerCase().includes(q))
   .map(x=>`<tr><td>${esc(x.student_id)}</td><td>${esc(x.full_name)}</td><td>${esc(x.degree_program)}</td><td>${x.year_level}</td><td>${esc(x.scholarship_programs?.program_name)}</td><td><span class="tag">${x.status}</span></td><td><button class="alt" data-e="${x.id}">Edit</button></td></tr>`))};
 draw();['#q','#fp','#fs'].forEach(s=>$(s).oninput=draw);
 $('#list').onclick=e=>{const x=sc.find(y=>y.id==e.target.dataset.e);if(!x)return;const f=$('#nf').elements;for(const k of ['id','student_id','full_name','degree_program','year_level','scholarship_id','email'])f[k].value=x[k]??'';scrollTo(0,0)};
 $('#nf').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target));o.student_id=o.student_id.trim();if(!o.student_id)return toast('Student ID cannot be blank');
  const id=o.id;delete o.id;o.year_level=+o.year_level;o.scholarship_id=+o.scholarship_id;o.email=o.email||null;
  const{error}=id?await db.from('scholars').update(o).eq('id',id):await db.from('scholars').insert(o);
  toast(error?(error.code==='23505'?'Student ID or email already exists':error.message):'Scholar saved');if(!error)views.Scholars()}},

// Module 4: Grade submission and verification (verify triggers the evaluation in the database)
async 'Grade Submissions'(){const{data:sc}=await db.from('scholars').select('id,student_id,full_name').order('full_name');
 const{data:gs}=await db.from('grade_submissions').select('*,scholars(student_id,full_name)').order('submitted_at',{ascending:false});
 V(`<h2>Grade submissions</h2><form class="f" id="gf">${isStaff()?`<select name="scholar_id" required><option value="">Scholar</option>${opts(sc,s=>s.student_id+' '+s.full_name)}</select>`:''}
 <input name="academic_year" placeholder="Academic year (2025-2026)" required><select name="semester"><option>1st</option><option>2nd</option><option>Summer</option></select>
 <input name="gwa" type="number" step="0.01" min="1" max="5" placeholder="GWA (1.0 to 5.0)" required><input name="units_enrolled" type="number" min="0" placeholder="Units enrolled" required>
 <input name="failed_subjects" type="number" min="0" placeholder="Failed subjects" required><input name="incomplete_subjects" type="number" min="0" placeholder="Incomplete subjects" required><button>Submit grades</button></form>
 ${table(['Scholar','Term','GWA','Units','Failed','Incomplete','Status',''],gs.map(g=>`<tr><td>${esc(g.scholars.full_name)}</td><td>${g.academic_year} ${g.semester}</td><td>${g.gwa}</td><td>${g.units_enrolled}</td><td>${g.failed_subjects}</td><td>${g.incomplete_subjects}</td><td><span class="tag">${g.submission_status}</span></td>
 <td>${isStaff()&&g.submission_status==='Pending'?`<button data-v="${g.id}">Verify</button><button class="bad" data-r="${g.id}">Return</button>`:''}</td></tr>`))}`);
 $('#gf').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target));for(const k of ['gwa','units_enrolled','failed_subjects','incomplete_subjects'])o[k]=+o[k];
  if(isStaff())o.scholar_id=+o.scholar_id;else{const{data:m}=await db.from('scholars').select('id').maybeSingle();if(!m)return toast('No scholar record is linked to your email. Ask staff to register you.');o.scholar_id=m.id}
  const{error}=await db.from('grade_submissions').insert(o);toast(error?(error.code==='23505'?'This term was already submitted':error.message):'Saved with status Pending');if(!error)views['Grade Submissions']()};
 $('#view').onclick=async e=>{const{v,r}=e.target.dataset;if(!v&&!r)return;
  const{error}=await db.from('grade_submissions').update({submission_status:v?'Verified':'Returned'}).eq('id',v||r);toast(error?error.message:v?'Verified and evaluated':'Returned to scholar');views['Grade Submissions']()}},

// Module 5: Compliance evaluation results
async Compliance(){const{data}=await db.from('grade_submissions').select('*,scholars(student_id,full_name)').eq('submission_status','Verified').order('verified_at',{ascending:false});
 V(`<h2>Compliance</h2><p>Rule: a semester is <b>Compliant</b> when the GWA is at or below the program's required GWA (1.0 is best), units enrolled meet the minimum, and failed subjects are allowed by the program. Otherwise it is <b>With Deficiency</b>.</p>
 ${table(['Scholar','Term','GWA','Units','Failed','Result','Reason'],data.map(g=>`<tr><td>${esc(g.scholars.full_name)}</td><td>${g.academic_year} ${g.semester}</td><td>${g.gwa}</td><td>${g.units_enrolled}</td><td>${g.failed_subjects}</td><td><span class="tag">${g.evaluation_result}</span></td><td>${esc(g.evaluation_notes||'All requirements met')}</td></tr>`))}`)}};
boot();
