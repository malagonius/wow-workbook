const CONFIG_URL='config/talent-trees.json';
const SPELLS_URL='config/spells.json';

let config=null;
let spells=null;
let selected=new Set();

const $=id=>document.getElementById(id);
const classSelect=$('classSelect');
const specSelect=$('specSelect');
const treeContainer=$('treeContainer');

async function loadConfig(){
  try{
    const[a,b]=await Promise.all([fetch(CONFIG_URL),fetch(SPELLS_URL)]);
    if(!a.ok||!b.ok) throw Error('Configuration files could not be loaded');
    config=await a.json();
    spells=await b.json();
    Object.keys(config.classes).forEach(c=>classSelect.add(new Option(c,c)));
    classSelect.value='Death Knight';
    populateSpecs();
  }catch(e){
    treeContainer.innerHTML='<div class="empty"><div class="icon">⚠</div><strong>Configuration could not be loaded</strong><span>Open the calculator through GitHub Pages or another web server.</span></div>';
    console.error(e);
  }
}

function currentKey(){return `${classSelect.value}/${specSelect.value}`}
function getTree(){return config?.trees[currentKey()]}

function populateSpecs(){
  selected.clear();
  specSelect.innerHTML='';
  (config?.classes[classSelect.value]||[]).forEach(s=>specSelect.add(new Option(s,s)));
  if(classSelect.value==='Death Knight'&&[...specSelect.options].some(o=>o.value==='Lichborn')) specSelect.value='Lichborn';
  render();
}

function isUnlocked(n,d){return n.requires.every(id=>selected.has(id))}
function hasDependents(id,d){return d.nodes.some(n=>n.requires.includes(id)&&selected.has(n.id))}

function toggleNode(id){
  const d=getTree(),n=d?.nodes.find(x=>x.id===id);
  if(!n)return;
  if(selected.has(id)){
    if(hasDependents(id,d))return;
    selected.delete(id);
  }else if(isUnlocked(n,d)&&selected.size<d.maxPoints){
    selected.add(id);
  }
  render();
}

function render(){
  const d=getTree();
  $('className').textContent=classSelect.value;
  $('specName').textContent=specSelect.value;
  $('specDescription').textContent=d?.description||'No homebrew talent tree has been defined for this specialization yet.';
  $('pointCount').textContent=`${selected.size} / ${d?.maxPoints||0}`;
  $('details').innerHTML=`<h3>${d?'Tree notes':'Ready for design'}</h3><p>${d?'Click an available node to spend a point. A node becomes available only after all configured prerequisites are selected. Selected nodes with dependent talents cannot be removed until those dependents are removed.':'This specialization has no custom tree yet. Add it to <code>config/talent-trees.json</code> without changing the UI.'}</p>`;

  if(!d){
    treeContainer.innerHTML='<div class="empty"><div class="icon">✦</div><strong>No custom tree yet</strong><span>This slot is ready for future homebrew specialization work.</span></div>';
    return;
  }

  const nodes=d.nodes;
  const byId=Object.fromEntries(nodes.map(n=>[n.id,n]));
  let html='<div class="tree"><div class="tiers"><svg class="connections" aria-hidden="true">';

  nodes.forEach(n=>n.requires.forEach(req=>{
    const f=byId[req];
    if(!f)return;
    const fromCol=(f.column-.5)*25;
    const toCol=(n.column-.5)*25;
    html+=`<line class="${selected.has(req)&&selected.has(n.id)?'active':''}" data-from="${req}" data-to="${n.id}" x1="${fromCol}%" y1="${(f.tier-.5)*25}%" x2="${toCol}%" y2="${(n.tier-.5)*25}%"/>`;
  }));

  html+='</svg>';
  for(let tier=1;tier<=4;tier++){
    html+=`<div class="tier"><span class="tier-label">TIER ${tier}</span>`;
    for(let col=1;col<=4;col++){
      const n=nodes.find(x=>x.tier===tier&&x.column===col);
      if(!n){html+='<div></div>';continue}
      const unlocked=isUnlocked(n,d);
      const sel=selected.has(n.id);
      const dependent=hasDependents(n.id,d);
      html+=`<button class="node ${n.type} ${sel?'selected':''} ${!unlocked&&!sel?'locked':''}" data-id="${n.id}" title="${unlocked?'Select talent':dependent?'Remove dependent talents first':'Requires: '+n.requires.map(id=>byId[id]?.name||id).join(', ')}"><div><strong>${n.name}</strong><small>${n.spell||'Talent'}</small></div>${sel?'<span class="rank">✓</span>':''}</button>`;
    }
    html+='</div>';
  }
  html+='</div></div>';
  treeContainer.innerHTML=html;
  treeContainer.querySelectorAll('.node').forEach(b=>b.addEventListener('click',()=>toggleNode(b.dataset.id)));
}

function openSpells(){
  const list=spells?.[currentKey()]||[];
  $('modalTitle').textContent=`${specSelect.value} — Spellbook`;
  $('spellList').innerHTML=list.length?list.map(s=>`<article class="spell"><div class="spell-title"><strong>${s.name}</strong><span class="badge">${s.school}</span></div><div class="spell-meta"><span>Range: ${s.range}</span><span>Cost: ${s.cost}</span></div><p>${s.effect}</p></article>`).join(''):'<div class="spell"><p>No spell configuration exists for this specialization yet.</p></div>';
  $('spellModal').classList.add('open');
  $('spellModal').setAttribute('aria-hidden','false');
}

function closeModal(){
  $('spellModal').classList.remove('open');
  $('spellModal').setAttribute('aria-hidden','true');
}

$('closeModal').addEventListener('click',closeModal);
$('spellModal').addEventListener('click',e=>{if(e.target.id==='spellModal')closeModal()});
$('spellsBtn').addEventListener('click',openSpells);
$('resetBtn').addEventListener('click',()=>{selected.clear();render()});
classSelect.addEventListener('change',populateSpecs);
specSelect.addEventListener('change',()=>{selected.clear();render()});

loadConfig();