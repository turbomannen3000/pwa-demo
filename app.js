const $ = (sel) => document.querySelector(sel);
const todayKey = () => new Date(new Date().toDateString()).getTime();
const LS_CARDS = 'ug_cards_v1';
const LS_SETTINGS = 'ug_settings_v1';
const defaultSettings = { newPerDay: 10, maxReps: 200, reverse: false };
let settings = loadSettings();
let cards = loadCards();
function loadSettings(){ try{ return { ...defaultSettings, ...JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}') }; }catch{ return { ...defaultSettings }; } }
function saveSettings(){ localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); }
function loadCards(){ try{ return JSON.parse(localStorage.getItem(LS_CARDS) || '[]'); }catch{ return []; } }
function saveCards(){ localStorage.setItem(LS_CARDS, JSON.stringify(cards)); }
const panelList = $('#panelList'), panelAdd=$('#panelAdd'), panelStudy=$('#panelStudy'), panelSettings=$('#panelSettings');
function show(p){ [panelList,panelAdd,panelStudy,panelSettings].forEach(x=>x.classList.add('hidden')); p.classList.remove('hidden'); }
const tbody = $('#tbl tbody'), search = $('#search');
function fmtDate(ts){ if (!ts) return 'ny'; const d = new Date(ts); return d.toLocaleDateString('sv-SE', { year:'numeric', month:'short', day:'numeric' }); }
function renderList(){
  const q = (search.value || '').toLowerCase();
  const dueCount = cards.filter(c => (c.srs?.due || 0) <= todayKey()).length;
  $('#statTotal').textContent = cards.length; $('#statDue').textContent = dueCount;
  tbody.innerHTML='';
  cards.filter(c => c.hu.toLowerCase().includes(q) || c.sv.toLowerCase().includes(q)).forEach(c => {
    const tr=document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(c.hu)}</td><td>${escapeHtml(c.sv)}</td><td class="hide-mobile">${fmtDate(c.srs?.due)}</td><td><button data-ed="${c.id}" class="secondary">✏️</button><button data-del="${c.id}" class="danger">🗑</button></td>`;
    tbody.appendChild(tr);
  });
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
tbody.addEventListener('click', (e)=>{
  const id = e.target.dataset.del || e.target.closest('[data-del]')?.dataset.del;
  const eid = e.target.dataset.ed || e.target.closest('[data-ed]')?.dataset.ed;
  if(id){ cards = cards.filter(c => c.id !== id); saveCards(); renderList(); }
  else if(eid){ const c = cards.find(x => x.id===eid); if(!c) return; $('#inHu').value=c.hu; $('#inSv').value=c.sv; $('#inNote').value=c.note||''; $('#saveWord').dataset.editing=eid; show(panelAdd); }
});
search.addEventListener('input', renderList);
$('#btnAdd').addEventListener('click', ()=>{ $('#inHu').value=''; $('#inSv').value=''; $('#inNote').value=''; delete $('#saveWord').dataset.editing; show(panelAdd); });
$('#cancelAdd').addEventListener('click', ()=> show(panelList));
$('#saveWord').addEventListener('click', ()=>{
  const hu=($('#inHu').value||'').trim(), sv=($('#inSv').value||'').trim(), note=($('#inNote').value||'').trim();
  if(!hu||!sv){ alert('Fyll i både ungerska och svenska.'); return; }
  const editing=$('#saveWord').dataset.editing;
  if(editing){ const c=cards.find(x=>x.id===editing); c.hu=hu; c.sv=sv; c.note=note; }
  else { cards.push(newCard(hu,sv,note)); }
  saveCards(); renderList(); show(panelList);
});
function newCard(hu,sv,note=''){ const id='c_'+Math.random().toString(36).slice(2); return { id, hu, sv, note, createdAt: Date.now(), srs:{ ease:2.5, interval:0, reps:0, due:0, lapses:0 } }; }
$('#fileImport').addEventListener('change', async (e)=>{
  const file=e.target.files?.[0]; if(!file) return; const text=await file.text(); const rows=parseCSV(text); let added=0;
  for(const r of rows){ const hu=(r.hu||r[0]||'').trim(); const sv=(r.sv||r[1]||'').trim(); const note=(r.note||r[2]||'').trim(); if(hu&&sv){ cards.push(newCard(hu,sv,note)); added++; } }
  saveCards(); renderList(); alert('Importerade '+added+' glosor.'); e.target.value='';
});
function parseCSV(text){ const lines=text.split(/\r?\n/).filter(Boolean); const out=[]; const first=lines[0].split(/[;,]/).map(s=>s.trim().toLowerCase()); let start=0; if(first.includes('hu')||first.includes('sv')||first.includes('ungerska')||first.includes('svenska')) start=1; for(let i=start;i<lines.length;i++){ const parts=lines[i].split(/[;,]/).map(s=>s.trim()); out.push({0:parts[0]||'',1:parts[1]||'',2:parts[2]||'',hu:parts[0]||'',sv:parts[1]||'',note:parts[2]||''}); } return out; }
$('#btnExport').addEventListener('click', ()=>{
  const rows=[['hu','sv','note']].concat(cards.map(c=>[c.hu,c.sv,c.note||'']));
  const csv=rows.map(r=>r.map(v=>/[",;\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v).join(';')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ungerska-glosor.csv'; a.click(); URL.revokeObjectURL(a.href);
});
$('#btnSettings').addEventListener('click', ()=>{ $('#setNewPerDay').value=settings.newPerDay; $('#setMaxReps').value=settings.maxReps; $('#setReverse').checked=settings.reverse; show(panelSettings); });
$('#saveSettings').addEventListener('click', ()=>{ settings.newPerDay=clamp(parseInt($('#setNewPerDay').value)||0,0,500); settings.maxReps=clamp(parseInt($('#setMaxReps').value)||0,0,2000); settings.reverse=!!$('#setReverse').checked; localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); show(panelList); });
$('#closeSettings').addEventListener('click', ()=> show(panelList) );
function clamp(v,a,b){ return Math.min(b, Math.max(a,v)); }
let queue=[], current=null;
$('#btnStudy').addEventListener('click', startStudy);
$('#btnExitStudy').addEventListener('click', ()=>{ show(panelList); renderList(); });
$('#btnReveal').addEventListener('click', ()=>{ $('#back').classList.remove('hidden'); $('#ratings').classList.remove('hidden'); });
$('#btnSpeak').addEventListener('click', ()=>{ const text=current?(current.dir==='hu->sv'?current.card.hu:current.card.sv):''; speak(text, current&&current.dir==='hu->sv'?'hu-HU':'sv-SE'); });
$('#ratings').addEventListener('click', (e)=>{ const q=e.target.dataset.q; if(q===undefined) return; applyGrade(current.card, parseInt(q,10)); nextCard(); });
function startStudy(){ buildQueue(); if(queue.length===0){ alert('Inget att repetera idag. Lägg till fler glosor!'); return; } show(panelStudy); nextCard(); }
function buildQueue(){
  const due = cards.filter(c => (c.srs?.due || 0) <= todayKey());
  const newOnes = cards.filter(c => (c.srs?.reps||0) === 0).slice(0, settings.newPerDay);
  let list=[...due,...newOnes];
  queue = list.flatMap(c => { const base=[{card:c,dir:'hu->sv'}]; if(settings.reverse) base.push({card:c,dir:'sv->hu'}); return base; });
  for(let i=queue.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [queue[i],queue[j]]=[queue[j],queue[i]]; }
  $('#leftCount').textContent=queue.length;
}
function nextCard(){
  current=queue.shift(); $('#leftCount').textContent=queue.length;
  if(!current){ show(panelList); renderList(); return; }
  $('#back').classList.add('hidden'); $('#ratings').classList.add('hidden');
  if(current.dir==='hu->sv'){ $('#front').textContent=current.card.hu; $('#back').textContent=current.card.sv + (current.card.note? '\\n'+current.card.note : ''); }
  else { $('#front').textContent=current.card.sv; $('#back').textContent=current.card.hu + (current.card.note? '\\n'+current.card.note : ''); }
}
function applyGrade(card, grade){
  const s = card.srs || (card.srs={ease:2.5, interval:0, reps:0, due:0, lapses:0});
  const day = 24*60*60*1000, today=todayKey();
  if(grade<=0){ s.reps=0; s.interval=1; s.ease=Math.max(1.3, s.ease-0.2); s.lapses=(s.lapses||0)+1; s.due=today + day*s.interval; }
  else if(grade===1){ s.interval=Math.max(1, Math.round((s.interval||1)*1.2)); s.ease=Math.max(1.3, s.ease-0.15); s.due=today + day*s.interval; }
  else if(grade===2){ if(s.reps===0) s.interval=1; else if(s.reps===1) s.interval=6; else s.interval=Math.round(s.interval*s.ease); s.reps+=1; s.due=today + day*s.interval; }
  else { if(s.reps===0) s.interval=3; else if(s.reps===1) s.interval=8; else s.interval=Math.round(s.interval*(s.ease+0.15)); s.reps+=1; s.ease=Math.min(3.5, s.ease+0.05); s.due=today + day*s.interval; }
  saveCards();
}
function speak(text, lang='hu-HU'){ if(!('speechSynthesis' in window)) return alert('Talsyntes stöds inte här.'); const u=new SpeechSynthesisUtterance(text); u.lang=lang; u.rate=1.0; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); }
if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').then(reg=>{ const bar=$('#updatebar'), btn=$('#reload'); function showUpdate(){ bar.hidden=false; btn.onclick=()=>reg.waiting?.postMessage({type:'SKIP_WAITING'}); } if(reg.waiting) showUpdate(); reg.addEventListener('updatefound', ()=>{ const nw=reg.installing; nw?.addEventListener('statechange', ()=>{ if(nw.state==='installed' && navigator.serviceWorker.controller) showUpdate(); }); }); navigator.serviceWorker.addEventListener('controllerchange', ()=>location.reload()); }); }
seedIfEmpty(); renderList(); show(panelList);
function seedIfEmpty(){ if(cards.length) return; const sample=[['köszönöm','tack','Köszönöm szépen!'],['igen','ja',''],['nem','nej',''],['szia','hej','vardagligt'],['jó napot','god dag',''],['viszlát','hejdå',''],['kérek','jag vill ha',''],['hol?','var?',''],['mikor?','när?',''],['mennyi?','hur mycket?',''],['víz','vatten',''],['kenyér','bröd',''],['kávé','kaffe',''],['sör','öl',''],['bor','vin',''],['vasútállomás','tågstation',''],['kórház','sjukhus',''],['bolt','affär','butik'],['nyitva','öppet',''],['zárva','stängt','']]; for(const [hu,sv,note] of sample){ cards.push(newCard(hu,sv,note)); } saveCards(); }
