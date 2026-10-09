import { nodeLabel } from './talent-model.js';
import { loadTalentProject } from './talent-config.js';
import { renderSections, layoutConnections, renderEmptyState } from './talent-tree-renderer.js';

const ABILITIES_URL='config/abilities.json';
let project=null,abilities=null;
const ranks=new Map(),choices=new Map();
const $=id=>document.getElementById(id),classSelect=$('classSelect'),specSelect=$('specSelect'),treeContainer=$('treeContainer');

async function loadConfig(){
  try{
    const [loadedProject,abilitiesResponse]=await Promise.all([loadTalentProject(),fetch(ABILITIES_URL)]);
    if(!abilitiesResponse.ok)throw Error('Ability configuration could not be loaded');
    project=loadedProject;
    abilities=await abilitiesResponse.json();
    const classes=Object.keys(project.content||{});
    classSelect.innerHTML='';
    classes.forEach(name=>classSelect.add(new Option(name,name)));
    if(!classes.length)throw Error('No classes are defined in the talent project. Open Talent Designer to create one.');
    classSelect.value=classes[0];
    populateSpecs();
  }catch(e){
    classSelect.innerHTML='<option value="">Unavailable</option>';
    specSelect.innerHTML='<option value="">Unavailable</option>';
    treeContainer.innerHTML='<div class="empty"><div class="icon">⚠</div><strong>Configuration could not be loaded</strong><span>'+e.message+'</span></div>';
    console.error(e);
  }
}

function currentKey(){return classSelect.value+'/'+specSelect.value}
function getTree(){return project?.trees[currentKey()]}
function resetPoints(){ranks.clear();choices.clear()}
function populateSpecs(){
  resetPoints();specSelect.innerHTML='';
  const specs=project?.content?.[classSelect.value]||[];
  specs.forEach(s=>specSelect.add(new Option(s,s)));
  if(specs.length)specSelect.value=specs[0];
  render();
}
function sectionNodes(section){return section?.nodes||[]}
function sectionEdges(s){return s?.connections||[]}
function rankOf(id){return ranks.get(id)||0}
function sectionPoints(s){return sectionNodes(s).reduce((total,node)=>total+rankOf(node.id),0)}
function incoming(s,id){return sectionEdges(s).filter(e=>e.to===id).map(e=>e.from)}
function outgoing(s,id){return sectionEdges(s).filter(e=>e.from===id).map(e=>e.to)}
function isNodeAvailable(s,node){
  if(!node)return false;
  if(node.row===0)return true;
  return incoming(s,node.id).some(parent=>rankOf(parent)>0);
}
function canRemove(s,id){
  if(rankOf(id)>1)return true;
  return !outgoing(s,id).some(child=>rankOf(child)>0&&incoming(s,child).filter(parent=>rankOf(parent)>0).length<=1);
}
function choiceCount(node){return (node.choices||[]).length}
function addRank(s,node){
  const current=rankOf(node.id);
  if(current&&node.kind==='choice'&&choiceCount(node)>1){
    choices.set(node.id,((choices.get(node.id)??0)+1)%choiceCount(node));
    return;
  }
  if(current>=node.maxRank||sectionPoints(s)>=(s.maxPoints||0)||!isNodeAvailable(s,node))return;
  ranks.set(node.id,current+1);
  if(node.kind==='choice'&&!choices.has(node.id))choices.set(node.id,0);
}
function removeRank(s,node){
  const current=rankOf(node.id);
  if(!current||(current===1&&!canRemove(s,node.id)))return;
  if(current===1){ranks.delete(node.id);choices.delete(node.id)}
  else ranks.set(node.id,current-1);
}
function nodeState(section,node){
  const rank=rankOf(node.id),selected=rank>0,available=selected||isNodeAvailable(section,node);
  const lines=[nodeLabel(node)||'Empty talent slot'];
  if(node.maxRank>1)lines.push('Rank '+rank+' / '+node.maxRank);
  if(node.description)lines.push(node.description);
  if(node.kind==='choice'&&choiceCount(node))lines.push(node.choices.map(c=>c.name).filter(Boolean).join(' or '));
  lines.push(selected?(canRemove(section,node.id)?'Right-click to refund a rank':'Another selected talent depends on this'):(available?'Click to spend a point':'Requires a connected talent'));
  const tooltipFooter=selected?(canRemove(section,node.id)?'Right-click to refund a rank':'Another selected talent depends on this'):(available?'Click to spend a point':'Requires a connected talent');
  return {rank,selected,available,partial:selected&&rank<node.maxRank,choiceIndex:choices.has(node.id)?choices.get(node.id):-1,title:lines.join('\n'),tooltipFooter};
}
function render(){
  const tree=getTree();
  $('className').textContent=classSelect.value;$('specName').textContent=specSelect.value;
  $('specDescription').textContent=tree?.description||'No homebrew talent tree has been defined for this specialization yet.';
  if(!tree){
    $('pointCount').textContent='0 / 0';
    renderEmptyState(treeContainer,'✦','No custom tree yet','This specialization has no talent tree yet. Open Talent Designer to create it.');
    return;
  }
  const sections=tree.sections||[];
  $('pointCount').textContent=sections.reduce((a,s)=>a+sectionPoints(s),0)+' / '+sections.reduce((a,s)=>a+(s.maxPoints||0),0);
  $('details').innerHTML='<h3>Talent tree</h3><p>Click a talent to spend a point, right-click to refund one. Multi-rank talents fill up one point at a time, and choice talents cycle between their options. Starting nodes are selectable first; every later node requires a selected connected parent.</p>';
  renderSections(treeContainer,sections,{
    mode:'calculator',
    getNodeState:nodeState,
    getSectionSummary:s=>sectionPoints(s)+' / '+(s.maxPoints||0),
    handlers:{
      onNodeClick:(node,section)=>{addRank(section,node);render()},
      onNodeAlt:(node,section)=>{removeRank(section,node);render()}
    }
  });
}
function loadLocalAbilities(){
  try{return JSON.parse(localStorage.getItem('wow-workbook-abilities-draft')||'{}')}catch{return {}}
}
function openAbilities(){
  const local=loadLocalAbilities();
  const list=[
    ...(abilities?.[classSelect.value]||[]),
    ...(abilities?.[currentKey()]||[]),
    ...(local?.[classSelect.value]||[]),
    ...(local?.[currentKey()]||[])
  ];
  $('modalTitle').textContent=classSelect.value+' / '+specSelect.value+' — Abilities';
  $('spellList').innerHTML=list.length?list.map(a=>{
    const type=a.type||'ability';
    const details=type==='spell'?'<div class="spell-meta"><span>Range: '+(a.range||'—')+'</span><span>Cost: '+(a.cost||'—')+'</span></div>':'';
    return '<article class="spell"><div class="spell-title"><strong>'+escapeHtml(a.name||'Unnamed ability')+'</strong><span class="badge">'+escapeHtml(type)+'</span></div>'+details+'<p>'+escapeHtml(a.description||'')+'</p></article>';
  }).join(''):'<div class="spell"><p>No abilities are configured for this specialization yet.</p></div>';
  $('spellModal').classList.add('open');$('spellModal').setAttribute('aria-hidden','false');
}
function escapeHtml(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;")}
function closeModal(){$('spellModal').classList.remove('open');$('spellModal').setAttribute('aria-hidden','true')}
$('closeModal').addEventListener('click',closeModal);$('spellModal').addEventListener('click',e=>{if(e.target.id==='spellModal')closeModal()});$('abilitiesBtn').addEventListener('click',openAbilities);$('resetBtn').addEventListener('click',()=>{resetPoints();render()});classSelect.addEventListener('change',populateSpecs);specSelect.addEventListener('change',()=>{resetPoints();render()});window.addEventListener('resize',()=>layoutConnections(treeContainer));loadConfig();
