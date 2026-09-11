import { projectFromLegacy, normalizeProject } from './talent-model.js';

const PROJECT_URL='config/talent-project.json';
const SPELLS_URL='config/spells.json';
const CONFIG_URL='config/talent-trees.json';
const CONNECTIONS_URL='config/talent-connections.json';
let project=null,spells=null,selected=new Set();
const $=id=>document.getElementById(id),classSelect=$('classSelect'),specSelect=$('specSelect'),treeContainer=$('treeContainer');

async function loadConfig(){
  try{
    const spellPromise=fetch(SPELLS_URL);
    let loadedProject;
    try{
      const response=await fetch(PROJECT_URL);
      if(!response.ok)throw Error(`Canonical project unavailable (${response.status})`);
      loadedProject=normalizeProject(await response.json());
    }catch{
      const [a,c]=await Promise.all([fetch(CONFIG_URL),fetch(CONNECTIONS_URL)]);
      if(!a.ok||!c.ok)throw Error('Talent configuration could not be loaded');
      loadedProject=projectFromLegacy(await a.json(),await c.json());
    }
    const spellResponse=await spellPromise;
    if(!spellResponse.ok)throw Error('Spell configuration could not be loaded');
    project=loadedProject;
    spells=await spellResponse.json();
    Object.keys(project.content||{}).forEach(x=>classSelect.add(new Option(x,x)));
    classSelect.value='Death Knight';
    populateSpecs();
  }catch(e){
    treeContainer.innerHTML='<div class="empty"><div class="icon">⚠</div><strong>Configuration could not be loaded</strong><span>Open the calculator through GitHub Pages or another web server.</span></div>';
    console.error(e);
  }
}

function currentKey(){return `${classSelect.value}/${specSelect.value}`}
function getTree(){return project?.trees[currentKey()]}
function populateSpecs(){
  selected.clear();specSelect.innerHTML='';
  (project?.content?.[classSelect.value]||[]).forEach(s=>specSelect.add(new Option(s,s)));
  if(classSelect.value==='Death Knight'&&[...specSelect.options].some(o=>o.value==='Lichborn'))specSelect.value='Lichborn';
  render();
}
function sectionNodes(section){return section?.nodes||[]}
function sectionCount(s){return sectionNodes(s).filter(n=>selected.has(n.id)).length}
function sectionEdges(s){return s?.connections||[]}
function incoming(s,id){return sectionEdges(s).filter(e=>e.to===id).map(e=>e.from)}
function outgoing(s,id){return sectionEdges(s).filter(e=>e.from===id).map(e=>e.to)}
function isNodeAvailable(s,id){
  const node=sectionNodes(s).find(n=>n.id===id);if(!node)return false;
  if(node.row===0)return true;
  return incoming(s,id).some(parent=>selected.has(parent));
}
function canRemove(s,id){
  return !outgoing(s,id).some(child=>selected.has(child)&&incoming(s,child).filter(parent=>selected.has(parent)).length<=1);
}
function toggleNode(id){
  const s=(getTree()?.sections||[]).find(x=>sectionNodes(x).some(n=>n.id===id));if(!s)return;
  if(selected.has(id)){if(canRemove(s,id))selected.delete(id)}
  else if(sectionCount(s)<s.maxPoints&&isNodeAvailable(s,id))selected.add(id);
  render();
}
function render(){
  const d=getTree();
  $('className').textContent=classSelect.value;$('specName').textContent=specSelect.value;
  $('specDescription').textContent=d?.description||'No homebrew talent tree has been defined for this specialization yet.';
  if(!d){$('pointCount').textContent='0 / 0';treeContainer.innerHTML='<div class="empty"><div class="icon">✦</div><strong>No custom tree yet</strong><span>This slot is ready for future homebrew specialization work.</span></div>';return}
  const sections=d.sections||[],total=sections.reduce((a,s)=>a+sectionCount(s),0),max=sections.reduce((a,s)=>a+(s.maxPoints||0),0);
  $('pointCount').textContent=`${total} / ${max}`;
  $('details').innerHTML='<h3>Talent tree</h3><p>Talent connections are defined by the canonical project JSON. Starting nodes are selectable first; every later node requires a selected connected parent.</p>';
  let html='';
  sections.forEach(s=>{
    const edges=sectionEdges(s),nodes=sectionNodes(s),maxRow=Math.max(0,...nodes.map(n=>n.row));
    html+=`<section class="talent-section ${s.type}" data-section="${s.id}"><div class="section-head"><div><span class="section-type">${s.type.toUpperCase()}</span><h3>${s.title}</h3></div><strong>${sectionCount(s)} / ${s.maxPoints||0}</strong></div><div class="tree-graph" style="--cols:4"><svg class="connections" aria-hidden="true" preserveAspectRatio="none">${edges.map(e=>`<line data-from="${e.from}" data-to="${e.to}"></line>`).join('')}</svg><div class="tree-grid">`;
    const byPosition=new Map(nodes.map(n=>[`${n.row}-${n.column}`,n]));
    for(let r=0;r<=maxRow;r++)for(let c=0;c<4;c++){
      const node=byPosition.get(`${r}-${c}`);
      if(!node){html+='<div class="socket empty-socket" aria-hidden="true"></div>';continue}
      const sel=selected.has(node.id),available=sel||isNodeAvailable(s,node.id),removable=sel&&canRemove(s,node.id);
      html+=`<button class="node ${s.type} ${node.name?'':'placeholder'} ${sel?'selected':''} ${available?'available':'locked'}" data-id="${node.id}" title="${sel?(removable?'Remove talent':'Cannot remove: another selected talent depends on it'):(available?'Select talent':'Requires a connected talent')}" aria-label="${sel?'Remove talent':available?'Select talent':'Locked talent'}" ${!sel&&!available?'disabled':''}><span class="node-icon">${node.icon|| (node.name?'✦':'')}</span><span class="node-name">${node.name||''}</span>${sel?'<span class="rank">✓</span>':''}</button>`;
    }
    html+='</div></div></section>';
  });
  treeContainer.innerHTML=html;
  treeContainer.querySelectorAll('.node').forEach(b=>b.addEventListener('click',()=>toggleNode(b.dataset.id)));
  requestAnimationFrame(positionConnections);
}
function positionConnections(){
  treeContainer.querySelectorAll('.talent-section').forEach(section=>{
    const graph=section.querySelector('.tree-graph'),svg=section.querySelector('.connections');if(!graph||!svg)return;
    const gr=graph.getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${gr.width} ${gr.height}`);svg.setAttribute('width',gr.width);svg.setAttribute('height',gr.height);
    section.querySelectorAll('.connections line').forEach(line=>{
      const a=section.querySelector(`[data-id="${line.dataset.from}"]`),b=section.querySelector(`[data-id="${line.dataset.to}"]`);if(!a||!b)return;
      const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect(),x1=ar.left+ar.width/2-gr.left,y1=ar.top+ar.height-gr.top,x2=br.left+br.width/2-gr.left,y2=br.top-gr.top;
      line.setAttribute('x1',x1);line.setAttribute('y1',y1);line.setAttribute('x2',x2);line.setAttribute('y2',y2);
      const active=a.classList.contains('selected')&&b.classList.contains('selected');line.classList.toggle('active',active);line.classList.toggle('available',a.classList.contains('selected')||b.classList.contains('selected'));
    });
  });
}
function openSpells(){
  const list=spells?.[currentKey()]||[];$('modalTitle').textContent=`${specSelect.value} — Spellbook`;
  $('spellList').innerHTML=list.length?list.map(s=>`<article class="spell"><div class="spell-title"><strong>${s.name}</strong><span class="badge">${s.school}</span></div><div class="spell-meta"><span>Range: ${s.range}</span><span>Cost: ${s.cost}</span></div><p>${s.effect}</p></article>`).join(''):'<div class="spell"><p>No spell configuration exists for this specialization yet.</p></div>';
  $('spellModal').classList.add('open');$('spellModal').setAttribute('aria-hidden','false');
}
function closeModal(){$('spellModal').classList.remove('open');$('spellModal').setAttribute('aria-hidden','true')}
$('closeModal').addEventListener('click',closeModal);$('spellModal').addEventListener('click',e=>{if(e.target.id==='spellModal')closeModal()});$('spellsBtn').addEventListener('click',openSpells);$('resetBtn').addEventListener('click',()=>{selected.clear();render()});classSelect.addEventListener('change',populateSpecs);specSelect.addEventListener('change',()=>{selected.clear();render()});window.addEventListener('resize',positionConnections);loadConfig();
