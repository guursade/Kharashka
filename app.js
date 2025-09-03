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
  const kpiVsBudget = $('#kpiVsBudget');

  const btnExport = $('#btnExport');
  const btnImport = $('#btnImport');
  const importFile = $('#importFile');

  const pieCanvas = $('#pie');
  const legendDiv = $('#legend');
  const ctx = pieCanvas.getContext('2d');

  const DEFAULT_CATS = [
    'Kirada Guriga','Korontada & Biyaha','Cuntada & Raashinka',
    'Gaadiidka','Isgaarsiinta','Waxbarasho/Caruur','Caafimaad & Daawo',
    'Madadaalo','Kharashka Kale'
  ];

  function todayISO(){
    const d = new Date();
    return d.toISOString().slice(0,10);
  }
  function monthKey(d = new Date()){
    return d.toISOString().slice(0,7); // YYYY-MM
  }
  function readStore(){
    try{ return JSON.parse(localStorage.getItem('kharash_store') || '{}'); }
    catch(e){ return {}; }
  }
  function writeStore(data){
    localStorage.setItem('kharash_store', JSON.stringify(data));
  }

  function ensureInit(){
    const store = readStore();
    store.categories = store.categories || DEFAULT_CATS;
    store.budgets = store.budgets || {}; // { 'YYYY-MM': number }
    store.txs = store.txs || [];         // [{id, type, cat, date, amount, note}]
    writeStore(store);
    return store;
  }

  function setMonthUI(mk){
    monthPicker.value = mk;
    const store = ensureInit();
    budgetInput.value = store.budgets[mk] || '';
    date.value = todayISO();
    // categories
    category.innerHTML = '';
    ensureInit().categories.forEach(c=>{
      const o = document.createElement('option');
      o.value=c;o.textContent=c;
      category.appendChild(o);
    });
    render();
  }

  function getMonthRange(mk){
    const [y,m] = mk.split('-').map(Number);
    const start = new Date(y, m-1, 1);
    const end = new Date(y, m, 0);
    return [start, end];
  }

  function render(){
    const store = ensureInit();
    const mk = monthPicker.value || monthKey();
    const [start, end] = getMonthRange(mk);
    const txs = store.txs.filter(t=>{
      const d = new Date(t.date);
      return d >= start && d <= end;
    });

    // KPIs
    const income = txs.filter(t=>t.type==='income').reduce((a,b)=>a+Number(b.amount||0),0);
    const expense = txs.filter(t=>t.type==='expense').reduce((a,b)=>a+Number(b.amount||0),0);
    const balance = income - expense;
    kpiIncome.textContent = formatNum(income);
    kpiExpense.textContent = formatNum(expense);
    kpiBalance.textContent = formatNum(balance);
    const budget = Number(ensureInit().budgets[mk]||0);
    kpiVsBudget.textContent = budget ? (formatNum(budget - expense) + ' kaaga haray') : '—';

    // Table
    txTableBody.innerHTML='';
    txs.sort((a,b)=> new Date(b.date)-new Date(a.date)).forEach(t=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${t.date}</td>
        <td><span class="badge">${t.type==='income'?'Dakhli':'Kharash'}</span></td>
        <td>${t.cat}</td>
        <td>${formatNum(t.amount)}</td>
        <td>${t.note||''}</td>
        <td><button class="secondary" data-del="${t.id}">Delete</button></td>
      `;
      txTableBody.appendChild(tr);
    });

    // Pie by category (only expenses)
    const byCat = {};
    txs.filter(t=>t.type==='expense').forEach(t=>{
      byCat[t.cat] = (byCat[t.cat]||0) + Number(t.amount||0);
    });
    drawPie(byCat);
  }

  function drawPie(byCat){
    const entries = Object.entries(byCat).filter(([_,v])=>v>0);
    const total = entries.reduce((a,[_,v])=>a+v,0);

    // clear
    ctx.clearRect(0,0,pieCanvas.width,pieCanvas.height);
    // Resize canvas to device pixel ratio for sharper look
    const dpr = window.devicePixelRatio || 1;
    const w = pieCanvas.clientWidth, h = 280;
    pieCanvas.width = w * dpr;
    pieCanvas.height = h * dpr;
    ctx.scale(dpr,dpr);

    const cx = w/2, cy = h/2, r = Math.min(w,h)/2 - 16;
    let start = -Math.PI/2;
    legendDiv.innerHTML='';

    function color(i){
      // simple deterministic palette
      const hues = [210, 260, 20, 120, 0, 30, 280, 160, 190, 340];
      const hue = hues[i % hues.length];
      return `hsl(${hue} 70% 50%)`;
    }

    entries.forEach(([k,v],i)=>{
      const ang = total ? (v/total)*Math.PI*2 : 0;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,r,start,start+ang);
      ctx.closePath();
      ctx.fillStyle = color(i);
      ctx.fill();
      start += ang;

      const row = document.createElement('div');
      row.innerHTML = `<span class="badge" style="background:transparent;border:1px solid #e5e7eb">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color(i)};margin-right:6px"></span>
        ${k} — ${formatNum(v)}
      </span>`;
      legendDiv.appendChild(row);
    });

    // Inner hole for donut
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, r*0.55, 0, Math.PI*2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function formatNum(n){
    return new Intl.NumberFormat().format(Math.round((Number(n)||0)*100)/100);
  }

  function addTx(){
    const store = ensureInit();
    const mk = monthPicker.value || monthKey();
    if(budgetInput.value){
      store.budgets[mk] = Number(budgetInput.value);
    }
    const t = {
      id: crypto.randomUUID(),
      type: type.value,
      cat: category.value,
      date: date.value || todayISO(),
      amount: Number(amount.value||0),
      note: note.value||''
    };
    if(!t.amount){ alert('Gali lacag saxan.'); return; }
    store.txs.push(t);
    writeStore(store);
    amount.value=''; note.value='';
    render();
  }

  function delTx(id){
    const store = ensureInit();
    store.txs = store.txs.filter(t=>t.id!==id);
    writeStore(store);
    render();
  }

  // Export / Import
  function doExport(){
    const data = readStore();
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kharash_backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  function doImport(file){
    const reader = new FileReader();
    reader.onload = e => {
      try{
        const obj = JSON.parse(e.target.result);
        writeStore(obj);
        ensureInit();
        render();
        alert('Xogta waa la soo celiyay.');
      }catch(err){
        alert('File-ka sax ma aha.');
      }
    };
    reader.readAsText(file);
  }

  // EVENTS
  btnAdd.addEventListener('click', addTx);
  txTableBody.addEventListener('click', (e)=>{
    const id = e.target.getAttribute('data-del');
    if(id){ if(confirm('Ma hubtaa inaad tirtirayso?')) delTx(id); }
  });
  btnClearMonth.addEventListener('click', ()=>{
    if(!confirm('Ma hubtaa inaad tirtirayso diiwaangelinta bilkan?')) return;
    const store = ensureInit();
    const mk = monthPicker.value || monthKey();
    const [start,end] = getMonthRange(mk);
    store.txs = store.txs.filter(t=>{
      const d = new Date(t.date);
      return !(d >= start && d <= end);
    });
    writeStore(store);
    render();
  });

  btnExport.addEventListener('click', doExport);
  btnImport.addEventListener('click', ()=> importFile.click());
  importFile.addEventListener('change', (e)=>{
    if(e.target.files && e.target.files[0]) doImport(e.target.files[0]);
  });

  budgetInput.addEventListener('change', ()=>{
    const store = ensureInit();
    const mk = monthPicker.value || monthKey();
    store.budgets[mk] = Number(budgetInput.value||0);
    writeStore(store);
    render();
  });
  monthPicker.addEventListener('change', ()=> setMonthUI(monthPicker.value));

  // Init
  ensureInit();
  setMonthUI(monthKey());
})();