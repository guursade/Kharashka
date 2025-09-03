(function(){
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const monthPicker = $('#monthPicker');
  const budgetInput = $('#budgetInput');
  const type = $('#type');
  const category = $('#category');
  const date = $('#date');
  const amount = $('#amount');
  const note = $('#note');
  const btnAdd = $('#btnAdd');
  const btnClearMonth = $('#btnClearMonth');
  const txTableBody = $('#txTable tbody');
  const kpiIncome = $('#kpiIncome');
  const kpiExpense = $('#kpiExpense');
  const kpiBalance = $('#kpiBalance');
  const kpiBudget = $('#kpiBudget');
  const chartCanvas = $('#chart');
  const legend = $('#legend');
  const catsDiv = $('#cats');
  const newCat = $('#newCat');
  const btnAddCat = $('#btnAddCat');
  const btnExport = $('#btnExport');
  const btnImport = $('#btnImport');
  const importFile = $('#importFile');

  const DEFAULT_CATS = ['Kirada Guriga','Korontada & Biyaha','Cuntada & Raashinka','Gaadiidka','Isgaarsiinta','Waxbarasho','Caafimaad','Madadaalo','Kharashka Kale'];

  function readStore(){ try{return JSON.parse(localStorage.getItem('kharash_v2')||'{}')}catch(e){return{}} }
  function writeStore(s){ localStorage.setItem('kharash_v2', JSON.stringify(s)); }
  function ensure(){ const s = readStore(); s.categories = s.categories || DEFAULT_CATS; s.budgets = s.budgets || {}; s.txs = s.txs || []; writeStore(s); return s; }

  function monthKey(d=new Date()){ return d.toISOString().slice(0,7); }
  function today(){ return new Date().toISOString().slice(0,10); }
  function format(n){ return new Intl.NumberFormat().format(Math.round((Number(n)||0)*100)/100); }

  function setMonth(mk){ monthPicker.value = mk; const s = ensure(); budgetInput.value = s.budgets[mk] || ''; render(); }

  function render(){
    const s = ensure();
    const mk = monthPicker.value || monthKey();
    const [start,end] = getMonthRange(mk);
    const txs = s.txs.filter(t=>{ const d=new Date(t.date); return d>=start && d<=end; });
    const income = txs.filter(t=>t.type==='income').reduce((a,b)=>a+Number(b.amount||0),0);
    const expense = txs.filter(t=>t.type==='expense').reduce((a,b)=>a+Number(b.amount||0),0);
    kpiIncome.textContent = format(income); kpiExpense.textContent = format(expense); kpiBalance.textContent = format(income-expense);
    kpiBudget.textContent = s.budgets[mk] ? format(s.budgets[mk]) : '—';

    // table
    txTableBody.innerHTML='';
    txs.sort((a,b)=> new Date(b.date)-new Date(a.date)).forEach(t=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${t.date}</td><td>${t.type==='income'?'Dakhli':'Kharash'}</td><td>${t.cat}</td><td>${format(t.amount)}</td><td>${t.note||''}</td><td><button class="small button-ghost" data-del="${t.id}">Delete</button></td>`;
      txTableBody.appendChild(tr);
    });

    // categories UI
    category.innerHTML=''; s.categories.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; category.appendChild(o); });

    // cats list
    catsDiv.innerHTML=''; s.categories.forEach(c=>{ const d=document.createElement('div'); d.className='item small'; d.style.marginBottom='6px'; d.innerHTML=`<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colorFor(c)};margin-right:8px"></span>${c}`; catsDiv.appendChild(d); });

    // chart by category (expenses only)
    const byCat = {}; txs.filter(t=>t.type==='expense').forEach(t=> byCat[t.cat]=(byCat[t.cat]||0)+Number(t.amount||0));
    drawChart(byCat);
  }

  function getMonthRange(mk){ const [y,m]=mk.split('-').map(Number); const start=new Date(y,m-1,1); const end=new Date(y,m,0); return [start,end]; }

  function colorFor(key){ const hues=[210,260,20,120,0,30,280,160,190,340]; let i= Math.abs(Array.from(key).reduce((a,c)=>a+c.charCodeAt(0),0)) % hues.length; return `hsl(${hues[i]} 75% 50%)`; }

  function addTx(){
    const s=ensure(); const mk=monthPicker.value || monthKey();
    if(budgetInput.value) s.budgets[mk]=Number(budgetInput.value);
    const t={ id: crypto.randomUUID(), type: type.value, cat: category.value, date: date.value||today(), amount: Number(amount.value||0), note: note.value||'' };
    if(!t.amount){ alert('Gali lacag saxan.'); return; }
    s.txs.push(t); writeStore(s); amount.value=''; note.value=''; render();
  }

  function delTx(id){ if(!confirm('Ma hubtaa in la tirtiro?')) return; const s=ensure(); s.txs=s.txs.filter(t=>t.id!==id); writeStore(s); render(); }

  txTableBody.addEventListener('click', e=>{ const id=e.target.getAttribute('data-del'); if(id) delTx(id); });
  btnAdd.addEventListener('click', addTx);
  btnClearMonth.addEventListener('click', ()=>{ if(!confirm('Tirtir dhammaan diiwaanada bilkan?')) return; const s=ensure(); const mk=monthPicker.value||monthKey(); const [start,end]=getMonthRange(mk); s.txs=s.txs.filter(t=>{ const d=new Date(t.date); return !(d>=start && d<=end); }); writeStore(s); render(); });

  btnAddCat.addEventListener('click', ()=>{ const s=ensure(); const c=newCat.value.trim(); if(!c) return; if(s.categories.includes(c)){ alert('Qaybtan horey ayay u jirtaa'); return; } s.categories.push(c); writeStore(s); newCat.value=''; render(); });

  function drawChart(byCat){
    const ctx = chartCanvas.getContext('2d');
    const entries = Object.entries(byCat).filter(([k,v])=>v>0);
    // clear
    ctx.clearRect(0,0,chartCanvas.width,chartCanvas.height);
    // draw donut
    const total = entries.reduce((a,[_,v])=>a+v,0);
    const w = chartCanvas.width, h = chartCanvas.height;
    const cx = w/2, cy = h/2, r = Math.min(w,h)/2 - 24;
    let start = -Math.PI/2;
    legend.innerHTML='';
    entries.forEach(([k,v],i)=>{
      const ang = total? (v/total)*Math.PI*2 : 0;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,start+ang); ctx.closePath();
      ctx.fillStyle = colorFor(k); ctx.fill();
      start += ang;
      const el = document.createElement('div'); el.className='item'; el.innerHTML = `<div style="width:10px;height:10px;background:${colorFor(k)};border-radius:3px;margin-right:6px"></div>${k} — ${format(v)}`; legend.appendChild(el);
    });
    // inner hole
    ctx.globalCompositeOperation='destination-out'; ctx.beginPath(); ctx.arc(cx,cy,r*0.55,0,Math.PI*2); ctx.fill(); ctx.globalCompositeOperation='source-over';
    // center text
    ctx.fillStyle='#0f172a'; ctx.font='16px Arial'; ctx.textAlign='center'; ctx.fillText('Kharashyo', cx, cy+6);
  }

  // Export / Import
  btnExport.addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(ensure(), null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='kharash_backup.json'; a.click(); URL.revokeObjectURL(a.href);
  });
  btnImport.addEventListener('click', ()=> importFile.click());
  importFile.addEventListener('change', e=>{ if(e.target.files && e.target.files[0]){ const r=new FileReader(); r.onload = ev=>{ try{ const obj=JSON.parse(ev.target.result); writeStore(obj); render(); alert('Xogta la geliyey.'); }catch(err){ alert('File-ka ma saxna'); } }; r.readAsText(e.target.files[0]); } });

  // init
  ensure();
  monthPicker.value = monthKey();
  date.value = today();
  render();
})();
