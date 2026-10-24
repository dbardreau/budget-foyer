/* ============================================================
   Budget Foyer 2026 — application PHP / MySQL
   Données de base : window.BUDGET2026 (data.js)
   Ajouts personnels : base MySQL `budget` (via api.php)
   ============================================================ */

/* ---------- Utilitaires ---------- */
const MONTHS = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

let BASE = Array.isArray(window.BUDGET2026) ? window.BUDGET2026 : [];
/* Données de base par année : baseData = { "2026": [12 mois], "2027": [...] , … } */
let baseData = {};

/* Construit les 12 mois d'une année. Sans données importées, on crée des
   mois vides pour pouvoir quand même saisir des opérations (ex. 2027). */
function emptyMonth(mk){ return { mois:mk, revenuTotalFoyer:'0', sommeRestante:'0', depenseTotalCommune:'0', depenses:[], revenus:[] }; }
function yearMonths(year){
  const arr = baseData[String(year)];
  if(Array.isArray(arr) && arr.length===12) return arr;
  return MONTHS.map(emptyMonth);
}
function baseYears(){ return Object.keys(baseData).map(Number); }
function minBaseYear(){ const a=baseYears(); return a.length ? Math.min.apply(null,a) : state.year; }
function maxBaseYear(){ const a=baseYears(); return a.length ? Math.max.apply(null,a) : state.year; }

const CATS = [
  {key:'abonnement et téléphonie', label:'Abonnement & téléphonie', color:'#4f9cf9'},
  {key:'voyage et transport',      label:'Voyage & transport',     color:'#a78bfa'},
  {key:'auto moto',                label:'Auto / Moto',            color:'#f472b6'},
  {key:'cadeaux et solidarité',    label:'Cadeaux & solidarité',   color:'#f59e0b'},
  {key:'Opération banquaire',      label:'Opérations bancaires',   color:'#22c55e'},
  {key:'education et famille',     label:'Éducation & famille',    color:'#34d399'},
  {key:'autre',                    label:'Autres',                 color:'#94a3b8'},
  {key:'impots et taxe',           label:'Impôts & taxes',         color:'#ef4444'},
  {key:'logement',                 label:'Logement',               color:'#38bdf8'},
  {key:'loisir',                   label:'Loisirs',                color:'#fb7185'},
  {key:'mouvement interne débiteur',label:'Mouvements internes',   color:'#2dd4bf'},
  {key:'santé',                    label:'Santé',                  color:'#e879f9'},
  {key:'vie quotidienne',          label:'Vie quotidienne',        color:'#facc15'},
];

const REVENUE_SOURCES = ['Salaire David','Salaire Sophie','Aides sociales (CAF)','Autre revenu'];

/* Catégories / sources personnalisées (enregistrées en base MySQL) */
let customCats = [];
let customSrc  = [];
function saveCats(){ saveKey('custom_cats', customCats); }
function saveSrc(){ saveKey('custom_src', customSrc); }

/* Sous-catégories par catégorie (base MySQL) */
let subcats = {};
function saveSubcats(){ saveKey('subcats', subcats); }
function subsOf(id){ return subcats[id] = subcats[id] || []; }
function addSub(id,name){ const a=subsOf(id); const n=String(name||'').trim(); if(!n) return null; if(a.some(x=>norm(x)===norm(n))) return false; a.push(n); saveSubcats(); return true; }
function removeSub(id,i){ subsOf(id).splice(i,1); if(subcats[id].length===0) delete subcats[id]; saveSubcats(); }

function norm(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
function catMeta(key){
  const k = norm(key);
  const found = CATS.find(c => norm(c.key)===k);
  if(found) return found;
  // couleur déterministe stable pour les catégories personnalisées
  const colors = ['#22c55e','#4f9cf9','#f59e0b','#a78bfa','#f472b6','#2dd4bf','#38bdf8','#facc15','#34d399','#fb7185','#e879f9'];
  let h = 0; for(const ch of k) h = (h*31 + ch.charCodeAt(0))>>>0;
  return {key, label:key, color: colors[h % colors.length]};
}
function parseAmount(s){
  if(s===null||s===undefined) return 0;
  s = String(s).replace(/[\u00A0\s\u20AC€]/g,'').trim();
  if(!s) return 0;
  if(s.includes(',')) s = s.replace(/\./g,'').replace(',','.');
  const n = parseFloat(s);
  return isNaN(n)?0:n;
}
function fmt(n, dec=2){
  const neg = n<0;
  const v = Math.abs(n).toLocaleString('fr-FR',{minimumFractionDigits:dec,maximumFractionDigits:dec});
  return (neg?'-':'') + v;
}
function cmoney(n){ return fmt(n) + ' €'; }
function cls(n){ return n<0 ? 'neg' : 'pos'; }

/* ---------- État ---------- */
const state = { tab:'overview', month:0, year:2026 };
let editingKey = null; // {mk, id} quand on modifie une opération existante

/* ============================================================
   STOCKAGE EN BASE DE DONNÉES MYSQL (serveur WAMP)
   Le site doit être ouvert via http://localhost/... (et non en
   double-cliquant sur le fichier index.html) pour accéder au
   serveur api.php.
   Toutes tes données (ajouts manuels, catégories, sources,
   sous-catégories) sont enregistrées dans la base MySQL `budget`.
   ============================================================ */
let userOps = {};
let online = false;

async function apiFetch(body){
  const opts = body
    ? { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }
    : {};
  const res = await fetch('api.php', opts);
  if(!res.ok) throw new Error('Erreur serveur (' + res.status + ')');
  return await res.json();
}

/* Charge toutes les données depuis la base au démarrage */
async function initStorage(){
  try{
    const d = await apiFetch();
    customCats = (d && Array.isArray(d.custom_cats)) ? d.custom_cats : [];
    customSrc  = (d && Array.isArray(d.custom_src))  ? d.custom_src  : [];
    subcats    = (d && d.subcats && typeof d.subcats==='object' && !Array.isArray(d.subcats)) ? d.subcats : {};

    /* --- Opérations par année : ops = { "2026": { "janvier": [..], .. }, … } --- */
    let rawOps = (d && d.ops && typeof d.ops==='object') ? d.ops : {};
    let newOps = {};
    let opsIsYearFormat = false;
    for(const k in rawOps){ if(!MONTHS.includes(k)){ opsIsYearFormat = true; break; } }
    if(opsIsYearFormat){ newOps = rawOps; }
    else {
      // ancien format : opérations directes par mois → on les rattache à 2026
      const flat = {};
      for(const mk of MONTHS){ if(rawOps[mk] && rawOps[mk].length) flat[mk] = rawOps[mk]; }
      if(Object.keys(flat).length) newOps['2026'] = flat;
    }
    userOps = newOps;

    /* --- Données de base par année : base = { "2026": [12 mois], … } --- */
    let rawBase = (d && d.base) ? d.base : [];
    let newBase = {};
    if(Array.isArray(rawBase)){
      // ancien format (tableau des 12 mois 2026)
      if(rawBase.length) newBase['2026'] = rawBase;
    } else if(rawBase && typeof rawBase==='object'){
      for(const y in rawBase){ if(Array.isArray(rawBase[y])) newBase[y] = rawBase[y]; }
    }
    // complète avec le germe data.js si l'année 2026 n'est pas encore en base
    if(!newBase['2026'] && Array.isArray(window.BUDGET2026) && window.BUDGET2026.length){
      newBase['2026'] = window.BUDGET2026;
    }
    baseData = newBase;

    // Re-sauvegarde au format normalisé (met à jour l'ancien format si besoin)
    apiFetch({action:'save', k:'base', v:baseData});
    apiFetch({action:'save', k:'ops', v:userOps});

    // Année par défaut : la plus récente présente
    const years = baseYears();
    if(years.length && !years.includes(state.year)) state.year = Math.max.apply(null, years);
    BASE = yearMonths(state.year);
    online = true;
  }catch(e){ online = false; }
  updateSyncBadge();
}

/* Opérations d'une année (objet mois -> liste) avec création implicite */
function oy(year){ return userOps[String(year)] || (userOps[String(year)] = {}); }
/* Opérations d'un mois de l'année courante */
function opsOf(mk){ return oy(state.year)[mk] || []; }

/* Active une année : met à jour les données et l'affichage */
function applyYear(){
  BASE = yearMonths(state.year);
  setYearMeta();
  switchTab(state.tab);
}

/* Change d'année (‹ ›) : crée l'année si elle n'existe pas encore,
   puis bascule l'affichage dessus. */
function changeYear(delta){
  const y = state.year + delta;
  if(y < 2000 || y > 2100) return;             // garde-fou
  if(!baseData[y]){
    baseData[y] = MONTHS.map(emptyMonth);      // invite vide à remplir
    apiFetch({action:'save', k:'base', v:baseData}).catch(()=>{});
  }
  state.year = y;
  applyYear();
}
function setYearMeta(){
  const y = String(state.year);
  const el = document.getElementById('yearLabel'); if(el) el.textContent = y;
  const hd = document.getElementById('hdYear');  if(hd) hd.textContent = y;
  const dt = document.getElementById('donutYear'); if(dt) dt.textContent = y;
  document.title = 'Budget Foyer ' + y;
}

/* Enregistre une clef en base (envoi asynchrone) */
function saveKey(k, v){
  apiFetch({action:'save', k, v}).then(()=>{ online = true; updateSyncBadge(); })
    .catch(()=>{ online = false; updateSyncBadge(); });
}

function saveOps(){ saveKey('ops', userOps); }

function updateSyncBadge(){
  const el = document.getElementById('syncBadge');
  if(!el) return;
  el.textContent = online ? '● Base de données MySQL — synchronisé' : '● Base MySQL — serveur injoignable';
  el.classList.toggle('online', online);
}

function monthByKey(k){ return BASE.find(m => m.mois===k) || null; }
function addAmounts(a,b){ return Math.round((a+b)*100)/100; }

/* Revenus de base cumulés d'un mois (somme des lignes) */
function baseRevTotal(month){
  return (month.revenus||[]).reduce((s,r)=>s+parseAmount(r.montant),0);
}
function baseDepTotal(month){
  return parseAmount(month.depenseTotalCommune);
}
function baseSomme(month){
  return parseAmount(month.sommeRestante);
}

/* Totaux avec ajouts utilisateur pour un mois */
function monthWithOps(mk){
  const month = monthByKey(mk);
  const ops = opsOf(mk);
  const depOps = ops.filter(o=>o.type==='depense');
  const revOps = ops.filter(o=>o.type==='revenu');
  const depAdd = depOps.reduce((s,o)=>s+o.amount,0);
  const revAdd = revOps.reduce((s,o)=>s+o.amount,0);
  return {
    month,
    depOps, revOps,
    revTotal: addAmounts(baseRevTotal(month), revAdd),
    depTotal: addAmounts(baseDepTotal(month), depAdd),
    somme: addAmounts(baseSomme(month), revAdd - depAdd),
    depAdd, revAdd,
  };
}

/* Cartographie catégorie -> total (base + ajouts) pour un mois */
function catTotalsMk(mk){
  const {month, depOps} = monthWithOps(mk);
  const map = {};
  (month.depenses||[]).forEach(c=>{ map[norm(c.categorie)] = {total:parseAmount(c.total), label:c.categorie, items:c.items||[]}; });
  depOps.forEach(o=>{
    const k = norm(o.cat);
    if(!map[k]) map[k] = {total:0,label:o.cat,items:[]};
    map[k].total = addAmounts(map[k].total, o.amount);
    if(!map[k].userOps) map[k].userOps=[];
    map[k].userOps.push({label:o.label, amount:o.amount});
  });
  return map;
}

/* ---------- Rendu global ---------- */
function switchTab(tab){
  state.tab = tab;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active', p.id==='tab-'+tab));
  if(tab==='overview') renderOverview();
  if(tab==='months') renderMonth();
  if(tab==='budget') renderBudget();
  if(tab==='charts') renderCharts();
  if(tab==='categories') renderCatManager();
}

/* ============ ACCUEIL ============ */
function yearlyTotals(){
  const tot = {rev:0,dep:0};
  BASE.forEach(m=>{ tot.rev+=baseRevTotal(m); tot.dep+=baseDepTotal(m); });
  // ajouts
  MONTHS.forEach(mk => { const w = monthWithOps(mk); tot.rev=addAmounts(tot.rev,w.revAdd); tot.dep=addAmounts(tot.dep,w.depAdd); });
  return tot;
}
function renderOverview(){
  const tot = yearlyTotals();
  const balance = Math.round((tot.rev-tot.dep)*100)/100;
  const joined = MONTHS.reduce((s,mk)=>s+opsOf(mk).length,0);
  const kpis = [
    {cls:'blue', label:'Revenus '+state.year, val:cmoney(tot.rev), sub:'Total entrées'},
    {cls:'red',  label:'Dépenses '+state.year, val:cmoney(tot.dep), sub:'Total sorties'},
    {cls: balance<0?'red':'green', label:'Solde '+state.year, val:cmoney(balance), sub:'Revenus − dépenses'},
    {cls:'violet', label:'Ajouts manuels', val:String(joined), sub:'opérations saisies'},
  ];
  document.getElementById('kpis').innerHTML = kpis.map(k=>`
    <div class="kpi ${k.cls}"><div class="label">${k.label}</div>
    <div class="val ${k.cls==='red'?'neg':k.cls==='green'?'pos':''}">${k.val}</div>
    <div class="sub">${k.sub}</div></div>`).join('');

  const revs = MONTHS.map(mk=>baseRevTotal(monthByKey(mk)) + opsOf(mk).filter(o=>o.type==='revenu').reduce((s,o)=>s+o.amount,0));
  const deps = MONTHS.map(mk=>baseDepTotal(monthByKey(mk)) + opsOf(mk).filter(o=>o.type==='depense').reduce((s,o)=>s+o.amount,0));
  drawBarChart('chartRevDep', { labels:MONTHS_FR.map(m=>m.slice(0,3)), series:[
      {name:'Revenus', color:'#22c55e', values:revs},
      {name:'Dépenses', color:'#ef4444', values:deps},
  ]});

  // donut dépenses annuelles par catégorie
  const catTot = {};
  BASE.forEach(m => { (m.depenses||[]).forEach(c=>{ const k=norm(c.categorie); catTot[k]=addAmounts(catTot[k]||0, parseAmount(c.total)); }); });
  MONTHS.forEach(mk=>{
    const ops=opsOf(mk).filter(o=>o.type==='depense');
    ops.forEach(o=>{ const k=norm(o.cat); catTot[k]=(catTot[k]||0)+o.amount; });
  });
  const entries = Object.entries(catTot).map(([k,v])=>({k,v})).filter(e=>e.v>0).sort((a,b)=>b.v-a.v);
  drawDonut('chartDonut', entries.map(en=>({label:catMeta(en.k).label, color:catMeta(en.k).color, rawKey:en.k, v:en.v})));
  renderTopCat(entries);
}

function renderTopCat(entries){
  const max = entries.length? entries[0].v : 0;
  document.getElementById('topCat').innerHTML = entries.map(e=>{
    const m = catMeta(e.k);
    const pct = max? Math.round(e.v/max*100) : 0;
    return `<div class="tcat">
      <span class="bar-label" style="min-width:200px">${m.label}</span>
      <div class="bar-wrap"><div class="bar" style="width:${pct}%;background:${m.color}"></div></div>
      <span class="money">${cmoney(e.v)}</span>
      <span class="pct muted">${Math.round(e.v/totDep()*100||0)}%</span>
    </div>`;
  }).join('');
  function totDep(){ let t=0; entries.forEach(e=>t+=e.v); return t; }
}

/* ============ MOIS ============ */
function renderMonth(){
  const mk = MONTHS[state.month];
  document.getElementById('currentMonthTitle').textContent = MONTHS_FR[state.month] + ' ' + state.year;
  const w = monthWithOps(mk);
  const kpis = [
    {cls:'blue', label:'Revenus', val:cmoney(w.revTotal), sub:w.revAdd?'dont +'+cmoney(w.revAdd)+' (ajouts)':'représentation mensuelle'},
    {cls:'red', label:'Dépenses', val:cmoney(w.depTotal), sub:w.depAdd?'dont +'+cmoney(w.depAdd)+' (ajouts)':''},
    {cls: w.somme<0?'red':'green', label:'Somme restante', val:cmoney(w.somme), sub:'solde du mois'},
  ];
  document.getElementById('monthKpis').innerHTML = kpis.map(k=>`
    <div class="kpi ${k.cls}"><div class="label">${k.label}</div>
    <div class="val ${k.cls==='red'?'neg':k.cls==='green'?'pos':''}">${k.val}</div>
    <div class="sub">${k.sub}</div></div>`).join('');

  // Revenus (accordeon + couleurs, comme les dépenses)
  renderRevenues(mk);

  // Dépenses par catégorie
  renderExpenses(mk);
  renderUserOps(mk);
}

/* Couleur stable par source de revenu (déterministe pour les sources personnalisées) */
function revColor(key){
  const known = {
    'salaire david':'#22c55e',
    'salaire sophie':'#34d399',
    'aides social':'#4f9cf9',
    'aides sociales':'#4f9cf9',
    'aides sociales (caf)':'#4f9cf9',
    'caf':'#4f9cf9',
    'solde mois precedent':'#94a3b8',
    'mouvement interne crediteur':'#a78bfa',
    'autre revenu':'#f59e0b',
  };
  const k = norm(key);
  if(known[k]) return known[k];
  const colors = ['#22c55e','#4f9cf9','#f59e0b','#a78bfa','#f472b6','#2dd4bf','#38bdf8','#34d399'];
  let h=0; for(const ch of k) h=(h*31+ch.charCodeAt(0))>>>0;
  return colors[h % colors.length];
}

/* Revenus du mois groupés par source, en accordéon coloré (façon dépenses) */
function renderRevenues(mk){
  const w = monthWithOps(mk);
  const map = {};
  (w.month.revenus||[]).forEach(r=>{
    const k = norm(r.nom);
    if(!map[k]) map[k] = {label:r.nom, items:[], total:0};
    const amt = parseAmount(r.montant);
    map[k].total = Math.round((map[k].total+amt)*100)/100;
    map[k].items.push({detail:r.detail||'', amount:amt});
  });
  w.revOps.forEach(o=>{
    const k = norm(o.cat);
    if(!map[k]) map[k] = {label:o.cat, items:[], total:0, user:[]};
    map[k].total = addAmounts(map[k].total, o.amount);
    if(!map[k].user) map[k].user=[];
    map[k].user.push({label:o.label, amount:o.amount});
  });
  const sorted = Object.values(map).sort((a,b)=>b.total-a.total);
  document.getElementById('revenueList').innerHTML = sorted.map(c=>{
    const col = revColor(c.label);
    const items = c.items.map(r=>`
      <div class="row"><span class="muted">${e(r.detail)||'—'}</span><span class="money" style="color:${col}">${fmt(r.amount)} €</span></div>`).join('');
    const user = (c.user||[]).map(u=>`
      <div class="row" style="color:var(--accent)"><span>${e(u.label)||'Ajout manuel'}</span><span class="money">+${fmt(u.amount)} €</span></div>`).join('');
    return `<div class="cat">
      <div class="head" onclick="this.parentElement.classList.toggle('open')">
        <span class="cname" style="color:${col}">● ${e(c.label)}</span>
        <span class="ctotal">${cmoney(c.total)}</span>
      </div>
      <div class="body">${items}${user}</div>
    </div>`;
  }).join('');
}

function renderExpenses(mk){
  const map = catTotalsMk(mk);
  const sorted = Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
  document.getElementById('expenseList').innerHTML = sorted.map(([k,c])=>{
    const m = catMeta(c.label);
    const items = (c.items||[]).map(it=>`
      <div class="row"><span class="muted">${e((it.nom||'').trim())||'—'}</span><span class="money seg-amount">${(it.montant||'').replace(/€/g,'').trim()||'0,00'}</span></div>`).join('');
    const user = (c.userOps||[]).map(u=>`
      <div class="row" style="color:var(--accent)"><span>${e(u.label)||'Ajout manuel'}</span><span class="money">+${fmt(u.amount)} €</span></div>`).join('');
    return `<div class="cat">
      <div class="head" onclick="this.parentElement.classList.toggle('open')">
        <span class="cname" style="color:${m.color}">● ${m.label}</span>
        <span class="ctotal">${cmoney(c.total)}</span>
      </div>
      <div class="body">${items}${user}</div>
    </div>`;
  }).join('');
}

function renderUserOps(mk){
  const arr = oy(state.year)[mk] || (oy(state.year)[mk] = []);
  const ops = arr;
  const box = document.getElementById('userOps');
  if(!ops.length){ box.innerHTML = '<div class="muted" style="font-size:13px">Aucune opération ajoutée.</div>'; return; }
  box.innerHTML = `<div class="list">` + ops.map((o,i)=>{
    const isRev = o.type==='revenu';
    return `<div class="row">
      <div class="nam"><span class="bar-label">${e(o.cat)} <span class="tag ${isRev?'ok':'over'}" style="font-size:10px">${isRev?'+':'− '}</span></span><span class="lbl">${e((o.sub?o.label+' · '+o.sub:(o.label))||'')}</span></div>
      <div style="display:flex;gap:10px;align-items:center">
        <span class="money" style="color:${isRev?'var(--accent2)':'var(--danger)'}">${isRev?'+':''}${fmt(o.amount)} €</span>
        <button class="btn ghost small" data-edit="${i}">Modifier</button>
        <button class="btn ghost small" data-del="${i}">Suppr.</button>
      </div>
    </div>`;
  }).join('') + `</div>`;
  box.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEdit(mk, +b.dataset.edit));
  box.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
    const i = +b.dataset.del;
    if(confirm('Supprimer cette opération ?')){
      const a = oy(state.year)[mk];
      a.splice(i,1);
      if(!a.length) delete oy(state.year)[mk];
      saveOps(); renderMonth();
    }
  });
}

/* ============ BUDGET ============ */
const BUDGET = {
  revPlan: 4541.40, revReelLabel:'',
  fixe: 1812.59, variable: 2554.65, epargne: 200.00,
  cats:[
    {label:'Abonnement & téléphonie', plan:86.96,      keys:['abonnement et téléphonie']},
    {label:'Voyage & transport + Auto',plan:318.12,    keys:['voyage et transport','auto moto']},
    {label:'Cadeaux & solidarité',    plan:8.32,       keys:['cadeaux et solidarité']},
    {label:'Opérations bancaires',    plan:40.00,      keys:['Opération banquaire']},
    {label:'Éducation & famille',     plan:88.35,      keys:['education et famille']},
    {label:'Logement',                plan:1223.00,    keys:['logement']},
    {label:'Loisirs',                 plan:133.01,     keys:['loisir']},
    {label:'Santé',                   plan:182.56,     keys:['santé']},
    {label:'Vie quotidienne',         plan:2286.92,    keys:['vie quotidienne']},
  ],
};
function catYearlyAvg(key){
  let sum=0; let n=0;
  BASE.forEach(m=>{
    const c = (m.depenses||[]).find(x=>norm(x.categorie)===norm(key));
    if(c){ sum+=parseAmount(c.total); n++; }
  });
  return n? sum/n : 0;
}
function renderBudget(){
  const kpis = [
    {cls:'blue', label:'Budget revenus', val:cmoney(BUDGET.revPlan), sub:'objectif mensuel'},
    {cls:'red', label:'Charges fixes', val:cmoney(BUDGET.fixe), sub:'loyer, abonnements…'},
    {cls:'warn', label:'Charges variables', val:cmoney(BUDGET.variable), sub:'courses, loisirs…'},
    {cls:'green', label:'Balance', val:cmoney(BUDGET.revPlan-(BUDGET.fixe+BUDGET.variable)), sub:'épargne visée '+cmoney(BUDGET.epargne)},
  ];
  document.getElementById('budgetKpis').innerHTML = kpis.map(k=>`
    <div class="kpi ${k.cls}"><div class="label">${k.label}</div>
    <div class="val">${k.val}</div><div class="sub">${k.sub}</div></div>`).join('');

  const tbody = document.querySelector('#budgetTable tbody');
  tbody.innerHTML = BUDGET.cats.map(c=>{
    const real = c.keys.reduce((s,key)=>s+catYearlyAvg(key),0);
    const ecart = real - c.plan;
    const status = ecart<=0 ? `<span class="tag ok">OK</span>` : `<span class="tag over">+${fmt(ecart)} €</span>`;
    return `<tr>
      <td>${c.label}</td>
      <td class="money">${cmoney(c.plan)}</td>
      <td class="money">${cmoney(real)}</td>
      <td class="money ${ecart<=0?'pos':'neg'}">${ecart<=0?fmt(ecart):'+'+fmt(ecart)} €</td>
      <td>${status}</td>
    </tr>`;
  }).join('');
  drawDonut('chartFixeVar', [
    {label:'Charges fixes', color:'#ef4444', v:BUDGET.fixe},
    {label:'Charges variables', color:'#4f9cf9', v:BUDGET.variable},
  ]);
}

/* ============ GRAPHIQUES ============ */
function renderCharts(){
  // stacked bars : grandes catégories via quelques agrégats
  const groups = [
    {label:'Logement', color:'#38bdf8', keys:['logement']},
    {label:'Vie quotidienne', color:'#facc15', keys:['vie quotidienne']},
    {label:'Transports', color:'#a78bfa', keys:['voyage et transport','auto moto']},
    {label:'Santé', color:'#e879f9', keys:['santé']},
    {label:'Autres', color:'#94a3b8', keys:['abonnement et téléphonie','cadeaux et solidarité','Opération banquaire','education et famille','autre','impots et taxe','loisir','mouvement interne débiteur']},
  ];
  const series = groups.map(g=>({
    name:g.label, color:g.color,
    values: MONTHS.map(mk=>{ const map=catTotalsMk(mk); return g.keys.reduce((s,k)=>s+(map[norm(k)]?map[norm(k)].total:0),0); })
  }));
  drawStacked('chartStacked', {labels:MONTHS_FR.map(m=>m.slice(0,3)), series});

  const restes = MONTHS.map(mk=>monthWithOps(mk).somme);
  drawBarChart('chartRestante', { labels:MONTHS_FR.map(m=>m.slice(0,3)), series:[{name:'Solde', color:()=>0, mode:'single', values:restes}] }, {single:true});
  drawDonut('chartFixeVar', [
    {label:'Charges fixes', color:'#ef4444', v:BUDGET.fixe},
    {label:'Charges variables', color:'#4f9cf9', v:BUDGET.variable},
  ], true);
}

/* ============ Ajout d'opération ============ */
function openModal(){
  editingKey = null;
  document.getElementById('modalTitle').textContent = 'Ajouter une opération';
  document.getElementById('addForm').reset();
  const sel = document.getElementById('fMois');
  sel.innerHTML = MONTHS.map((mk,i)=>`<option value="${i}">${MONTHS_FR[i]} ${state.year}</option>`).join('');
  sel.value = state.month;
  setFormType('depense');
  document.getElementById('modal').classList.remove('hidden');
}
function openEdit(mk, i){
  const op = oy(state.year)[mk][i];
  if(!op) return;
  editingKey = {mk, year: state.year, i};
  document.getElementById('modalTitle').textContent = 'Modifier l\u2019opération';
  document.getElementById('addForm').reset();
  const sel = document.getElementById('fMois');
  sel.innerHTML = MONTHS.map((m,idx)=>`<option value="${idx}">${MONTHS_FR[idx]} ${state.year}</option>`).join('');
  sel.value = MONTHS.indexOf(mk);
  setFormType(op.type);
  const fcat = document.getElementById('fCat');
  if([...fcat.options].some(o=>o.value===op.cat)) fcat.value = op.cat; else fcat.value='';
  updateSubSelect();
  if(op.sub) document.getElementById('fSub').value = op.sub;
  const lbl = (op.label && op.label!==op.sub) ? op.label : '';
  document.getElementById('fLabel').value = lbl||'';
  document.getElementById('fAmount').value = op.amount;
  document.getElementById('modal').classList.remove('hidden');
}
function setFormType(type){
  document.querySelectorAll('.seg').forEach(b=>b.classList.toggle('active', b.dataset.type===type));
  const base = type==='depense' ? CATS.map(c=>`<option value="${c.key}">${c.label}</option>`)
                                : REVENUE_SOURCES.map(s=>`<option value="${s}">${s}</option>`);
  const custom = (type==='depense'?customCats:customSrc).map(c=>`<option value="${c}">${c} (personnalisée)</option>`);
  const cat = document.getElementById('fCat');
  cat.innerHTML = base.join('') + custom.join('');
  updateSubSelect();
}
function updateSubSelect(){
  const id = document.getElementById('fCat').value;
  const subs = subsOf(id);
  document.getElementById('fSub').innerHTML = '<option value="">—</option>' +
    subs.map(s=>`<option value="${e(s)}">${e(s)}</option>`).join('');
}
function showToast(msg, cls){
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast ' + (cls||'ok');
  clearTimeout(t._t); t._t = setTimeout(()=>t.classList.add('hidden'), 2600);
}

/* ============ Graphiques canvas ============ */
function dprCanvas(id){
  const cv = document.getElementById(id);
  const dpr = window.devicePixelRatio||1;
  const rect = cv.getBoundingClientRect();
  cv.width = Math.round(rect.width*dpr);
  cv.height = Math.round(parseInt(cv.getAttribute('height')||260)*dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return {cv, ctx, w:cv.width/dpr, h:parseInt(cv.getAttribute('height')||260)};
}
function text(ctx, x, y, s, opts={}){
  ctx.fillStyle = opts.color||'#8b96a5';
  ctx.font = opts.font||'11px Segoe UI';
  ctx.textAlign = opts.align||'center';
  ctx.textBaseline = opts.base||'middle';
  ctx.fillText(s,x,y);
}
function drawBarChart(id, data, opts={}){
  const {ctx,w,h} = dprCanvas(id);
  ctx.clearRect(0,0,w,h);
  const padL=52, padR=10, padT=16, padB=26;
  const chartW = w-padL-padR, chartH = h-padT-padB;
  let max = 0;
  data.series.forEach(sr=>sr.values.forEach(v=>{ if(Math.abs(v)>max) max=Math.abs(v); }));
  if(opts.single){ max=Math.max.apply(null,data.series[0].values.map(Math.abs)); if(max===0)max=1; }
  max = Math.ceil(max*1.1/100)*100||100;
  const slot = chartW/data.labels.length;
  const nSeries = data.series.length;
  const bw = Math.min(slot*0.5/nSeries, 26);

  // grille + axe Y
  ctx.strokeStyle='#222b3a'; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y = padT + chartH - (chartH*i/4);
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(w-padR,y); ctx.stroke();
    text(ctx, padL-8, y, fmt(max*i/4), {align:'right'});
  }
  // barres
  data.series.forEach((sr,si)=>{
    sr.values.forEach((v,i)=>{
      const x = padL + i*slot + slot/2 - bw*nSeries/2 + si*bw;
      const bh = (Math.abs(v)/max)*chartH;
      const y = v>=0 ? padT+chartH-bh : padT+chartH;
      ctx.fillStyle = sr.color;
      if(opts.single && typeof sr.color==='function'){
        ctx.fillStyle = v<0 ? '#ef4444' : '#22c55e';
      }
      ctx.fillRect(x,y,bw-2,Math.max(2,bh));
      // valeur au-dessus
      ctx.fillStyle = v<0?'#ef4444':(sr.color||'#e6edf3');
      ctx.font='9px Segoe UI'; ctx.textAlign='center';
      if(!opts.single){ if(v!==0) ctx.fillText(Math.round(v), x+bw/2, v>=0?y-4:y+bh+9); }
    });
  });
  // légende
  if(!opts.single){
    let lx = padL;
    data.series.forEach(sr=>{ ctx.fillStyle=sr.color; ctx.fillRect(lx,6,10,10); text(ctx,lx+16,11,sr.name,{align:'left',color:'#e6edf3',font:'11px Segoe UI'}); lx += 30 + ctx.measureText(sr.name).width+18; });
  }
  // axe X
  data.labels.forEach((l,i)=>text(ctx, padL+i*slot+slot/2, h-12, l, {color:'#8b96a5',font:'11px Segoe UI'}));
}

const DONUT_COLORS = ['#4f9cf9','#22c55e','#f59e0b','#ef4444','#a78bfa','#f472b6','#2dd4bf','#38bdf8','#facc15','#94a3b8','#34d399','#fb7185','#e879f9'];
function drawDonut(id, entries, isFixeVar){
  const {ctx,w,h} = dprCanvas(id);
  ctx.clearRect(0,0,w,h);
  const total = entries.reduce((s,e)=>s+(e.v||0),0) || 1;
  const cx=w/2, cy=h/2, R=Math.min(w,h)*0.34, hole=R*0.58;
  let a=-Math.PI/2;
  const slices = entries.map((e,i)=>({color:e.color||DONUT_COLORS[i%DONUT_COLORS.length], label:e.label||'', v:e.v||0, frac:(e.v||0)/total}));
  slices.forEach(s=>{
    const a1=a, a2=a+s.frac*Math.PI*2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R,a1,a2); ctx.closePath();
    ctx.fillStyle=s.color; ctx.fill(); a=a2;
  });
  ctx.beginPath(); ctx.arc(cx,cy,hole,0,Math.PI*2); ctx.fillStyle='#161b22'; ctx.fill();
  text(ctx,cx,cy, fmt(total)+' €',{color:'#e6edf3',font:'bold 13px Segoe UI'});
  text(ctx,cx,cy+15,'total',{color:'#8b96a5',font:'10px Segoe UI'});

  const leg = document.getElementById('donutLegend');
  if(!isFixeVar){
    leg.innerHTML = slices.slice(0,8).map(s=>`<div class="row" style="padding:4px 2px;font-size:13px"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${s.color};margin-right:8px"></i>${s.label}</span><span class="money">${cmoney(s.v)}</span></div>`).join('');
  } else {
    leg.innerHTML = slices.map(s=>`<div class="row" style="padding:4px 2px;font-size:13px"><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${s.color};margin-right:8px"></i>${s.label}</span><span class="money">${cmoney(s.v)} (${Math.round(s.frac*100)}%)</span></div>`).join('');
  }
}

function drawStacked(id, data){
  const {ctx,w,h} = dprCanvas(id);
  ctx.clearRect(0,0,w,h);
  const padL=52, padR=10, padT=16, padB=26;
  const chartW=w-padL-padR, chartH=h-padT-padB;
  let max=0;
  data.series.forEach(sr=>sr.values.forEach(v=>{ if(v>max)max=v; }));
  max=Math.ceil(max*1.1/100)*100||100;
  const slot=chartW/data.labels.length, bw=Math.min(slot*0.55,36);
  ctx.strokeStyle='#222b3a';
  for(let i=0;i<=4;i++){ const y=padT+chartH-chartH*i/4; ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(w-padR,y);ctx.stroke(); text(ctx,padL-8,y,fmt(max*i/4),{align:'right'}); }
  data.series.forEach(sr=>{
    sr.values.forEach((v,i)=>{
      // on empile : on calcule la somme des segments déjà posés en colonne i
      let acc=0;
      data.series.forEach(s2=>{ if(data.series.indexOf(s2)<data.series.indexOf(sr)) acc+=s2.values[i]; });
      const y0 = padT+chartH - (acc/max)*chartH;
      const hhi = (v/max)*chartH;
      const x = padL + i*slot + slot/2 - bw/2;
      ctx.fillStyle=sr.color;
      ctx.fillRect(x, y0-hhi, bw, hhi-1);
    });
  });
  let lx=padL;
  data.series.forEach(sr=>{ ctx.fillStyle=sr.color; ctx.fillRect(lx,6,10,10); text(ctx,lx+16,11,sr.name,{align:'left',color:'#e6edf3',font:'11px Segoe UI'}); lx+=30+ctx.measureText(sr.name).width+16; });
  data.labels.forEach((l,i)=>text(ctx,padL+i*slot+slot/2,h-12,l,{color:'#8b96a5',font:'11px Segoe UI'}));
}

/* ============ GESTION DES CATÉGORIES ============ */
let catMode = 'depense';
function allCats(mode){
  if(mode==='depense') return [
    ...CATS.map(c=>({id:c.key, label:c.label, custom:false})),
    ...customCats.map(c=>({id:c, label:c+' (personnalisée)', custom:true})),
  ];
  return [
    ...REVENUE_SOURCES.map(s=>({id:s, label:s, custom:false})),
    ...customSrc.map(s=>({id:s, label:s+' (personnalisée)', custom:true})),
  ];
}
function renderCatManager(){
  const listBox = document.getElementById('catList');
  document.querySelectorAll('#catModeSeg .seg').forEach(b=>b.classList.toggle('active', b.dataset.catmode===catMode));
  const isDep = catMode==='depense';
  document.getElementById('newCatName').placeholder = isDep
    ? 'Nom de la nouvelle catégorie de dépense'
    : 'Nom de la nouvelle source de revenu';
  const cats = allCats(catMode);
  if(!cats.length){ listBox.innerHTML='<div class="muted">Aucune catégorie.</div>'; return; }
  listBox.innerHTML = cats.map((c,ci)=>{
    const subs = subsOf(c.id);
    const chips = subs.length
      ? subs.map((s,si)=>`<span class="chip">${e(s)} <button type="button" class="chip-x" data-del-sub="${ci}-${si}" title="Supprimer">✕</button></span>`).join(' ')
      : '<span class="muted" style="font-size:12px">Aucune sous-catégorie</span>';
    const cab = c.custom
      ? `<button type="button" class="btn ghost small" data-del-cat="${ci}">Supprimer</button>`
      : '<span class="muted" style="font-size:11px">standard</span>';
    return `<div class="cat">
      <div class="head" onclick="this.parentElement.classList.toggle('open')">
        <span class="cname">${e(c.label)}</span>
        ${cab}
      </div>
      <div class="body">
        <div class="subs" style="line-height:1.9">${chips}</div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <input class="sub-input" data-cat="${ci}" type="text" placeholder="Ajouter une sous-catégorie…" style="flex:1">
          <button type="button" class="btn ghost small" data-add-sub="${ci}">＋</button>
        </div>
      </div>
    </div>`;
  }).join('');

  listBox.querySelectorAll('[data-del-cat]').forEach(b=>b.onclick=()=>{
    const i=+b.dataset.delCat;
    const arr = catMode==='depense'?customCats:customSrc;
    const id = allCats(catMode)[i].id;
    arr.splice(arr.indexOf(id),1);
    if(catMode==='depense') saveCats(); else saveSrc();
    renderCatManager();
  });
  listBox.querySelectorAll('[data-del-sub]').forEach(b=>b.onclick=()=>{
    const [ci,si]=b.dataset.delSub.split('-').map(Number);
    const id = allCats(catMode)[ci].id;
    removeSub(id,si);
    renderCatManager();
  });
  listBox.querySelectorAll('.sub-input').forEach(inp=>inp.addEventListener('keydown',ev=>{
    if(ev.key==='Enter'){ ev.preventDefault(); commitSub(inp); }
  }));
  listBox.querySelectorAll('[data-add-sub]').forEach(b=>b.onclick=()=>{
    const inp = listBox.querySelector(`.sub-input[data-cat="${b.dataset.addSub}"]`);
    commitSub(inp);
  });
}
function commitSub(inp){
  const ci = inp.dataset.cat;
  const id = allCats(catMode)[ci].id;
  const res = addSub(id, inp.value);
  if(res===null) return;
  if(res===false){ showToast('Cette sous-catégorie existe déjà.','err'); return; }
  inp.value='';
  renderCatManager();
}

/* ---------- helpers html ---------- */
function e(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', async ()=>{
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  document.getElementById('prevMonth').onclick=()=>{ state.month=(state.month+11)%12; renderMonth(); };
  document.getElementById('nextMonth').onclick=()=>{ state.month=(state.month+1)%12; renderMonth(); };
  document.getElementById('prevYear').onclick=()=>changeYear(-1);
  document.getElementById('nextYear').onclick=()=>changeYear(1);
  document.getElementById('btnAdd').onclick=openModal;
  document.getElementById('modalClose').onclick=()=>document.getElementById('modal').classList.add('hidden');
  document.getElementById('formCancel').onclick=()=>document.getElementById('modal').classList.add('hidden');
  document.querySelectorAll('.seg').forEach(b=>b.onclick=()=>setFormType(b.dataset.type));

  document.getElementById('fCat').addEventListener('change', ()=>updateSubSelect());

  /* Onglet Catégories */
  document.querySelectorAll('#catModeSeg .seg').forEach(b=>b.onclick=()=>{ catMode=b.dataset.catmode; renderCatManager(); });
  document.getElementById('btnNewCat').onclick=()=>{
    const name = document.getElementById('newCatName').value.trim();
    if(!name){ showToast('Saisis un nom de ' + (catMode==='depense'?'catégorie':'source') + '.','err'); return; }
    const arr = catMode==='depense' ? customCats : customSrc;
    if(arr.some(x=>norm(x)===norm(name))){ showToast('Elle existe déjà.','err'); return; }
    arr.push(name);
    if(catMode==='depense') saveCats(); else saveSrc();
    document.getElementById('newCatName').value='';
    renderCatManager();
    showToast((catMode==='depense'?'Catégorie':'Source') + ' ajoutée ✔');
  };
  document.getElementById('newCatName').addEventListener('keydown', ev=>{
    if(ev.key==='Enter'){ ev.preventDefault(); document.getElementById('btnNewCat').click(); }
  });

  document.getElementById('btnReset').onclick=()=>{
    if(confirm('Supprimer toutes vos opérations ajoutées ?')){
      userOps={}; saveOps(); switchTab(state.tab); showToast('Ajouts supprimés.');
    }
  };

  document.getElementById('addForm').addEventListener('submit', ev=>{
    ev.preventDefault();
    const type = document.querySelector('.seg.active').dataset.type;
    const mi = +document.getElementById('fMois').value;
    const mk = MONTHS[mi];
    const cat = document.getElementById('fCat').value;
    const sub = document.getElementById('fSub').value;
    const label = document.getElementById('fLabel').value.trim();
    const amount = parseFloat(document.getElementById('fAmount').value);
    if(!amount||amount<=0){ showToast('Montant invalide.','err'); return; }
    const payload = {type, cat, sub, label:label||sub||(type==='depense'?'Dépense':'Revenu'), amount:Math.round(amount*100)/100};
    if(editingKey){
      const {mk:emk, year:ey, i:ei} = editingKey;
      // si on a changé de année ou de mois, on déplace l'opération
      if(emk!==mk || ey!==state.year){
        const src = oy(ey)[emk];
        if(src){ src.splice(ei,1); if(!src.length) delete oy(ey)[emk]; }
        if(!oy(state.year)[mk]) oy(state.year)[mk]=[];
        oy(state.year)[mk].push(payload);
      } else {
        oy(state.year)[mk][ei] = payload;
      }
    } else {
      if(!oy(state.year)[mk]) oy(state.year)[mk]=[];
      oy(state.year)[mk].push(payload);
    }
    editingKey = null;
    saveOps();
    document.getElementById('modal').classList.add('hidden');
    state.month = mi;
    switchTab(state.tab);
    showToast('Opération enregistrée ✔');
  });

  window.addEventListener('resize', ()=>switchTab(state.tab));
  await initStorage();
  switchTab('overview');
});
