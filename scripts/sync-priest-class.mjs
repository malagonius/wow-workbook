import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

const referenceUrl = 'https://www.wowhead.com/it/talent-calc/priest/shadow';
const dataUrl = 'https://nether.wowhead.com/it/data/talents-dragonflight?dv=41&db=1791788844';
const classFile = new URL('../config/class/priest.json', import.meta.url);
const fixtureFile = new URL('../tests/fixtures/priest-class-wowhead.json', import.meta.url);
const response = await fetch(dataUrl);
if (!response.ok) throw new Error(`Wowhead data request failed: ${response.status}`);
const source = await response.text();
const payloads = new Map([...source.matchAll(/^WH\.setPageData\("([^"]+)",(.*)\);\s*$/gm)]
  .map(match => [match[1], JSON.parse(match[2])]));
const tree = payloads.get('wow.talentCalcDragonflight.live.trees')?.find(candidate => candidate.id === 5 && candidate.playerClass === 5);
if (!tree) throw new Error('Priest class tree is missing from Wowhead data.');

const talents = Object.values(tree.talents).map(variants => {
  const visible = variants.filter(talent => !talent.shownForSpecs || talent.shownForSpecs.includes(258));
  if (visible.length !== 1) throw new Error('Ambiguous Priest talent variant.');
  return visible[0];
}).sort((first, second) => first.cell - second.cell);
const idForCell = cell => `priest-class-${cell}`;
const imageUrl = icon => `https://wow.zamimg.com/images/wow/icons/large/${icon}.jpg`;
const reference = {
  url: referenceUrl,
  dataUrl,
  capturedOn: '2026-10-14',
  treeId: tree.id,
  checkpoints: tree.checkpoints,
  nodes: talents.map(talent => ({
    cell: talent.cell,
    nodeId: talent.node,
    row: Math.floor(talent.cell / 19) + 1,
    column: talent.cell % 19 + 1,
    type: talent.type,
    spellIds: talent.spells.map(spell => spell.spell),
    names: talent.spells.map(spell => spell.name),
    maxRank: Math.max(...talent.spells.map(spell => spell.points)),
    defaultSpecs: talent.defaultSpecs || []
  })),
  edges: talents.flatMap(talent => talent.requires.map(parent => [parent, talent.cell]))
};
if (reference.nodes.length !== 48 || reference.edges.length !== 78) throw new Error('The reference tree changed; review before replacing the baseline.');

const baseline = {
  id: 'class',
  title: 'Sacerdote',
  type: 'class',
  maxPoints: 34,
  columns: 9,
  rowCount: 10,
  selectableEmpty: false,
  source: { url: referenceUrl, dataUrl, capturedOn: reference.capturedOn, treeId: tree.id, referenceSpecId: 258 },
  checkpoints: tree.checkpoints.map(checkpoint => ({ row: checkpoint.row - 1, points: checkpoint.points })),
  nodes: talents.map(talent => {
    const spell = talent.spells[0];
    const node = {
      id: idForCell(talent.cell),
      name: talent.spells.map(option => option.name).join(' / '),
      description: spell.descriptionSearch || '',
      icon: imageUrl(spell.icon),
      row: Math.floor(talent.cell / 19),
      column: (talent.cell % 19 - 1) / 2,
      type: 'talent',
      kind: talent.type === 3 ? 'choice' : talent.type === 1 ? 'active' : 'passive',
      maxRank: Math.max(...talent.spells.map(option => option.points)),
      cost: '', range: '', charges: '', castTime: '', cooldown: '',
      wowheadCell: talent.cell,
      wowheadNodeId: talent.node,
      spellIds: talent.spells.map(option => option.spell),
      requiredPoints: talent.requiredPoints,
      defaultSpecs: talent.defaultSpecs || []
    };
    if (!Number.isInteger(node.column)) throw new Error(`Unsupported Priest column at cell ${talent.cell}.`);
    if (talent.type === 3) node.choices = talent.spells.map(option => ({
      name: option.name, description: option.descriptionSearch || '', icon: imageUrl(option.icon)
    }));
    return node;
  }),
  connections: reference.edges.map(([from, to]) => ({ from: idForCell(from), to: idForCell(to) }))
};

const project = JSON.parse(await readFile(classFile, 'utf8'));
if (process.argv.includes('--write')) {
  project.shared.classes['Priest/class'] = baseline;
  await mkdir(new URL('../tests/fixtures/', import.meta.url), { recursive: true });
  await writeFile(classFile, JSON.stringify(project, null, 2) + '\n');
  await writeFile(fixtureFile, JSON.stringify(reference, null, 2) + '\n');
  console.log(`Updated only Priest/class: ${baseline.nodes.length} talents, ${baseline.connections.length} connections.`);
} else {
  if (!isDeepStrictEqual(project.shared.classes['Priest/class'], baseline)) throw new Error('Priest/class differs from the Wowhead reference.');
  console.log('Priest/class matches the pinned Wowhead source.');
}