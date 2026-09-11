# Lichborn — Death Knight Resource Reference

This is a **reference to the existing Death Knight resource grammar**, not a list of Lichborn abilities or design decisions.

The purpose is to keep the new spec grounded in actual WoW Death Knight gameplay and to give us existing Rune / Runic Power patterns to compare against while brainstorming.

Reference point: current Midnight-era Death Knight gameplay, Patch 12.1.0, checked September 2026. The reference is cross-checked against the current Wowpedia Death Knight abilities page and current Midnight specialization guides.

> **Costs below are baseline/reference costs.** Talents, procs, and specialization effects can reduce, remove, or otherwise modify a spell's cost.

## Classification

Modern DK abilities are heavily represented in the class and specialization talent trees. This means that a core DK button can be technically a **Talent** rather than an automatically learned spell.

- **Baseline** = learned automatically.
- **Talent — Class** = selected through the shared DK class tree. It can still be effectively automatic for a specialization/path.
- **Talent — Spec** = selected through Blood, Frost, or Unholy specialization talents.
- **PvP Talent** = PvP-only talent.

The goal here is to **include talent-locked abilities instead of hiding them**, while clearly labeling them.

---

# Shared DK abilities and resource-relevant utility

| Ability | Status | Cost | Notes |
|---|---|---:|---|
| **Death and Decay** | **Baseline** | 1 Rune | Ground-targeted AoE; a core shared DK resource button. |
| **Chains of Ice** | **Talent — Class** | 1 Rune | Shared DK slow. Wowpedia lists it in the class talent tree; it is automatically learned for Frost. |
| **Death Strike** | **Talent — Class** | 45 Runic Power | Major healing/defensive RP spender; automatically available to Blood through the class tree. |
| **Raise Dead** | **Talent — Class** | None | Summons the DK's ghoul; automatically available to Unholy through the class tree. |
| **Mind Freeze** | **Talent — Class** | None | 15 sec cooldown interrupt. It is a class talent, not a baseline spell. |
| **Anti-Magic Shell** | **Talent — Class** | None | Defensive cooldown; absorbed magic damage generates Runic Power. |
| **Icebound Fortitude** | **Talent — Class** | None | Major defensive cooldown. |
| **Runic Attenuation** | **Talent — Class** | None | Auto-attacks can generate Runic Power. |
| **Raise Ally** | **Talent / Class utility** | 30 Runic Power | Combat resurrection; some talents can remove/modify its cost. |
| **Death Grip** | Baseline/class utility | None | Pull utility; no Rune/RP cost. |
| **Death's Advance** | Baseline/class utility | None | Movement/forced-movement utility. |
| **Dark Command** | Baseline/class utility | None | Taunt. Mainly relevant to Blood. |
| **Path of Frost** | Baseline/class utility | None* | Water-walking utility; *not treated as a core resource spender here because current implementations/talent context can differ from the old Rune-cost model. |
| **Lichborne** | Baseline/spec-accessible utility | None | Defensive/control-immunity utility. |
| **Wraith Walk** | **Talent — Class** | None | Movement/escape option. |
| **Blinding Sleet** | **Talent — Class** | None | AoE disorient. |
| **Asphyxiate** | **Talent — Class** | None | Single-target stun. |
| **Gorefiend's Grasp** | **Talent — Class** | None | Mass grip utility. |
| **Anti-Magic Zone** | **Talent — Class** | None | Group magic-damage mitigation. |
| **Control Undead** | **Talent — Class** | None | Temporary control of an undead NPC. |

**Key correction:** Chains of Ice and Mind Freeze belong in the shared/class section rather than inside a Blood/Frost/Unholy-only list. Wowpedia explicitly identifies Chains of Ice as a Class talent and Mind Freeze as a Class talent. citeturn364588search0turn364588search1turn364588search2

---

# Rune spenders — Blood

| Ability | Status | Cost | Notes |
|---|---|---:|---|
| **Heart Strike** | **Talent — Spec** | 1 Rune | Primary Blood Rune spender; cleaves and generates bonus Runic Power. |
| **Marrowrend** | **Talent — Spec** | 2 Runes | Grants Bone Shield charges; useful heavy 2-Rune reference. |
| **Blood Boil** | **Talent — Spec** | 0 Runes; 2 charges | AoE Blood attack / disease application; charge-based rather than Rune-based. |
| **Death's Caress** | **Talent / Blood** | 0 Runes | Ranged Blood Plague application; include as a disease-application reference. |

Blood's current guide confirms Heart Strike as the main Rune spender and Marrowrend as a 2-Rune talent ability. citeturn238921search2turn735175search1

# Rune spenders — Frost

| Ability | Status | Cost | Notes |
|---|---|---:|---|
| **Obliterate** | **Talent — Spec** | 2 Runes | Major single-target Rune spender. |
| **Howling Blast** | **Talent — Spec** | 1 Rune | Ranged Frost attack; Rime can make it free. |
| **Frostscythe** | **Talent — Spec** | 2 Runes | AoE cone Rune spender. |
| **Remorseless Winter** | **Talent / Frost** | 1 Rune | AoE cooldown around the DK; included as a resource-consuming Frost reference. |

Frost's current guide describes Obliterate and Howling Blast as Rune-costing specialization talent abilities, while current spell data lists Frostscythe at 2 Runes. citeturn238921search1turn735175search5

# Rune spenders — Unholy

| Ability | Status | Cost | Notes |
|---|---|---:|---|
| **Festering Strike** | **Talent — Spec** | 2 Runes | Heavy Rune spender; generates RP and advances the Unholy engine. |
| **Scourge Strike** | **Talent — Spec** | 1 Rune | Core Unholy Rune spender; interacts with plagues / Lesser Ghoul mechanics. |
| **Clawing Shadows** | **Talent — Spec** | 1 Rune | Alternative ranged version of the Scourge Strike pattern. |
| **Outbreak** | **Talent — Spec** | 0 resource | Disease application; important as the cleanest existing DK disease-opener reference. |

Current Unholy references list Festering Strike as a 2-Rune ability and Scourge Strike as a 1-Rune talent ability. citeturn518729search11turn735175search2turn735175search13

---

# Runic Power spenders — Blood

| Ability | Status | Cost | Notes |
|---|---|---:|---|
| **Death Strike** | **Talent — Class** | 45 Runic Power | Primary defensive/healing spender. |
| **Death Coil** | Available/class spell | 30 Runic Power | Generic ranged Shadow RP dump; generally not the core Blood rotation. |

# Runic Power spenders — Frost

| Ability | Status | Cost | Notes |
|---|---|---:|---|
| **Frost Strike** | **Talent — Spec** | 35 Runic Power | Primary Frost single-target RP spender. |
| **Glacial Advance** | **Talent — Spec** | 30 Runic Power | Line AoE RP spender. |
| **Breath of Sindragosa** | **Talent — Spec** | 60 Runic Power to activate | Major sustained RP commitment; current Midnight implementation is a fixed-duration effect rather than the old “run until RP is exhausted” wording. It still makes an excellent reference for an RP-preservation minigame. |
| **Death Strike** | **Talent — Class** | 45 Runic Power | Defensive RP option through the class tree. |

Current spell data confirms Frost Strike at 35 RP and Glacial Advance at 30 RP. Current Midnight Breath of Sindragosa is a 60-RP talent with a 1.5-minute cooldown. citeturn518729search9turn518729search6turn735175search0

# Runic Power spenders — Unholy

| Ability | Status | Cost | Notes |
|---|---|---:|---|
| **Death Coil** | **Baseline for Unholy / class spell** | 30 Runic Power | Primary single-target RP spender. |
| **Epidemic** | **Talent — Spec** | 30 Runic Power | AoE RP spender. |
| **Death Strike** | **Talent — Class** | 45 Runic Power | Defensive/healing RP option. |

Current spell data lists Death Coil at 30 RP and Epidemic at 30 RP. citeturn518729search4turn518729search0

---

# Other resource-relevant talents worth keeping in the reference

These are not all spenders themselves, but they are useful examples of how WoW modifies the Rune/RP loop:

- **Runic Attenuation** — auto attacks generate Runic Power.
- **Runic Empowerment / Runic Corruption** — Runic Power spending can feed Rune regeneration depending on the specialization/mechanic.
- **Rime** — can make Howling Blast free.
- **Murderous Efficiency** — can refund Runes in Frost's resource cycle.
- **Sudden Doom** — can modify the next Death Coil/Epidemic cost and effect.
- **Improved Death Strike** — reduces Death Strike's RP cost and increases its healing.
- **Heartbreaker** — modifies Heart Strike's bonus RP generation.
- **Cleaving Strikes** — modifies Scourge Strike behavior inside Death and Decay.
- **Obliteration** — demonstrates a temporary transformation of the normal Rune/RP relationship.
- **Breath of Sindragosa** — the strongest existing DK example of treating Runic Power as a resource to sustain an ongoing payoff rather than simply dumping it.

---

# Reference cost patterns for Lichborn

| Pattern | Reference | Why it matters |
|---|---:|---|
| Light Rune ability | **1 Rune** | Natural baseline for frequent Rune spending / Death's Claim generation. |
| Heavy Rune ability | **2 Runes** | Excellent baseline for a “big button” that should not automatically generate twice as much Death's Claim. |
| Common RP spender | **30–35 RP** | Natural baseline for a normal DPS/utility exploit. |
| Heavy RP spender | **45 RP** | Good reference for a high-value defensive/utility exploit. |
| Large RP commitment | **60 RP** | Good reference for a major payoff. |
| Sustained RP drain | **Breath-style** | Useful reference for a “maintain RP to maintain the effect” minigame. |

## Core DK resource loop

The fundamental DK grammar is:

> **Spend Runes → generate Runic Power → spend Runic Power.**

Lichborn's proposed twist is:

> **Spend Runes → build Death's Claim → generate Runic Power → use Runic Power to exploit Death's Claim.**

The current brainstorming direction for **Mastery: Domination** is:

> **Gain X stacks of Death's Claim whenever you spend a Rune.**

The exact formula is intentionally not locked yet.

The current preference is **not** to grant proportionally more Claim simply because an ability costs more Runes. A powerful 2-Rune ability should be able to be stronger immediately while being less efficient at building Death's Claim, preserving useful differences between single-target and AoE/resource patterns.

## Why this list is broader than the previous one

The earlier reference accidentally treated “not baseline” as “not relevant.” That was the wrong distinction for our purpose.

For Lichborn brainstorming, the useful comparison set should include **talent-locked spells**, because many of the buttons players actually use as core DK gameplay are technically talents in the modern tree. We now mark them explicitly rather than omitting them.

This correction also fixes the two issues identified during review:

- **Chains of Ice is shared/class**, not Unholy-only.
- **Mind Freeze is a class talent**, not missing from the reference.

## Sources

Primary comparison:

- Wowpedia — **Death knight abilities**: https://wowpedia.fandom.com/wiki/Death_knight_abilities citeturn364588search0

Cross-checks:

- Wowpedia — **Mind Freeze**: citeturn364588search1
- Wowpedia — **Chains of Ice**: citeturn364588search2
- Wowhead — Blood DK Abilities and Talents, Midnight 12.1.0: citeturn238921search2
- Wowhead — Frost DK Abilities and Talents, Midnight 12.1.0: citeturn238921search1
- Wowhead — Unholy DK Abilities and Talents, Midnight 12.1.0: citeturn238921search0
- Wowhead current spell data for relevant costs: citeturn518729search0turn518729search4turn518729search6turn518729search9turn735175search0turn735175search5turn735175search13

This file intentionally describes the **existing DK toolkit** rather than proposing that Lichborn should copy any of it.