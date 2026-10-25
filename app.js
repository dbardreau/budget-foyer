/* ============================================================
   Budget Foyer 2026 — application web (GitHub Pages + Supabase)
   Données de base : window.BUDGET2026 (data.js)
   Données personnelles : base Supabase (connectée, sécurisée)
   ============================================================ */

/* ---------- Utilitaires ---------- */
const MONTHS = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

let BASE = Array.isArray(window.BUDGET2026) ? window.BUDGET2026 : [];
/* Données de base par année : baseData = { "2026": [12 mois], "2027": [...] , … } */
let baseData = {};

/* Relevés du Livret Bourso+ : epargneData = { "2026": [12 mois], … }.
   Les relevés importés vivent dans data-epargne.js. */
let epargneData = {};
(function initEpargne(){
  if(Array.isArray(window.BUDGET_EPARGNE_2026)) epargneData['2026'] = window.BUDGET_EPARGNE_2026;
  if(window.BUDGET_EPARGNE && typeof window.BUDGET_EPARGNE === 'object'){
    for(const y in window.BUDGET_EPARGNE){
      if(Array.isArray(window.BUDGET_EPARGNE[y])) epargneData[y] = window.BUDGET_EPARGNE[y];
    }
  }
})();

/* Comptes gérés par l'application */
const ACCOUNTS = [
  {key:'commun', label:'Compte commun', short:'Commun', color:'#4f9cf9'},
  {key:'livret', label:'Livret Bourso+', short:'Livret', color:'#22c55e'},
];
function accountLabel(key){ const a=ACCOUNTS.find(x=>x.key===key); return a?a.label:'Compte commun'; }

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

/* Catégories / sources personnalisées (enregistrées en base Supabase) */
let customCats = [];
let customSrc  = [];
function saveCats(){ saveKey('custom_cats', customCats); }
function saveSrc(){ saveKey('custom_src', customSrc); }

/* Sous-catégories par catégorie (base Supabase) */
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
const state = { tab:'overview', month:new Date().getMonth(), year:2026, account:'commun' };
let editingKey = null; // {mk, id} quand on modifie une opération existante

/* ============================================================
   STOCKAGE EN BASE DE DONNÉES SUPABASE (cloud)
   Le site est hébergé sur GitHub Pages et stocke ses données
   (ajouts manuels, catégories, sources, sous-catégories) dans
   une base Supabase, protégée par une connexion (email + mot de
   passe). Toute la synchronisation est asynchrone (Promise).
   ============================================================ */
const SB_URL = 'https://gcibvyjwxnngbduusccf.supabase.co';
const SB_KEY = 'sb_publishable_w23iyinmx-9hlTRSROjsLQ_B92OKz4_';

let userOps = {};
let online = false;

function sbToken(){ return localStorage.getItem('sb_token') || ''; }
function sbSession(){
  return {
    apikey: SB_KEY,
    Authorization: 'Bearer ' + sbToken(),
    'Content-Type': 'application/json',
  };
}
/* Affiche l'écran de connexion et masque l'application */
function requireLogin(msg){
  online = false; updateSyncBadge();
  const ov = document.getElementById('loginOverlay');
  const app = document.getElementById('app');
  if(ov) ov.classList.remove('hidden');
  if(app) app.classList.add('hidden');
  if(msg){ const er = document.getElementById('loginError'); if(er) er.textContent = msg; }
}
/* Connexion à Supabase Auth (email + mot de passe) */
async function sbLogin(email, password){
  const res = await fetch(SB_URL + '/auth/v1/token?grant_type=password', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', apikey: SB_KEY },
    body: JSON.stringify({ email, password }),
  });
  const d = await res.json();
  if(!res.ok || !d.access_token){
    throw new Error(d.error_description || d.msg || 'Échec de la connexion');
  }
  localStorage.setItem('sb_token', d.access_token);
  return d;
}
/* Lit toutes les données : renvoie un objet { k : valeur, … } */
async function sbFetchAll(){
  const res = await fetch(SB_URL + '/rest/v1/kv?select=k,v', { headers: sbSession() });
  if(res.status===401 || res.status===403) throw new Error('auth');
  if(!res.ok) throw new Error('Erreur serveur (' + res.status + ')');
  const rows = await res.json();
  const out = {};
  for(const r of rows) out[r.k] = r.v;
  return out;
}
/* Enregistre une clé (upsert) */
async function sbSave(k, v){
  const res = await fetch(SB_URL + '/rest/v1/kv', {
    method:'POST',
    headers:{ ...sbSession(), Prefer:'resolution=merge-duplicates' },
    body: JSON.stringify({ k, v }),
  });
  if(res.status===401 || res.status===403) throw new Error('auth');
  if(!res.ok) throw new Error('Erreur serveur (' + res.status + ')');
}

/* Charge toutes les données depuis la base au démarrage */
async function initStorage(){
  try{
    const d = await sbFetchAll();
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
    // La base 2026 (données statiques) provient toujours de data.js (window.BUDGET2026) :
    // cela permet de propager les corrections du fichier (ex. réintégration de « vie quotidienne »)
    // vers Supabase au chargement. Les saisies manuelles vivent dans `ops`, pas dans la base.
    if(Array.isArray(window.BUDGET2026) && window.BUDGET2026.length){
      newBase['2026'] = window.BUDGET2026;
    }
    baseData = newBase;

    // Re-sauvegarde au format normalisé (met à jour l'ancien format si besoin)
    sbSave('base', baseData).catch(()=>{});
    sbSave('ops', userOps).catch(()=>{});

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
    sbSave('base', baseData).catch(()=>{});
  }
  state.year = y;
  applyYear();
}
function setYearMeta(){  const y = String(state.year);
  const el = document.getElementById('yearLabel'); if(el) el.textContent = y;
  const hd = document.getElementById('hdYear');  if(hd) hd.textContent = y;
  const dt = document.getElementById('donutYear'); if(dt) dt.textContent = y;
  document.title = 'Budget Foyer ' + y;
}

/* Enregistre une clef en base (envoi asynchrone) */
function saveKey(k, v){
  sbSave(k, v).then(()=>{ online = true; updateSyncBadge(); })
    .catch(err=>{ online = false; updateSyncBadge(); if(String(err && err.message)==='auth') requireLogin('Session expirée, reconnectez-vous.'); });
}

function saveOps(){ saveKey('ops', userOps); }

function updateSyncBadge(){
  const el = document.getElementById('syncBadge');
  if(!el) return;
  el.textContent = online ? '● Base Supabase — synchronisé' : '● Base Supabase — hors ligne';
  el.classList.toggle('online', online);
}

function monthByKeyFor(year, k){ return yearMonths(year).find(m=>m.mois===k) || emptyMonth(k); }
function monthByKey(k){ return monthByKeyFor(state.year, k); }
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

/* ---------- Comptes ---------- */
/* Opérations saisies pour une année / un mois (toutes origines) */
function opsOfYear(year, mk){ return (userOps[String(year)]||{})[mk] || []; }
/* Opérations du compte commun uniquement (les anciennes n'ont pas de champ compte) */
function commonOps(list){ return list.filter(o=>(o.compte||'commun')==='commun'); }
function isInterne(o){ return !!(o && (o.interne===true || /^mouvement interne/.test(norm(o.cat)))); }

function emptyEpargneMonth(mk){ return {mois:mk, soldeDebut:null, soldeFin:null, operations:[]}; }
function epargneMonths(year){
  const arr = epargneData[String(year)];
  return (Array.isArray(arr) && arr.length===12) ? arr : MONTHS.map(emptyEpargneMonth);
}
function epargneMonthOf(year, mk){
  return epargneMonths(year).find(m=>m.mois===mk) || emptyEpargneMonth(mk);
}
/* Mouvements du Livret : relevés importés + saisies manuelles */
function epargneOps(year, mk){
  const m = epargneMonthOf(year, mk);
  const base = ((m && m.operations) || []).map(o=>({ ...o, compte:'livret', source:'releve' }));
  const manual = opsOfYear(year, mk).filter(o=>(o.compte||'commun')==='livret');
  return base.concat(manual);
}
/* Vue mensuelle du Livret Bourso+ */
function livretMonth(year, mk){
  const m = epargneMonthOf(year, mk);
  const ops = epargneOps(year, mk);
  const revOps = ops.filter(o=>o.type==='revenu');
  const depOps = ops.filter(o=>o.type==='depense');
  const revTotal = addAmounts(revOps.reduce((s,o)=>s+(o.montant||o.amount||0),0),0);
  const depTotal = addAmounts(depOps.reduce((s,o)=>s+(o.montant||o.amount||0),0),0);
  const net = addAmounts(revTotal, -depTotal);
  const soldeCompte = (m.soldeDebut==null) ? null : addAmounts(m.soldeDebut, net);
  return {month:m, ops, revOps, depOps, revTotal, depTotal, somme:net, soldeCompte, soldeDebut:m.soldeDebut};
}

/* Totaux du compte commun avec ajouts utilisateur pour un mois */
function monthWithOpsFor(year, mk){
  const month = monthByKeyFor(year, mk);
  const ops = commonOps(opsOfYear(year, mk));
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
function monthWithOps(mk){ return monthWithOpsFor(state.year, mk); }

/* Cartographie catégorie -> total (compte commun : base + ajouts) pour un mois */
function catTotalsMkFor(year, mk){
  const {month, depOps} = monthWithOpsFor(year, mk);
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
function catTotalsMk(mk){ return catTotalsMkFor(state.year, mk); }

/* Dépenses du Livret par catégorie (relevés + saisies) */
function livretExpenseMap(year, mk, externalOnly){
  const map = {};
  epargneOps(year, mk).forEach(o=>{
    if(o.type!=='depense') return;
    if(externalOnly && isInterne(o)) return;
    const k = norm(o.cat);
    const amt = o.montant || o.amount || 0;
    if(!map[k]) map[k] = {total:0,label:o.cat,items:[]};
    map[k].total = addAmounts(map[k].total, amt);
    map[k].items.push({
      nom: [o.date, o.label].filter(Boolean).join(' · '),
      montant: fmt(amt) + ' €',
    });
  });
  return map;
}
/* Fusion de deux cartographies catégorie -> total */
function mergeCatMaps(a, b){
  const map = {};
  [a, b].forEach(src=>{
    Object.keys(src||{}).forEach(k=>{
      const it = src[k];
      if(!map[k]) map[k] = {total:0,label:it.label,items:[],userOps:[]};
      map[k].total = addAmounts(map[k].total, it.total);
      map[k].items = (map[k].items||[]).concat(it.items||[]);
      map[k].userOps = (map[k].userOps||[]).concat(it.userOps||[]);
    });
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
function epargneExternalTotals(year){
  let rev = 0, dep = 0;
  MONTHS.forEach(mk=>{
    epargneOps(year, mk).forEach(o=>{
      if(isInterne(o)) return;
      const amt = o.montant || o.amount || 0;
      if(o.type==='revenu') rev = addAmounts(rev, amt);
      else if(o.type==='depense') dep = addAmounts(dep, amt);
    });
  });
  return {rev, dep};
}
function livretLastBalance(year){
  let val = null, mk = null;
  MONTHS.forEach(m=>{ const lm = livretMonth(year, m); if(lm.soldeCompte!=null){ val = lm.soldeCompte; mk = m; } });
  return {value:val, month:mk};
}
/* Dernier solde connu du Livret jusqu'au mois demandé inclus */
function livretBalanceUpTo(year, mk){
  let out = null;
  MONTHS.slice(0, MONTHS.indexOf(mk)+1).forEach(m=>{
    const lm = livretMonth(year, m);
    if(lm.soldeCompte!=null) out = {value:lm.soldeCompte, month:m};
  });
  return out;
}
function yearlyTotals(){
  const tot = {rev:0,dep:0};
  BASE.forEach(m=>{ tot.rev+=baseRevTotal(m); tot.dep+=baseDepTotal(m); });
  // ajouts du compte commun
  MONTHS.forEach(mk => { const w = monthWithOps(mk); tot.rev=addAmounts(tot.rev,w.revAdd); tot.dep=addAmounts(tot.dep,w.depAdd); });
  // mouvements réels du Livret (hors virements entre comptes)
  const ep = epargneExternalTotals(state.year);
  tot.rev = addAmounts(tot.rev, ep.rev);
  tot.dep = addAmounts(tot.dep, ep.dep);
  return tot;
}
function renderOverview(){
  const tot = yearlyTotals();
  const balance = Math.round((tot.rev-tot.dep)*100)/100;
  const joined = MONTHS.reduce((s,mk)=>s+opsOf(mk).length,0);
  const lastLivret = livretLastBalance(state.year);
  const kpis = [
    {cls:'blue', label:'Revenus '+state.year, val:cmoney(tot.rev), sub:'Total entrées (commun + Livret)'},
    {cls:'red',  label:'Dépenses '+state.year, val:cmoney(tot.dep), sub:'Total sorties (commun + Livret)'},
    {cls: balance<0?'red':'green', label:'Solde '+state.year, val:cmoney(balance), sub:'Revenus − dépenses'},
    {cls:'green', label:'Solde Livret', val: lastLivret.value==null?'—':cmoney(lastLivret.value),
      sub: lastLivret.month ? 'Livret Bourso+ · fin '+MONTHS_FR[MONTHS.indexOf(lastLivret.month)] : 'Livret Bourso+ · aucun relevé'},
    {cls:'violet', label:'Ajouts manuels', val:String(joined), sub:'opérations saisies'},
  ];
  document.getElementById('kpis').innerHTML = kpis.map(k=>`
    <div class="kpi ${k.cls}"><div class="label">${k.label}</div>
    <div class="val ${k.cls==='red'?'neg':k.cls==='green'?'pos':''}">${k.val}</div>
    <div class="sub">${k.sub}</div></div>`).join('');

  const months = MONTHS.map(mk=>monthTotalsFor(state.year, mk));
  drawBarChart('chartRevDep', { labels:MONTHS_FR.map(m=>m.slice(0,3)), series:[
      {name:'Revenus', color:'#22c55e', values:months.map(x=>x.rev)},
      {name:'Dépenses', color:'#ef4444', values:months.map(x=>x.dep)},
  ]});

  // donut dépenses annuelles par catégorie (commun + Livret, hors virements internes)
  const catTot = catTotalsFor(state.year, MONTHS.slice());
  const entries = Object.entries(catTot).map(([k,v])=>({k,v:v.total})).filter(e=>e.v>0).sort((a,b)=>b.v-a.v);
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

  const acc = state.account || 'commun';
  const common = monthWithOps(mk);
  const livret = livretMonth(state.year, mk);
  const ext = epargneOps(state.year, mk).filter(o=>!isInterne(o));
  const extRev = ext.filter(o=>o.type==='revenu').reduce((s,o)=>s+(o.montant||o.amount||0),0);
  const extDep = ext.filter(o=>o.type==='depense').reduce((s,o)=>s+(o.montant||o.amount||0),0);
  const soldeUpTo = livretBalanceUpTo(state.year, mk);
  const soldeTxt = soldeUpTo ? cmoney(soldeUpTo.value) : '—';
  const soldeSub = soldeUpTo
    ? (soldeUpTo.month===mk ? 'fin de mois' : 'dernier relevé · fin '+MONTHS_FR[MONTHS.indexOf(soldeUpTo.month)])
    : 'aucun relevé';

  let kpis, note;
  if(acc==='livret'){
    kpis = [
      {cls:'green', label:'Entrées', val:cmoney(livret.revTotal), sub:'tous les crédits du Livret'},
      {cls:'red',   label:'Sorties', val:cmoney(livret.depTotal), sub:'tous les débits du Livret'},
      {cls: livret.somme<0?'red':'green', label:'Variation du mois', val:cmoney(livret.somme), sub:'entrées − sorties'},
      {cls:'violet', label:'Solde du Livret', val:soldeTxt, sub:soldeSub},
    ];
    if(livret.month.soldeDebut!=null){
      note = "Vue du Livret Bourso+ : les virements entre comptes figurent dans les entrées/sorties du compte, mais sont exclus du budget du foyer.";
    } else if(epargneMonths(state.year).some(m=>m.soldeDebut!=null)){
      note = "Aucun relevé du Livret pour ce mois : les mouvements saisis à la main restent visibles, et le solde affiché est celui du dernier relevé importé.";
    } else {
      note = "Aucun relevé du Livret Bourso+ n'est importé pour cette année.";
    }
  } else if(acc==='tous'){
    const rev = addAmounts(common.revTotal, extRev);
    const dep = addAmounts(common.depTotal, extDep);
    kpis = [
      {cls:'blue',  label:'Revenus', val:cmoney(rev), sub:'commun + Livret, hors virements internes'},
      {cls:'red',   label:'Dépenses', val:cmoney(dep), sub:'commun + Livret, hors virements internes'},
      {cls: (rev-dep)<0?'red':'green', label:'Solde du mois', val:cmoney(addAmounts(rev,-dep)), sub:'revenus − dépenses'},
      {cls:'violet', label:'Solde du Livret', val:soldeTxt, sub:soldeSub},
    ];
    note = "Vue consolidée : compte commun + Livret Bourso+. Les virements entre vos comptes sont exclus pour éviter les doubles comptages.";
  } else {
    kpis = [
      {cls:'blue', label:'Revenus', val:cmoney(common.revTotal), sub:common.revAdd?'dont +'+cmoney(common.revAdd)+' (ajouts)':'représentation mensuelle'},
      {cls:'red',  label:'Dépenses', val:cmoney(common.depTotal), sub:common.depAdd?'dont +'+cmoney(common.depAdd)+' (ajouts)':''},
      {cls: common.somme<0?'red':'green', label:'Somme restante', val:cmoney(common.somme), sub:'solde du mois'},
      {cls:'violet', label:'Solde du Livret', val:soldeTxt, sub:'Livret Bourso+ · '+soldeSub},
    ];
    note = "Vue du compte commun uniquement. Choisissez « Livret Bourso+ » ou « Tous les comptes » pour changer de périmètre.";
  }

  document.getElementById('monthKpis').innerHTML = kpis.map(k=>`
    <div class="kpi ${k.cls}"><div class="label">${k.label}</div>
    <div class="val ${k.cls==='red'?'neg':k.cls==='green'?'pos':''}">${k.val}</div>
    <div class="sub">${k.sub}</div></div>`).join('');
  const noteEl = document.getElementById('monthAccountNote');
  if(noteEl) noteEl.textContent = note;

  // Revenus (accordéon + couleurs, comme les dépenses)
  if(acc==='livret'){
    renderRevenueGroups(livretRevenueGroups(state.year, mk, false));
  } else if(acc==='tous'){
    renderRevenueGroups(mergeRevenueGroups(
      commonRevenueGroups(state.year, mk),
      livretRevenueGroups(state.year, mk, true)
    ));
  } else {
    renderRevenues(mk);
  }

  // Dépenses par catégorie
  renderExpenseMap(expenseMapFor(acc, mk));
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

/* Revenus du compte commun groupés par source */
function commonRevenueGroups(year, mk){
  const w = monthWithOpsFor(year, mk);
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
  return Object.values(map).sort((a,b)=>b.total-a.total);
}

/* Revenus du Livret (relevés + saisies) groupés par catégorie */
function livretRevenueGroups(year, mk, externalOnly){
  const map = {};
  epargneOps(year, mk).forEach(o=>{
    if(o.type!=='revenu') return;
    if(externalOnly && isInterne(o)) return;
    const k = norm(o.cat);
    const amt = o.montant || o.amount || 0;
    if(!map[k]) map[k] = {label:o.cat, items:[], total:0};
    map[k].total = addAmounts(map[k].total, amt);
    map[k].items.push({detail:[o.date,o.label].filter(Boolean).join(' · '), amount:amt});
  });
  return Object.values(map).sort((a,b)=>b.total-a.total);
}

/* Fusion de groupes de revenus (même libellé) */
function mergeRevenueGroups(a, b){
  const map = {};
  [...a, ...b].forEach(g=>{
    const k = norm(g.label);
    if(!map[k]) map[k] = {label:g.label, items:[], user:[], total:0};
    map[k].total = addAmounts(map[k].total, g.total);
    map[k].items = (map[k].items||[]).concat(g.items||[]);
    map[k].user = (map[k].user||[]).concat(g.user||[]);
  });
  return Object.values(map).sort((x,y)=>y.total-x.total);
}

function renderRevenueGroups(groups){
  const box = document.getElementById('revenueList');
  if(!groups.length){ box.innerHTML = '<div class="muted" style="font-size:13px">Aucun revenu ce mois-ci.</div>'; return; }
  box.innerHTML = groups.map(c=>{
    const col = revColor(c.label);
    const items = (c.items||[]).map(r=>`
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

/* Cartographie des dépenses selon le compte affiché */
function expenseMapFor(acc, mk){
  if(acc==='livret') return livretExpenseMap(state.year, mk, false);
  if(acc==='tous') return mergeCatMaps(catTotalsMk(mk), livretExpenseMap(state.year, mk, true));
  return catTotalsMk(mk);
}

/* Revenus du mois du compte commun */
function renderRevenues(mk){ renderRevenueGroups(commonRevenueGroups(state.year, mk)); }

function renderExpenseMap(map){
  const box = document.getElementById('expenseList');
  const sorted = Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
  if(!sorted.length){ box.innerHTML = '<div class="muted" style="font-size:13px">Aucune dépense ce mois-ci.</div>'; return; }
  box.innerHTML = sorted.map(([k,c])=>{
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
function renderExpenses(mk){ renderExpenseMap(catTotalsMk(mk)); }

function renderUserOps(mk){
  const arr = opsOf(mk);
  const acc = state.account || 'commun';
  const list = arr.map((o,i)=>({o,i})).filter(({o}) => acc==='tous' || (o.compte||'commun')===acc);
  const box = document.getElementById('userOps');
  if(!list.length){ box.innerHTML = '<div class="muted" style="font-size:13px">Aucune opération ajoutée.</div>'; return; }
  box.innerHTML = `<div class="list">` + list.map(({o,i})=>{
    const isRev = o.type==='revenu';
    const ck = o.compte || 'commun';
    const tag = acc==='tous' ? `<span class="account-tag ${ck==='livret'?'livret':''}">${ck==='livret'?'Livret':'Commun'}</span>` : '';
    return `<div class="row">
      <div class="nam"><span class="bar-label">${e(o.cat)} <span class="tag ${isRev?'ok':'over'}" style="font-size:10px">${isRev?'+':'− '}</span>${tag}</span><span class="lbl">${e((o.sub?o.label+' · '+o.sub:(o.label))||'')}</span></div>
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

/* ============ BUDGET ============
   La page Budget est calculée AUTOMATIQUEMENT à partir de vos dépenses
   réelles (données de base + vos ajouts manuels, toutes années).
   Référence par catégorie : moyenne mensuelle des dépenses réelles,
   calculée sur les MOIS RÉELLEMENT RENSEIGNÉS (et non sur 12 mois).
   · Si une année antérieure renseignée existe : la référence = sa moyenne
     mensuelle réelle.
   · Sinon : la référence = moyenne réelle de l'année sélectionnée (on se cale
     sur sa propre consommation) — elle devient plus parlante dès qu'une année
     antérieure existe (créez 2027, qui servira de référence pour 2028, etc.).
   L'affichage porte toujours sur l'année sélectionnée (boutons ‹ ›). */

/* Mois réellement renseignés d'une année (au moins un revenu ou une dépense) */
function activeMonthsFor(year){
  return MONTHS.filter(mk=>{
    const t = monthTotalsFor(year, mk);
    return t.rev>0 || t.dep>0;
  });
}

/* Dernière année strictement antérieure à `year` qui contient des données */
function prevYearWithData(year){
  const ys = baseYears().filter(y=>y<year).sort((a,b)=>b-a);
  for(const y of ys){ if(activeMonthsFor(y).length) return y; }
  return null;
}

/* Totaux dépenses par catégorie (commun + Livret, hors virements internes) */
function catTotalsFor(year, monthNames){
  const monthsArr = yearMonths(year);
  const opsMap = userOps[String(year)] || {};
  const map = {};
  monthNames.forEach(mk=>{
    const month = monthsArr.find(m=>m.mois===mk) || emptyMonth(mk);
    (month.depenses||[]).forEach(c=>{
      const k = norm(c.categorie); if(!map[k]) map[k]={total:0,label:c.categorie};
      map[k].total = addAmounts(map[k].total, parseAmount(c.total));
    });
    (opsMap[mk]||[]).forEach(o=>{
      if(o.type!=='depense') return;
      if((o.compte||'commun')!=='commun') return;
      const k = norm(o.cat); if(!map[k]) map[k]={total:0,label:o.cat};
      map[k].total = addAmounts(map[k].total, o.amount);
    });
    epargneOps(year, mk).forEach(o=>{
      if(o.type!=='depense' || isInterne(o)) return;
      const amt = o.montant || o.amount || 0;
      const k = norm(o.cat); if(!map[k]) map[k]={total:0,label:o.cat};
      map[k].total = addAmounts(map[k].total, amt);
    });
  });
  return map;
}

/* Total dépenses (commun + Livret, hors virements internes) */
function depTotalFor(year, monthNames){
  const monthsArr = yearMonths(year);
  const opsMap = userOps[String(year)] || {};
  let t=0;
  monthNames.forEach(mk=>{
    const month = monthsArr.find(m=>m.mois===mk) || emptyMonth(mk);
    t = addAmounts(t, baseDepTotal(month));
    (opsMap[mk]||[]).forEach(o=>{
      if(o.type!=='depense' || (o.compte||'commun')!=='commun') return;
      t=addAmounts(t,o.amount);
    });
    epargneOps(year, mk).forEach(o=>{
      if(o.type!=='depense' || isInterne(o)) return;
      t = addAmounts(t, o.montant || o.amount || 0);
    });
  });
  return t;
}

/* Référence de budget (moyenne mensuelle par catégorie) pour l'année affichée.
   nRef = nombre de mois renseignés de l'année de référence. */
function budgetReference(){
  const year = state.year;
  const refYear = prevYearWithData(year) || year;
  const usePrev = refYear !== year;
  const nAct = activeMonthsFor(refYear).length;
  return { year, refYear, usePrev, nAct,
           refByCat: catTotalsFor(refYear, MONTHS.slice()),
           nRef: nAct || 12 };
}

function renderBudget(){
  const year = state.year;
  const { refByCat, refYear, usePrev, nRef, nAct: refAct } = budgetReference();
  const curAct = activeMonthsFor(year);                // mois renseignés de l'année affichée
  const curByCat = catTotalsFor(year, MONTHS.slice());  // réel de l'année affichée
  const nCur = curAct.length || 12;

  // Union des catégories (catégories connues + présentes dans les données)
  const seen = {}; const keys = [];
  CATS.forEach(c=>{ const k=norm(c.key); if(!seen[k]){ seen[k]=1; keys.push(k); } });
  [...Object.keys(refByCat), ...Object.keys(curByCat)].forEach(k=>{ if(!seen[k]){ seen[k]=1; keys.push(k); } });

  let totalRef=0, totalCur=0;
  const rows = keys.map(nk=>{
    const label = (refByCat[nk]&&refByCat[nk].label) || (curByCat[nk]&&curByCat[nk].label) || catMeta(nk).label;
    const refM = (refByCat[nk]?refByCat[nk].total:0)/nRef;
    const curM = (curByCat[nk]?curByCat[nk].total:0)/nCur;
    totalRef = addAmounts(totalRef, refM);
    totalCur = addAmounts(totalCur, curM);
    return { label, refM, curM, ecart: curM-refM };
  }).sort((a,b)=>b.curM-a.curM);

  const ecartTotal = totalCur - totalRef;
  const projected = totalCur * 12;

  const note = document.getElementById('budgetNote');
  const refTxt = refAct ? `moyenne des ${refAct} mois renseignés de ${refYear}` : `aucune donnée sur ${refYear}`;
  const scopeTxt = `compte commun + Livret Bourso+, hors virements entre comptes`;
  if(note) note.textContent = usePrev
    ? `Budget calculé automatiquement d'après votre consommation réelle (${scopeTxt}). La colonne « Budget » = ${refTxt} ; « Réel » = moyenne des ${curAct.length} mois renseignés de ${year}.`
    : `Budget calculé automatiquement d'après votre consommation réelle (${scopeTxt}) : ${refTxt}. Il gagnera en pertinence dès qu'une année antérieure existera (créez 2027 avec ‹ › : elle servira de référence pour les années suivantes).`;

  const kpis = [
    {cls:'blue',  label:'Budget de référence / mois', val:cmoney(totalRef),  sub:'moyenne réelle '+refYear+' · '+refAct+' mois'},
    {cls:'red',   label:'Dépense moyenne / mois',     val:cmoney(totalCur),  sub:'somme des catégories · '+curAct.length+' mois renseignés'},
    {cls: ecartTotal<=0?'green':'red', label: ecartTotal<=0?'Sous budget':'Dépassement', val:(ecartTotal<=0?'':'+')+fmt(ecartTotal)+' €', sub:'réel − budget (par mois)'},
    {cls:'violet',label:'Dépense projetée (×12)',     val:cmoney(projected), sub:'si la moyenne se maintient'},
  ];
  document.getElementById('budgetKpis').innerHTML = kpis.map(k=>`
    <div class="kpi ${k.cls}"><div class="label">${k.label}</div>
    <div class="val ${k.cls==='red'?'neg':k.cls==='green'?'pos':''}">${k.val}</div>
    <div class="sub">${k.sub}</div></div>`).join('');

  document.querySelector('#budgetTable tbody').innerHTML = rows.map(r=>{
    const status = r.ecart<=0 ? `<span class="tag ok">OK</span>` : `<span class="tag over">+${fmt(r.ecart)} €</span>`;
    return `<tr>
      <td>${e(r.label)}</td>
      <td class="money">${cmoney(r.refM)}</td>
      <td class="money">${cmoney(r.curM)}</td>
      <td class="money ${r.ecart<=0?'pos':'neg'}">${r.ecart<=0?fmt(r.ecart):'+'+fmt(r.ecart)} €</td>
      <td>${status}</td>
    </tr>`;
  }).join('');

  renderBudgetMonth();
}

/* Suivi du MOIS EN COURS : budget mensuel vs ce qui est déjà dépensé ce mois-ci */
function renderBudgetMonth(){
  const year = state.year;
  const { refByCat, refYear, usePrev, nRef, nAct: refAct } = budgetReference();
  const mk = MONTHS[state.month];
  const title = MONTHS_FR[state.month] + ' ' + year;
  const elTitle = document.getElementById('budgetMonthTitle');
  if(elTitle) elTitle.textContent = title;

  const curByCat = catTotalsFor(year, [mk]);   // dépensé ce mois (base + ajouts)

  // Union des catégories
  const seen = {}; const keys = [];
  CATS.forEach(c=>{ const k=norm(c.key); if(!seen[k]){ seen[k]=1; keys.push(k); } });
  [...Object.keys(refByCat), ...Object.keys(curByCat)].forEach(k=>{ if(!seen[k]){ seen[k]=1; keys.push(k); } });

  let budgetM=0, spentM=0;
  const rows = keys.map(nk=>{
    const refM = (refByCat[nk]?refByCat[nk].total:0)/nRef;     // budget mensuel de la catégorie
    const spent = curByCat[nk]?curByCat[nk].total:0;            // dépensé ce mois
    budgetM = addAmounts(budgetM, refM);
    spentM = addAmounts(spentM, spent);
    const rest = refM - spent;
    const pct = refM>0 ? Math.round(spent/refM*100) : (spent>0?100:0);
    const label = (refByCat[nk]&&refByCat[nk].label) || (curByCat[nk]&&curByCat[nk].label) || catMeta(nk).label;
    return { label, refM, spent, rest, pct };
  }).sort((a,b)=>b.spent-a.spent);

  const totalPct = budgetM>0 ? Math.round(spentM/budgetM*100) : (spentM>0?100:0);
  const restTotal = budgetM - spentM;

  const note = document.getElementById('budgetMonthNote');
  if(note) note.textContent = refAct
    ? `Votre budget mensuel de référence (moyenne des ${refAct} mois renseignés de ${refYear}) comparé à ce que vous avez dépensé en ${MONTHS_FR[state.month]} ${year}, Livret Bourso+ inclus et virements entre comptes exclus.`
    : `Aucune donnée de référence sur ${refYear} : ajoutez des dépenses pour voir apparaître votre budget mensuel.`;

  const kpis = [
    {cls:'blue', label:'Budget du mois', val:cmoney(budgetM), sub:'référence mensuelle'},
    {cls:'red',  label:'Dépensé ce mois', val:cmoney(spentM), sub:title+', ajouts inclus'},
    {cls: restTotal>=0?'green':'red', label: restTotal>=0?'Reste à dépenser':'Dépassement', val:fmt(Math.abs(restTotal))+' €', sub: restTotal>=0?'sur ce mois':'au-delà du budget'},
    {cls: totalPct<=100?'violet':'red', label:'Budget consommé', val:totalPct+' %', sub: totalPct<=100?'il reste '+fmt(budgetM-spentM)+' €':'objectif dépassé'},
  ];
  document.getElementById('budgetMonthKpis').innerHTML = kpis.map(k=>`
    <div class="kpi ${k.cls}"><div class="label">${k.label}</div>
    <div class="val ${k.cls==='red'?'neg':k.cls==='green'?'pos':''}">${k.val}</div>
    <div class="sub">${k.sub}</div></div>`).join('');

  document.querySelector('#budgetMonthTable tbody').innerHTML = rows.map(r=>{
    const over = r.spent>r.refM;
    const color = r.pct>100 ? '#ef4444' : (r.pct>=85 ? '#f59e0b' : '#22c55e');
    const status = over ? `<span class="tag over">+${fmt(r.spent-r.refM)} €</span>` : `<span class="tag ok">Reste ${fmt(r.refM-r.spent)} €</span>`;
    return `<tr>
      <td>${e(r.label)}</td>
      <td class="money">${cmoney(r.refM)}</td>
      <td class="money ${over?'neg':''}">${cmoney(r.spent)}</td>
      <td class="money ${over?'neg':'pos'}">${over?'+'+fmt(r.spent-r.refM):fmt(r.refM-r.spent)} €</td>
      <td>
        <div class="bar-wrap" style="min-width:90px;background:#222b3a;border-radius:8px;height:14px;overflow:hidden;display:inline-block;vertical-align:middle">
          <div class="bar" style="width:${Math.min(100,r.pct)}%;background:${color};height:100%;border-radius:8px;transition:width .4s"></div>
        </div>
        <span class="pct muted" style="font-size:11px;margin-left:6px">${r.pct}%</span>
      </td>
      <td>${status}</td>
    </tr>`;
  }).join('');
}

/* ============================================================
   GRAPHIQUES — tableau de bord analytique
   Choix retenus d'après les logiciels de gestion de budget
   (Monarch Money, YNAB, Copilot, BudgetLabs…) :
     · Sankey de flux        → « où va l'argent » (Monarch)
     · Tendance + moy. mobile→ trajectoire réelle (Copilot)
     · Épargne cumulée       → trajectoire d'épargne (net worth)
     · Ce mois vs moyenne    → écarts / dérapages (anomalies)
     · Treemap               → poids des postes (Monarch)
     · Heatmap               → saisonnalité (BudgetLabs, Finny)
   ============================================================ */

/* Regroupement des catégories pour le Sankey et le treemap */
const CHART_GROUPS = [
  {label:'Logement',                 color:'#38bdf8', keys:['logement']},
  {label:'Vie quotidienne',           color:'#facc15', keys:['vie quotidienne']},
  {label:'Auto & transport',          color:'#a78bfa', keys:['auto moto','voyage et transport']},
  {label:'Santé',                     color:'#e879f9', keys:['santé']},
  {label:'Abonnements',               color:'#4f9cf9', keys:['abonnement et téléphonie']},
  {label:'Loisirs, cadeaux & famille',color:'#fb7185', keys:['loisir','cadeaux et solidarité','education et famille']},
  {label:'Impôts & frais bancaires',  color:'#ef4444', keys:['impots et taxe','Opération banquaire']},
  {label:'Virements internes',        color:'#2dd4bf', keys:['mouvement interne débiteur']},
];

/* Totaux (commun + Livret hors virements internes) d'un mois, pour une année donnée */
function monthTotalsFor(year, mk){
  const m = yearMonths(year).find(x=>x.mois===mk) || emptyMonth(mk);
  const ops = commonOps((userOps[String(year)]||{})[mk] || []);
  let rev = baseRevTotal(m), dep = baseDepTotal(m);
  ops.forEach(o=>{
    if(o.type==='revenu') rev = addAmounts(rev, o.amount);
    else if(o.type==='depense') dep = addAmounts(dep, o.amount);
  });
  epargneOps(year, mk).forEach(o=>{
    if(isInterne(o)) return;
    const amt = o.montant || o.amount || 0;
    if(o.type==='revenu') rev = addAmounts(rev, amt);
    else if(o.type==='depense') dep = addAmounts(dep, amt);
  });
  return {rev, dep, solde:addAmounts(rev, -dep)};
}

/* Matrice catégorie × mois : { clé: { label, color, values[12], total } } */
function catMonthly(year){
  const per = {};
  MONTHS.forEach((mk,i)=>{
    const map = catTotalsFor(year, [mk]);
    Object.keys(map).forEach(k=>{
      const label = map[k].label;
      if(!per[k]) per[k] = { label, color:catMeta(label).color, values:new Array(12).fill(0), total:0 };
      per[k].values[i] = map[k].total;
      per[k].total = addAmounts(per[k].total, map[k].total);
    });
  });
  return per;
}

/* Sources de revenus d'un mois (commun + Livret, hors virements internes) */
function revenueSourcesFor(mk){
  const w = monthWithOps(mk);
  const map = {};
  (w.month.revenus||[]).forEach(r=>{
    const k = norm(r.nom);
    if(!map[k]) map[k] = {label:r.nom, total:0};
    map[k].total = addAmounts(map[k].total, parseAmount(r.montant));
  });
  w.revOps.forEach(o=>{
    const k = norm(o.cat);
    if(!map[k]) map[k] = {label:o.cat, total:0};
    map[k].total = addAmounts(map[k].total, o.amount);
  });
  epargneOps(state.year, mk).forEach(o=>{
    if(o.type!=='revenu' || isInterne(o)) return;
    const amt = o.montant || o.amount || 0;
    const k = norm(o.cat);
    if(!map[k]) map[k] = {label:o.cat, total:0};
    map[k].total = addAmounts(map[k].total, amt);
  });
  return Object.values(map).filter(x=>x.total>0).sort((a,b)=>b.total-a.total);
}

function kpiCards(items){
  return items.map(k=>`
    <div class="kpi ${k.cls}"><div class="label">${k.label}</div>
    <div class="val ${k.cls==='red'?'neg':k.cls==='green'?'pos':''}" style="${k.small?'font-size:18px':''}">${k.val}</div>
    <div class="sub">${k.sub}</div></div>`).join('');
}

function renderCharts(){
  const year = state.year;
  const mk = MONTHS[state.month];
  const t = document.getElementById('chartMonthTitle');
  if(t) t.textContent = MONTHS_FR[state.month] + ' ' + year;

  const per = catMonthly(year);
  const months = MONTHS.map(m=>monthTotalsFor(year, m));
  const act = activeMonthsFor(year);
  const nAct = act.length || 1;
  const depYear = months.reduce((s,x)=>s+x.dep, 0);
  const revYear = months.reduce((s,x)=>s+x.rev, 0);
  const list = Object.values(per).sort((a,b)=>b.total-a.total);
  const top = list[0];
  const rate = revYear>0 ? (revYear-depYear)/revYear*100 : 0;

  document.getElementById('chartKpis').innerHTML = kpiCards([
    {cls:'red',  label:'Dépenses '+year,   val:cmoney(depYear), sub:act.length+' mois renseignés'},
    {cls:'blue', label:'Moyenne par mois', val:cmoney(depYear/nAct), sub:'sur les mois renseignés'},
    {cls: rate<0?'red':(rate<10?'warn':'green'), label:"Taux d'épargne", val:fmt(rate,1)+' %', sub:'revenus − dépenses'},
    {cls:'violet', label:'Poste n°1', val:top?top.label:'—',
      sub: top ? cmoney(top.total)+' · '+Math.round(top.total/(depYear||1)*100)+' % du total' : 'aucune donnée', small:true},
  ]);

  renderSankey(mk);
  renderTrend(months, act);
  renderSavings();
  renderVsAvg(per, act, mk);
  renderTreemap(list, depYear);
  renderHeat(list);
}

/* ---------- 1. Sankey : où va votre argent ? ---------- */
function renderSankey(mk){
  const box = document.getElementById('chartSankey');
  if(!box) return;

  const map = mergeCatMaps(catTotalsMk(mk), livretExpenseMap(state.year, mk, true));
  const groups = CHART_GROUPS.map(g=>({label:g.label, color:g.color, keys:g.keys.map(norm), total:0}));
  const catchAll = {label:'Autres', color:'#94a3b8', keys:[], total:0};
  Object.keys(map).forEach(k=>{
    const v = map[k].total;
    if(!(v>0)) return;
    const g = groups.find(gr=>gr.keys.includes(k));
    if(g) g.total = addAmounts(g.total, v);
    else catchAll.total = addAmounts(catchAll.total, v);
  });
  const outs = groups.filter(g=>g.total>0).map(g=>({label:g.label, color:g.color, v:g.total}));
  if(catchAll.total>0) outs.push({label:catchAll.label, color:catchAll.color, v:catchAll.total});

  const ins = revenueSourcesFor(mk).map(s=>({label:s.label, color:revColor(s.label), v:s.total}));

  const sumIn = ins.reduce((s,n)=>s+n.v, 0);
  const sumOut = outs.reduce((s,n)=>s+n.v, 0);
  const solde = Math.round((sumIn-sumOut)*100)/100;

  if(solde>0) outs.push({label:'Épargne du mois', color:'#22c55e', v:solde});
  if(solde<0) ins.push({label:'Épargne mobilisée', color:'#ef4444', v:-solde});

  const note = document.getElementById('sankeyNote');
  if(note) note.textContent = MONTHS_FR[state.month]+' '+state.year+' : '
    + ins.length + ' entrée'+(ins.length>1?'s':'') + ' → ' + outs.length + ' poste'+(outs.length>1?'s':'')
    + '. L\'épaisseur des rubans est proportionnelle aux montants ; les virements internes sont isolés.';

  drawSankey('chartSankey', ins, outs);
}

/* ---------- 2. Tendance + moyenne mobile ---------- */
function renderTrend(months, act){
  const dep = MONTHS.map((m,i)=> act.includes(m) ? months[i].dep : null);
  const rev = MONTHS.map((m,i)=> act.includes(m) ? months[i].rev : null);
  const ma  = MONTHS.map((m)=>{
    if(!act.includes(m)) return null;
    const i = act.indexOf(m);
    const win = act.slice(Math.max(0, i-2), i+1).map(x=>months[MONTHS.indexOf(x)].dep);
    return win.reduce((s,v)=>s+v,0)/win.length;
  });
  drawLineChart('chartTrend', {
    labels: MONTHS_SHORT,
    series:[
      {name:'Dépenses',       color:'#ef4444', values:dep, fill:true},
      {name:'Moyenne 3 mois', color:'#4f9cf9', values:ma,  width:2.4},
      {name:'Revenus',        color:'#22c55e', values:rev, dashed:true, width:1.6},
    ]
  });
}

/* ---------- 3. Épargne cumulée + solde réel du Livret ---------- */
function renderSavings(){
  let acc = 0, started = false;
  const cum = [], solde = [];
  MONTHS.forEach(mk=>{
    const t = monthTotalsFor(state.year, mk);
    if(!started && t.rev===0 && t.dep===0){
      cum.push(null);
    } else {
      started = true;
      acc = addAmounts(acc, t.solde);
      cum.push(acc);
    }
    solde.push(livretMonth(state.year, mk).soldeCompte);
  });

  const all = cum.concat(solde).filter(v=>v!=null);
  const hasNeg = all.some(v=>v<0);
  const series = [
    {name:'Cumul du foyer', color:'#4f9cf9', values:cum, signed:true, width:2.6, lastLabel:true},
  ];
  if(solde.some(v=>v!=null)){
    series.push({name:'Solde du Livret', color:'#22c55e', values:solde, width:2.4, lastLabel:true});
  }
  drawLineChart('chartSavings', { labels: MONTHS_SHORT, signed:hasNeg, series });
}

/* ---------- 4. Ce mois vs la moyenne des autres mois ---------- */
function renderVsAvg(per, act, mk){
  const box = document.getElementById('chartVsAvg');
  const title = document.getElementById('vsAvgTitle');
  const note = document.getElementById('vsAvgNote');
  const label = MONTHS_FR[state.month] + ' ' + state.year;
  if(title) title.textContent = label + ' vs votre moyenne';

  const others = act.filter(m=>m!==mk);
  if(others.length<1){
    box.innerHTML = '<div class="muted" style="font-size:13px">Pas encore assez de mois renseignés pour établir une moyenne.</div>';
    if(note) note.textContent = '';
    return;
  }
  const idx = MONTHS.indexOf(mk);
  const rows = Object.keys(per).map(k=>{
    const it = per[k];
    const spent = it.values[idx];
    const avg = others.reduce((s,m)=>s+it.values[MONTHS.indexOf(m)],0)/others.length;
    return {label:it.label, color:it.color, spent, avg, diff:spent-avg,
            pct: avg>0 ? (spent-avg)/avg*100 : null};
  }).filter(r=> Math.abs(r.diff)>=0.5 && (r.spent>0 || r.avg>0))
    .sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff)).slice(0,10);

  if(!rows.length){
    box.innerHTML = '<div class="muted" style="font-size:13px">Aucune variation notable ce mois-ci.</div>';
    if(note) note.textContent = '';
    return;
  }
  const max = Math.max.apply(null, rows.map(r=>Math.abs(r.diff))) || 1;
  box.innerHTML = rows.map(r=>{
    const w = Math.abs(r.diff)/max*50;
    const pos = r.diff>=0;
    const style = pos ? `left:50%;width:${w}%` : `left:${50-w}%;width:${w}%`;
    const pct = r.pct===null ? 'nouveau' : (r.pct>=0?'+':'')+Math.round(r.pct)+' %';
    return `<div class="diff">
      <span class="diff-label"><i style="background:${r.color}"></i>${e(r.label)}</span>
      <div class="diff-track"><span class="diff-mid"></span><span class="diff-bar ${pos?'pos':'neg'}" style="${style}"></span></div>
      <span class="diff-val ${pos?'neg':'pos'}">${pos?'+':''}${fmt(r.diff,0)} €</span>
      <span class="diff-pct muted">${pct}</span>
    </div>`;
  }).join('');
  if(note) note.textContent = `Écart entre ${label} et la moyenne de vos ${others.length} autres mois renseignés. `
    + `Rouge = plus que d'habitude, vert = moins. Dépensé ce mois : ${cmoney(rows.reduce((s,r)=>s+r.spent,0))} sur les postes affichés.`;
}

/* ---------- 5. Treemap ---------- */
function renderTreemap(list, total){
  const items = []; let other = 0;
  list.forEach(it=>{
    if(!(it.total>0)) return;
    if(it.total/(total||1) < 0.015) other = addAmounts(other, it.total);
    else items.push({label:it.label, color:it.color, v:it.total});
  });
  if(other>0) items.push({label:'Autres', color:'#64748b', v:other});
  drawTreemap('chartTreemap', items);
}

/* ---------- 6. Heatmap saisonnalité ---------- */
function renderHeat(list){
  const box = document.getElementById('chartHeat');
  if(!box) return;
  const items = list.filter(it=>it.total>0).slice(0,10);
  if(!items.length){ box.innerHTML = '<div class="muted" style="font-size:13px">Aucune donnée.</div>'; return; }
  let html = '<div class="heat-row heat-head"><span class="heat-label"></span>'
    + MONTHS_FR.map(m=>`<span>${m[0]}</span>`).join('')
    + '<span class="heat-total"></span></div>';
  items.forEach(it=>{
    const max = Math.max.apply(null, it.values.concat([1]));
    html += `<div class="heat-row"><span class="heat-label" title="${e(it.label)}">${e(it.label)}</span>`;
    it.values.forEach((v,i)=>{
      const bg = v>0 ? hexA(it.color, 0.10 + (v/max)*0.78) : 'transparent';
      const txt = v>=1000 ? (v/1000).toFixed(1).replace('.',',')+'k' : (v>0?String(Math.round(v)):'');
      html += `<span class="heat-cell" style="background:${bg}" title="${e(it.label)} — ${MONTHS_FR[i]} : ${cmoney(v)}">${txt}</span>`;
    });
    html += `<span class="heat-total money">${cmoney(it.total)}</span></div>`;
  });
  box.innerHTML = html;
}


/* ============ Ajout d'opération ============ */
function openModal(){
  editingKey = null;
  document.getElementById('modalTitle').textContent = 'Ajouter une opération';
  document.getElementById('addForm').reset();
  const sel = document.getElementById('fMois');
  sel.innerHTML = MONTHS.map((mk,i)=>`<option value="${i}">${MONTHS_FR[i]} ${state.year}</option>`).join('');
  sel.value = state.month;
  setFormAccount(state.account==='livret' ? 'livret' : 'commun');
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
  setFormAccount(op.compte || 'commun');
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
function setFormAccount(acc){
  const key = acc==='livret' ? 'livret' : 'commun';
  document.querySelectorAll('#formAccountSeg .seg').forEach(b=>b.classList.toggle('active', b.dataset.account===key));
}
function setFormType(type){
  document.querySelectorAll('#addForm .seg[data-type]').forEach(b=>b.classList.toggle('active', b.dataset.type===type));
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

/* rgba() depuis une couleur hexadécimale */
function hexA(hex, a){
  let h = String(hex||'#888').replace('#','');
  if(h.length===3) h = h.split('').map(c=>c+c).join('');
  const n = parseInt(h,16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
/* Luminance approximative (0 = sombre, 1 = clair) pour choisir un texte lisible */
function colorLum(hex){
  let h = String(hex||'#888').replace('#','');
  if(h.length===3) h = h.split('').map(c=>c+c).join('');
  const n = parseInt(h,16);
  return (0.299*((n>>16)&255) + 0.587*((n>>8)&255) + 0.114*(n&255))/255;
}
function truncText(ctx, s, maxW){
  s = String(s);
  if(ctx.measureText(s).width<=maxW) return s;
  while(s.length>1 && ctx.measureText(s+'…').width>maxW) s = s.slice(0,-1);
  return s+'…';
}
function roundRect(ctx,x,y,w,h,r){
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

/* Courbe / aire avec valeurs nulles autorisées (trous) */
function drawLineChart(id, cfg){
  const {ctx,w,h} = dprCanvas(id);
  ctx.clearRect(0,0,w,h);
  const showLegend = cfg.legend !== false;
  const padL=64, padR=20, padT=showLegend?36:20, padB=28;
  const cw=w-padL-padR, ch=h-padT-padB;
  const vals=[];
  cfg.series.forEach(s=>s.values.forEach(v=>{ if(v!==null && v!==undefined) vals.push(v); }));
  if(!vals.length){ text(ctx,w/2,h/2,'Aucune donnée',{font:'13px Segoe UI'}); return; }

  let hi = Math.max.apply(null, vals);
  let lo = cfg.signed ? Math.min.apply(null, vals) : 0;
  if(hi===lo) hi = lo + (lo===0?100:Math.abs(lo)*0.5);
  const span = hi-lo;
  hi += span*0.12;
  if(cfg.signed) lo -= span*0.12; else lo = 0;

  const X = i => padL + (cfg.labels.length>1 ? cw*i/(cfg.labels.length-1) : cw/2);
  const Y = v => padT + ch - (v-lo)/(hi-lo)*ch;

  ctx.strokeStyle='#222b3a'; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const val = lo + (hi-lo)*i/4, y = Y(val);
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(w-padR,y); ctx.stroke();
    text(ctx,padL-10,y,fmt(val,0),{align:'right',font:'10px Segoe UI'});
  }
  if(cfg.signed && lo<0 && hi>0){
    ctx.strokeStyle='#46516280';
    ctx.beginPath(); ctx.moveTo(padL,Y(0)); ctx.lineTo(w-padR,Y(0)); ctx.stroke();
  }

  cfg.series.forEach(s=>{
    const v = s.values;
    // aire
    if(s.fill || s.signed){
      for(let i=0;i<v.length-1;i++){
        const a=v[i], b=v[i+1];
        if(a==null || b==null) continue;
        ctx.beginPath();
        ctx.moveTo(X(i),Y(a)); ctx.lineTo(X(i+1),Y(b));
        ctx.lineTo(X(i+1),Y(0)); ctx.lineTo(X(i),Y(0)); ctx.closePath();
        ctx.fillStyle = s.signed ? hexA(((a+b)/2)<0?'#ef4444':'#22c55e',0.15) : hexA(s.color,0.13);
        ctx.fill();
      }
    }
    // ligne
    ctx.lineWidth = s.width||2;
    ctx.strokeStyle = s.color;
    ctx.setLineDash(s.dashed?[5,4]:[]);
    ctx.beginPath();
    let started=false;
    v.forEach((val,i)=>{
      if(val==null){ started=false; return; }
      const px=X(i), py=Y(val);
      if(!started){ ctx.moveTo(px,py); started=true; } else ctx.lineTo(px,py);
    });
    ctx.stroke(); ctx.setLineDash([]);
    // points
    v.forEach((val,i)=>{
      if(val==null) return;
      ctx.beginPath(); ctx.arc(X(i),Y(val),2.6,0,Math.PI*2);
      ctx.fillStyle=s.color; ctx.fill();
    });
    // étiquette sur la dernière valeur
    if(s.lastLabel){
      let idx=-1; v.forEach((val,i)=>{ if(val!=null) idx=i; });
      if(idx>=0){
        text(ctx, Math.min(w-padR-6, X(idx)), Y(v[idx])-13, fmt(v[idx],0)+' €',
          {align:'right', color:s.color, font:'bold 11px Segoe UI'});
      }
    }
  });

  if(showLegend){
    let lx = padL;
    cfg.series.forEach(s=>{
      ctx.fillStyle = s.color; ctx.fillRect(lx,11,11,4);
      text(ctx,lx+17,13,s.name,{align:'left',color:'#e6edf3',font:'11px Segoe UI'});
      lx += 30 + ctx.measureText(s.name).width;
    });
  }
  cfg.labels.forEach((l,i)=>text(ctx,X(i),h-11,l,{font:'10px Segoe UI'}));
}

/* Treemap « squarifié » : blocs proportionnels, les plus lisibles possible */
function squarify(values, x, y, w, h){
  const out = [];
  let rest = values.slice();
  let rx=x, ry=y, rw=w, rh=h;
  let guard = 0;
  while(rest.length && guard++<200){
    if(rw<=0.5 || rh<=0.5) break;
    const short = Math.min(rw,rh);
    let count=0, sum=0, best=Infinity;
    for(let i=0;i<rest.length;i++){
      const s2 = sum + rest[i];
      let worst = 0;
      for(let j=0;j<=i;j++){
        const len = rest[j]*short/s2;
        const thick = s2/short;
        worst = Math.max(worst, Math.max(thick/len, len/thick));
      }
      if(worst<=best){ best=worst; sum=s2; count=i+1; } else break;
    }
    if(!count){ count=1; sum=rest[0]; }
    const row = rest.slice(0,count);
    rest = rest.slice(count);
    let off=0;
    if(rw>=rh){
      const sw = sum/rh;
      row.forEach(v=>{ const vh = v/sw; out.push({x:rx, y:ry+off, w:sw, h:vh}); off+=vh; });
      rx += sw; rw -= sw;
    } else {
      const sh = sum/rw;
      row.forEach(v=>{ const vw = v/sh; out.push({x:rx+off, y:ry, w:vw, h:sh}); off+=vw; });
      ry += sh; rh -= sh;
    }
  }
  return out;
}

function drawTreemap(id, items){
  const {ctx,w,h} = dprCanvas(id);
  ctx.clearRect(0,0,w,h);
  const list = items.filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
  const total = list.reduce((s,x)=>s+x.v,0);
  if(!total){ text(ctx,w/2,h/2,'Aucune donnée',{font:'13px Segoe UI'}); return; }
  const rects = squarify(list.map(x=>x.v/total*w*h), 0,0,w,h);
  rects.forEach((r,i)=>{
    const it = list[i];
    if(!it) return;
    const p=2, x=r.x+p, y=r.y+p, ww=r.w-p*2, hh=r.h-p*2;
    if(ww<1 || hh<1) return;
    ctx.fillStyle = it.color;
    roundRect(ctx,x,y,ww,hh,5); ctx.fill();
    const fg = colorLum(it.color)>0.62 ? '#0d1117' : '#ffffff';
    ctx.textAlign='left'; ctx.textBaseline='top';
    if(ww>78 && hh>34){
      ctx.fillStyle=fg; ctx.font='bold 11px Segoe UI';
      ctx.fillText(truncText(ctx,it.label,ww-16), x+8, y+7);
      ctx.font='10px Segoe UI'; ctx.globalAlpha=0.85;
      ctx.fillText(cmoney(it.v), x+8, y+22);
      ctx.font='9.5px Segoe UI';
      ctx.fillText(Math.round(it.v/total*100)+' %', x+8, y+35);
      ctx.globalAlpha=1;
    } else if(ww>50 && hh>18){
      ctx.fillStyle=fg; ctx.font='9px Segoe UI';
      ctx.fillText(truncText(ctx,it.label,ww-10), x+6, y+hh/2-5);
    }
  });
}

/* Sankey : revenus (gauche) → postes de dépense (droite) */
function drawSankey(id, ins, outs){
  const box = document.getElementById(id);
  if(!box) return;
  const totalIn = ins.reduce((s,n)=>s+n.v,0);
  const totalOut = outs.reduce((s,n)=>s+n.v,0);
  if(!(totalIn>0) || !(totalOut>0)){
    box.innerHTML = '<div class="muted" style="padding:26px 0;text-align:center;font-size:13px">Aucune donnée pour ce mois.</div>';
    return;
  }
  const W=1000, gap=9, padT=14;
  const nMax = Math.max(ins.length, outs.length);
  const H = Math.max(320, 110 + nMax*40);
  const usable = H - padT*2 - gap*(nMax-1);
  const scale = usable/Math.max(totalIn,totalOut);

  let y = padT;
  ins.forEach(n=>{ n.h=Math.max(3,n.v*scale); n.y0=y; y+=n.h+gap; });
  y = padT;
  outs.forEach(n=>{ n.h=Math.max(3,n.v*scale); n.y0=y; y+=n.h+gap; });

  const nLX=158, nLW=10, fx0=176, fx1=W-216, nRX=W-206, labL=148, labR=W-186, mid=(fx0+fx1)/2;

  let bands='';
  outs.forEach(n=>n.cur=n.y0);
  ins.forEach(iN=>{
    let sy=iN.y0;
    outs.forEach(oN=>{
      const hh = iN.v*oN.v/totalOut*scale;
      if(hh>0.4){
        const a=sy.toFixed(1), b=(sy+hh).toFixed(1), c=oN.cur.toFixed(1), d=(oN.cur+hh).toFixed(1);
        bands += `<path d="M${fx0},${a} C${mid},${a} ${mid},${c} ${fx1},${c} L${fx1},${d} C${mid},${d} ${mid},${b} ${fx0},${b} Z" fill="${oN.color}" fill-opacity="0.24"/>`;
      }
      sy+=hh; oN.cur+=hh;
    });
  });

  function node(n, x, labX, anchor){
    const cy = n.y0 + n.h/2;
    const maxCh = anchor==='end' ? 21 : 26;
    const name = e(n.label.length>maxCh ? n.label.slice(0,maxCh-1)+'…' : n.label);
    let txt = '';
    if(n.h>26){
      txt = `<text x="${labX}" y="${(cy-2).toFixed(1)}" text-anchor="${anchor}" font-size="12.5" font-family="Segoe UI" fill="#e6edf3">${name}</text>`
          + `<text x="${labX}" y="${(cy+12).toFixed(1)}" text-anchor="${anchor}" font-size="10.5" font-family="Segoe UI" fill="#8b96a5">${cmoney(n.v)}</text>`;
    } else if(n.h>9){
      txt = `<text x="${labX}" y="${(cy+4).toFixed(1)}" text-anchor="${anchor}" font-size="12" font-family="Segoe UI" fill="#e6edf3">${name}</text>`;
    }
    return `<g><title>${e(n.label)} : ${cmoney(n.v)}</title>`
         + `<rect x="${x}" y="${n.y0.toFixed(1)}" width="${nLW}" height="${n.h.toFixed(1)}" rx="3" fill="${n.color}"/>${txt}</g>`;
  }

  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Flux des revenus vers les postes de dépense">
    ${bands}
    ${ins.map(n=>node(n,nLX,labL,'end')).join('')}
    ${outs.map(n=>node(n,nRX,labR,'start')).join('')}
  </svg>`;
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
  const bPM=document.getElementById('prevBudgetMonth'), bNM=document.getElementById('nextBudgetMonth');
  if(bPM) bPM.onclick=()=>{ state.month=(state.month+11)%12; renderBudgetMonth(); };
  if(bNM) bNM.onclick=()=>{ state.month=(state.month+1)%12; renderBudgetMonth(); };
  const bCM=document.getElementById('prevChartMonth'), nCM=document.getElementById('nextChartMonth');
  if(bCM) bCM.onclick=()=>{ state.month=(state.month+11)%12; renderCharts(); };
  if(nCM) nCM.onclick=()=>{ state.month=(state.month+1)%12; renderCharts(); };
  document.getElementById('prevYear').onclick=()=>changeYear(-1);
  document.getElementById('nextYear').onclick=()=>changeYear(1);
  document.getElementById('btnAdd').onclick=openModal;
  document.getElementById('modalClose').onclick=()=>document.getElementById('modal').classList.add('hidden');
  document.getElementById('formCancel').onclick=()=>document.getElementById('modal').classList.add('hidden');
  document.querySelectorAll('#addForm .seg[data-type]').forEach(b=>b.onclick=()=>setFormType(b.dataset.type));
  document.querySelectorAll('#formAccountSeg .seg').forEach(b=>b.onclick=()=>setFormAccount(b.dataset.account));

  const monthAccSeg = document.getElementById('monthAccountSeg');
  if(monthAccSeg) monthAccSeg.querySelectorAll('.seg').forEach(b=>b.onclick=()=>{
    state.account = b.dataset.account;
    monthAccSeg.querySelectorAll('.seg').forEach(x=>x.classList.toggle('active', x===b));
    renderMonth();
  });

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
    const type = document.querySelector('#addForm .seg.active[data-type]').dataset.type;
    const accountEl = document.querySelector('#formAccountSeg .seg.active');
    const compte = accountEl ? accountEl.dataset.account : 'commun';
    const mi = +document.getElementById('fMois').value;
    const mk = MONTHS[mi];
    const cat = document.getElementById('fCat').value;
    const sub = document.getElementById('fSub').value;
    const label = document.getElementById('fLabel').value.trim();
    const amount = parseFloat(document.getElementById('fAmount').value);
    if(!amount||amount<=0){ showToast('Montant invalide.','err'); return; }
    const payload = {type, cat, sub, label:label||sub||(type==='depense'?'Dépense':'Revenu'), amount:Math.round(amount*100)/100, compte};
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

  /* Gestion de la connexion (Supabase Auth) */
  document.getElementById('loginForm').addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const btn = document.getElementById('loginBtn');
    const er = document.getElementById('loginError');
    btn.disabled = true;
    if(er) er.textContent = '';
    try{
      await sbLogin(document.getElementById('loginEmail').value.trim(), document.getElementById('loginPassword').value);
      document.getElementById('loginOverlay').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      await initStorage();
      switchTab('overview');
    }catch(err){
      if(er) er.textContent = (err && err.message && err.message!=='auth') ? err.message : 'Email ou mot de passe incorrect.';
    }
    btn.disabled = false;
  });
  document.getElementById('btnLogout').onclick = ()=>{
    localStorage.removeItem('sb_token');
    requireLogin('');
  };

  if(sbToken()){
    try{
      await initStorage();
      document.getElementById('loginOverlay').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      switchTab('overview');
    }catch(err){
      if(String(err && err.message)==='auth') requireLogin('Session expirée, reconnectez-vous.');
      else requireLogin('');
    }
  } else {
    requireLogin('');
  }
});
