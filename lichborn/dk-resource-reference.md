# Lichborn — Death Knight Resource Reference

This is a **reference to the existing Death Knight resource grammar**, not a list of Lichborn abilities or design decisions.

The purpose is to keep the new spec grounded in actual WoW Death Knight gameplay and to give us existing Rune / Runic Power patterns to compare against while brainstorming.

Reference point: current Midnight-era Death Knight guides and current spell data, Patch 12.1.0, checked September 2026.

> **Costs below are baseline/reference costs.** Talents, procs, and specialization effects can reduce, remove, or otherwise modify a spell's cost.

## Shared/class Death Knight resource abilities

These are important because they establish the common DK resource language before specialization-specific abilities are added.

- **Death Strike** — **45 Runic Power** — melee strike and major self-healing/defensive spender; available to all DKs, with Blood making the strongest defensive use of it.
- **Chains of Ice** — **1 Rune** — ranged slow; class utility, not a spec-exclusive ability.
- **Death and Decay** — **1 Rune** — targeted ground AoE; baseline to the DK specs and then modified by specialization/talents.
- **Raise Ally** — **30 Runic Power** — instant combat resurrection.
- **Path of Frost** — **1 Rune** — group water-walking utility.
- **Mind Freeze** — **0 resource** — class interrupt; short cooldown utility, not a Rune/RP spender.

Other major shared DK abilities such as Death Grip, Death's Advance, Anti-Magic Shell, Icebound Fortitude, Dark Command, Lichborne, and similar utility/defensive tools are **not Rune/RP spenders** and therefore are not included in the cost tables below except where their resource interaction is relevant.

## Rune spenders — Blood

- **Heart Strike** — **1 Rune** — primary Rune spender; cleaves and generates bonus Runic Power.
- **Marrowrend** — **2 Runes** — grants 3 Bone Shield charges and is the heavier Blood Rune spender.
- **Death and Decay** — **1 Rune** — ground AoE that also enables Blood's cleave interactions through talents.

## Rune spenders — Frost

- **Obliterate** — **2 Runes** — primary heavy melee Rune spender / single-target attack.
- **Howling Blast** — **1 Rune** — ranged Frost attack that applies Frost Fever; can become free through Rime.
- **Frostscythe** — **1 Rune** — AoE Frost strike used as an alternative to Obliterate through talents.
- **Remorseless Winter** — **1 Rune** — AoE/cooldown ability that deals repeated damage around the DK and slows enemies.
- **Death and Decay** — **1 Rune** — shared ground AoE utility/damage spell.

## Rune spenders — Unholy

- **Festering Strike** — **2 Runes** — heavy melee attack that advances the Unholy Lesser Ghoul / disease engine.
- **Scourge Strike** — **1 Rune** — core melee strike that interacts with Unholy resources and diseases.
- **Outbreak** — **1 Rune** — ranged disease application / multi-target disease opener.
- **Death and Decay** — **1 Rune** — ground AoE that enables cleave interactions with Scourge Strike through talents.

## Runic Power spenders — Blood

- **Death Strike** — **45 Runic Power** — primary defensive/healing spender.
- **Death Coil** — **30 Runic Power** — ranged Shadow damage dump; exists in the Blood spellbook but is generally an inefficient/rare RP dump for Blood.

## Runic Power spenders — Frost

- **Frost Strike** — **35 Runic Power** — primary single-target Runic Power spender.
- **Glacial Advance** — **30 Runic Power** — line-shaped AoE Runic Power spender.
- **Death Strike** — **45 Runic Power** — defensive/healing option available through the class tree.
- **Death Coil** — **30 Runic Power** — available as a generic DK RP dump, primarily relevant while leveling / before Frost's own spenders are available.

## Runic Power spenders — Unholy

- **Death Coil** — **30 Runic Power** — primary single-target Runic Power spender.
- **Epidemic** — **30 Runic Power** — AoE Runic Power spender.
- **Death Strike** — **45 Runic Power** — defensive/healing option available through the class tree.

## Important correction: Mind Freeze and Chains of Ice

The previous version of this reference incorrectly mixed class utility and specialization-specific abilities.

- **Chains of Ice is a shared Death Knight class ability.** It costs 1 Rune and is not a Blood/Unholy-specific spell.
- **Mind Freeze is a shared Death Knight class ability** and should be considered part of the base DK toolkit. It does **not** consume Rune or Runic Power.

## Resource-cost patterns worth using as Lichborn references

| Pattern | Reference cost | Useful comparison for Lichborn |
|---|---:|---|
| Standard Rune ability | **1 Rune** | Natural baseline for frequent Rune spending / Claim generation. |
| Heavy Rune ability | **2 Runes** | Useful baseline for a powerful button that can deliberately be less efficient at building Death's Claim. |
| Common RP single-target spender | **30–35 RP** | Natural reference range for a normal DPS/utility spender. |
| Heavy defensive RP spender | **45 RP** | Natural reference for a high-value defensive/utility effect. |
| Shared utility Rune spender | **1 Rune** | Useful comparison for things such as Chains of Ice / Path of Frost. |

## Core DK resource loop

The fundamental WoW Death Knight grammar is:

> **Spend Runes → generate Runic Power → spend Runic Power.**

Rune spending normally generates Runic Power at **10 RP per Rune spent**, although individual talents/abilities can add or modify resource generation. citeturn282201search1turn282201search2

Lichborn's proposed twist is to insert its signature disease into that familiar loop:

> **Spend Runes → build Death's Claim → generate Runic Power → use Runic Power to exploit Death's Claim.**

The current brainstorming direction is that **Mastery: Domination** determines the amount of Death's Claim applied when Rune-spending abilities are used.

The current preference is **not** to grant proportionally more Claim simply because an ability costs more Runes. A powerful 2-Rune ability should therefore be able to be stronger in immediate effect while being less efficient at building Death's Claim, preserving useful differences between single-target and AoE/resource patterns.

## Source notes

Current Midnight references used:

- Wowhead — Frost Death Knight Abilities and Talents, Patch 12.1.0.
- Wowhead — Blood Death Knight Abilities and Talents, Patch 12.1.0.
- Wowhead — Unholy Death Knight Abilities and Talents, Patch 12.1.0.
- Wowhead current spell data for Chains of Ice, Marrowrend, Heart Strike, Death Strike, Death Coil, Epidemic, Frost Strike, Glacial Advance, and Remorseless Winter.
- Icy Veins Midnight 12.1 spell summaries for Blood, Frost, and Unholy.

This file intentionally describes the **existing DK toolkit** rather than proposing that Lichborn should copy any of it.
