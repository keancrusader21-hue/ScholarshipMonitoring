
const SUPABASE_URL='https://oayzaphycarjqrdkjmfh.supabase.co', 
SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9heXphcGh5Y2FyanFyZGtqbWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MTQyNzMsImV4cCI6MjEwNjI5MDI3M30.YCVzBjxLSazOcr2wT5xn2mYKNmz4A2ITsy8yuk6hztA';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);


const $=s=>document.querySelector(s); let me=null, tab='dashboard';
const STAT=['Active','Pending Submission','For Verification','Compliant','With Deficiency','Probationary','For Renewal','Renewed','Disqualified'];
const TABS={scholar:['dashboard','grades','deficiencies'],staff:['dashboard','scholars','grades','deficiencies','report'],
 coordinator:['dashboard','scholars','scholarships','grades','deficiencies','report'],committee:['dashboard','scholars','report'],
 registrar:['dashboard','scholars','report'],admin:['dashboard','scholars','scholarships','grades','deficiencies','report']};
const canManage=()=>['staff','coordinator','admin'].includes(me.role);
function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';setTimeout(()=>e.style.display='none',2800)}
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function log(action,id,details){await db.from('audit_log').insert({action,record_id:id,details})}

// ---- Auth (Login / Logout)
$('#login').onclick=async()=>{const{error}=await db.auth.signInWithPassword({email:$('#email').value,password:$('#pass').value});if(error)$('#authmsg').textContent=error.message;else boot()};
$('#signup').onclick=async()=>{if(!$('#name').value||$('#pass').value.length<6)return $('#authmsg').textContent='Enter name and a 6+ character password';
 const{error}=await db.auth.signUp({email:$('#email').value,password:$('#pass').value,options:{data:{full_name:$('#name').value}}});
 $('#authmsg').textContent=error?error.message:'Account created. Log in now (new accounts are Scholars).'};
$('#logout').onclick=async()=>{await db.auth.signOut();location.reload()};
async function boot(){const{data:{session}}=await db.auth.getSession();if(!session)return;
 const{data}=await db.from('profiles').select('*').eq('id',session.user.id).single();me=data;
 $('#auth').hidden=true;$('#app').hidden=false;$('#who').textContent=`${me.full_name} (${me.role})`;
 $('#tabs').innerHTML=TABS[me.role].map(t=>`<button data-t="${t}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('');
 $('#tabs').onclick=e=>{if(e.target.dataset.t)go(e.target.dataset.t)};go('dashboard')}
function go(t){tab=t;document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));views[t]()}
const table=(h,rows)=>`<div class="tw"><table><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${rows.join('')||`<tr><td colspan="${h.length}">Nothing here yet.</td></tr>`}</table></div>`;
const V=h=>$('#view').innerHTML=h;

const views={
// ---- Dashboard
async dashboard(){const{data}=await db.from('scholars').select('status');const c={};(data||[]).forEach(s=>c[s.status]=(c[s.status]||0)+1);
 V(`<h2>Dashboard</h2><div class="cards">${STAT.map(s=>`<div class="card"><b>${c[s]||0}</b>${s}</div>`).join('')}</div>`)},
// ---- Scholars: register, assign, search, filter, status, renewal
async scholars(){const[{data:sc},{data:sp}]=await Promise.all([db.from('scholars').select('*,scholarships(name)').order('full_name'),db.from('scholarships').select('*').eq('active',true)]);
 const draw=()=>{const q=$('#q').value.toLowerCase(),f=$('#fs').value;
  $('#list').innerHTML=table(['Student no.','Name','Scholarship','Status','Actions'],sc.filter(s=>(!f||s.status===f)&&(s.full_name+s.student_no).toLowerCase().includes(q)).map(s=>`<tr><td>${esc(s.student_no)}</td><td>${esc(s.full_name)}</td><td>${esc(s.scholarships?.name||'Unassigned')}</td><td><span class="tag">${s.status}</span></td>
  <td>${canManage()?`<button data-r="${s.id}">Process renewal</button> <button class="bad" data-d="${s.id}">Disqualify</button>`:''}</td></tr>`))};
 V(`<h2>Scholars</h2>${canManage()?`<form class="f" id="nf"><input name="student_no" placeholder="Student no." required><input name="full_name" placeholder="Full name" required><input name="email" type="email" placeholder="Scholar login email" required><input name="program" placeholder="Program">
 <select name="scholarship_id" required><option value="">Assign scholarship</option>${sp.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select><button>Register scholar</button></form>`:''}
 <div class="row"><input id="q" placeholder="Search name or number"><select id="fs"><option value="">All statuses</option>${STAT.map(s=>`<option>${s}</option>`).join('')}</select>
 ${canManage()?'<button id="pend" class="alt">Mark pending for a term</button>':''}</div><div id="list"></div>`);
 draw();$('#q').oninput=draw;$('#fs').onchange=draw;
 if($('#nf'))$('#nf').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target));o.scholarship_id=+o.scholarship_id;
  const{error}=await db.from('scholars').insert(o);if(error)return toast(error.message);await log('register scholar',null,o.student_no);toast('Scholar registered');views.scholars()};
 if($('#pend'))$('#pend').onclick=async()=>{const ay=prompt('Academic year (e.g. 2025-2026)'),sem=prompt('Semester (1st or 2nd)');if(!ay||!sem)return;
  const{data:g}=await db.from('grade_submissions').select('scholar_id').eq('academic_year',ay).eq('semester',sem);const done=new Set((g||[]).map(x=>x.scholar_id));
  const ids=sc.filter(s=>!done.has(s.id)&&['Active','Renewed','Compliant'].includes(s.status)).map(s=>s.id);
  if(ids.length)await db.from('scholars').update({status:'Pending Submission'}).in('id',ids);toast(ids.length+' marked Pending Submission');views.scholars()};
 $('#list').onclick=async e=>{const r=e.target.dataset.r,d=e.target.dataset.d;
  if(r){const s=sc.find(x=>x.id==r);if(!['Compliant','For Renewal'].includes(s.status))return toast('BR-06: only Compliant scholars can be renewed');
   await db.from('scholars').update({status:'Renewed'}).eq('id',r);await log('renewal',+r,'Renewed');toast('Scholarship renewed');views.scholars()}
  if(d&&confirm('Disqualify this scholar?')){await db.from('scholars').update({status:'Disqualified'}).eq('id',d);await log('disqualify',+d,'');views.scholars()}}},
// ---- Configure Scholarship Requirements
async scholarships(){const{data}=await db.from('scholarships').select('*').order('name');
 V(`<h2>Scholarship requirements</h2><form class="f" id="nf"><input name="name" placeholder="Program name" required><input name="max_gwa" type="number" step="0.01" placeholder="Max GWA" required><input name="max_lowest_grade" type="number" step="0.01" placeholder="Lowest allowed grade" required><input name="min_units" type="number" placeholder="Min units" required><button>Save program</button></form>
 ${table(['Program','Max GWA','Lowest grade','Min units'],data.map(p=>`<tr><td>${esc(p.name)}</td><td>${p.max_gwa}</td><td>${p.max_lowest_grade}</td><td>${p.min_units}</td></tr>`))}<p>Philippine scale: 1.0 is best, 5.0 is failing.</p>`);
 $('#nf').onsubmit=async e=>{e.preventDefault();const{error}=await db.from('scholarships').insert(Object.fromEntries(new FormData(e.target)));if(error)return toast(error.message);toast('Saved');views.scholarships()}},
// ---- Submit / Verify / Evaluate
async grades(){const{data:sc}=await db.from('scholars').select('id,full_name,student_no,scholarships(*)');
 const{data:gs}=await db.from('grade_submissions').select('*,scholars(full_name,student_no)').order('submitted_at',{ascending:false});
 V(`<h2>Grade submissions</h2><form class="f" id="gf">${canManage()?`<select name="scholar_id" required><option value="">Scholar</option>${sc.map(s=>`<option value="${s.id}">${esc(s.full_name)}</option>`).join('')}</select>`:''}
 <input name="academic_year" placeholder="AY 2025-2026" required><select name="semester"><option>1st</option><option>2nd</option></select><input name="gwa" type="number" step="0.01" min="1" max="5" placeholder="GWA" required>
 <input name="lowest_grade" type="number" step="0.25" min="1" max="5" placeholder="Lowest grade" required><input name="units" type="number" min="1" placeholder="Units" required><input name="remarks" placeholder="Remarks"><button>Submit grades</button></form>
 ${table(['Scholar','Term','GWA','Lowest','Units','Status','Actions'],gs.map(g=>`<tr><td>${esc(g.scholars.full_name)}</td><td>${g.academic_year} ${g.semester}</td><td>${g.gwa}</td><td>${g.lowest_grade}</td><td>${g.units}</td><td><span class="tag">${g.status}${g.evaluated?' / evaluated':''}</span></td>
 <td>${canManage()&&g.status==='Pending'?`<button data-v="${g.id}">Verify</button> <button class="bad" data-x="${g.id}">Reject</button>`:''}${canManage()&&g.status==='Verified'&&!g.evaluated?`<button data-e="${g.id}">Evaluate compliance</button>`:''}</td></tr>`))}`);
 $('#gf').onsubmit=async e=>{e.preventDefault();const o=Object.fromEntries(new FormData(e.target));
  if(!canManage()){const{data:m}=await db.from('scholars').select('id').limit(1).maybeSingle();if(!m)return toast('No scholar record linked to your email. Ask staff.');o.scholar_id=m.id}
  o.scholar_id=+o.scholar_id;const{data,error}=await db.from('grade_submissions').insert(o).select().single();
  if(error)return toast(error.code==='23505'?'Already submitted for this term':error.message);
  await db.from('scholars').update({status:'For Verification'}).eq('id',o.scholar_id);await log('submit grades',data.id,'');toast('Submitted');views.grades()};
 $('#view').onclick=async e=>{const{v,x,e:ev}=e.target.dataset;
  if(v){const{error}=await db.from('grade_submissions').update({status:'Verified',verified_by:(await db.auth.getUser()).data.user.id,verified_at:new Date().toISOString()}).eq('id',v);toast(error?error.message:'Verified');views.grades()}
  if(x){await db.from('grade_submissions').update({status:'Rejected'}).eq('id',x);toast('Rejected');views.grades()}
  if(ev){const g=gs.find(y=>y.id==ev),s=sc.find(y=>y.id==g.scholar_id),r=s.scholarships;
   if(g.status!=='Verified')return toast('BR-05: only verified submissions');if(!r)return toast('Assign a scholarship first');
   const d=[];if(g.gwa>r.max_gwa)d.push(`GWA ${g.gwa} is above the allowed ${r.max_gwa}`);if(g.lowest_grade>r.max_lowest_grade)d.push(`Lowest grade ${g.lowest_grade} is below the allowed ${r.max_lowest_grade}`);if(g.units<r.min_units)d.push(`Units ${g.units} are below the required ${r.min_units}`);
   for(const t of d)await db.from('deficiencies').insert({scholar_id:g.scholar_id,submission_id:g.id,description:t});
   await db.from('grade_submissions').update({evaluated:true}).eq('id',g.id);
   const{count}=await db.from('deficiencies').select('*',{count:'exact',head:true}).eq('scholar_id',g.scholar_id).eq('resolved',false);
   const st=d.length===0?'Compliant':(count>d.length?'Probationary':'With Deficiency');
   await db.from('scholars').update({status:st}).eq('id',g.scholar_id);await log('evaluate',g.id,st);toast('Result: '+st);views.grades()}}},
// ---- Record / View Deficiency
async deficiencies(){const{data}=await db.from('deficiencies').select('*,scholars(full_name)').order('created_at',{ascending:false});
 V(`<h2>Deficiencies</h2>${table(['Scholar','Deficiency','Date','Status',''],data.map(d=>`<tr><td>${esc(d.scholars.full_name)}</td><td>${esc(d.description)}</td><td>${d.created_at.slice(0,10)}</td><td>${d.resolved?'Resolved':'Open'}</td><td>${canManage()&&!d.resolved?`<button data-s="${d.id}">Mark resolved</button>`:''}</td></tr>`))}`);
 $('#view').onclick=async e=>{if(e.target.dataset.s){await db.from('deficiencies').update({resolved:true}).eq('id',e.target.dataset.s);views.deficiencies()}}},
// ---- Compliance Report
async report(){const{data}=await db.from('scholars').select('student_no,full_name,status,scholarships(name)').order('status');
 V(`<h2>Compliance report</h2><div class="row"><button id="csv">Download CSV</button><button class="alt" onclick="print()">Print</button></div>${table(['Student no.','Name','Scholarship','Status'],data.map(s=>`<tr><td>${esc(s.student_no)}</td><td>${esc(s.full_name)}</td><td>${esc(s.scholarships?.name||'')}</td><td>${s.status}</td></tr>`))}`);
 $('#csv').onclick=()=>{const t='Student no,Name,Scholarship,Status\n'+data.map(s=>[s.student_no,s.full_name,s.scholarships?.name||'',s.status].map(x=>`"${x}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/csv'}));a.download='compliance-report.csv';a.click()}}};
boot();
