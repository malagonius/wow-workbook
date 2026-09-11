# Lichborn — Death Knight Resource Reference

This is a **reference to the existing Death Knight resource grammar**, not a list of Lichborn abilities or design decisions.

The purpose is to keep the new spec grounded in actual WoW Death Knight gameplay and to give us existing Rune / Runic Power patterns to compare against while brainstorming.

Reference point: current Midnight-era Death Knight guides, Patch 12.1.0, checked September 2026.

> **Costs below are baseline/reference costs.** Talents, procs, and specialization effects can reduce, remove, or otherwise modify a spell's cost.

## Rune spenders

### Blood

- **Heart Strike** — **1 Rune** — primary Rune spender; melee damage and bonus Runic Power generation.
- **Marrowrend** — **2 Runes** — grants Bone Shield charges.
- **Chains of Ice** — **1 Rune** — class utility; applies a strong slow.

### Frost

- **Obliterate** — **2 Runes** — primary melee Rune spender / single-target attack.
- **Howling Blast** — **1 Rune** — ranged attack that applies Frost Fever; can become free through Rime.
- **Frostscythe** — **1 Rune** — AoE cone attack used as the alternative to Obliterate.

### Unholy

- **Festering Strike** — **2 Runes** — melee attack that advances the Unholy-specific disease/minion engine.
- **Scourge Strike** — **1 Rune** — melee strike that interacts with Unholy plagues / Lesser Ghouls.
- **Chains of Ice** — **1 Rune** — class utility; applies a strong slow.

## Runic Power spenders

### Shared / class-side

- **Death Strike** — **45 Runic Power** baseline — major defensive/healing spender; its exact effect depends on specialization.
- **Death Coil** — **40 Runic Power** — ranged Shadow spender; primarily used by Unholy, and available to other Death Knights for appropriate interactions.
- **Raise Ally** — **Runic Power** — combat resurrection utility. The exact baseline cost is intentionally recorded as resource-dependent here because class talents can modify/remove the cost.

### Frost

- **Frost Strike** — **Runic Power** — primary single-target Runic Power spender.
- **Glacial Advance** — **30 Runic Power** — line AoE Runic Power spender.

### Unholy

- **Death Coil** — **40 Runic Power** — primary single-target Runic Power spender.
- **Epidemic** — **30 Runic Power** — AoE Runic Power spender.

## Existing Rune / Runic Power patterns worth stealing

| Pattern | Reference cost | Why it matters for Lichborn |
|---|---:|---|
| Small / normal Rune attack | **1 Rune** | Natural baseline for frequent resource generation and rotation fillers. |
| Heavy Rune attack | **2 Runes** | Useful baseline for a powerful button that should generate less Death's Claim per Rune spent under our proposed Mastery idea. |
| RP single-target spender | **~40 RP** | Strong reference point for the Lichborn single-target Claim exploit. |
| RP AoE spender | **~30 RP** | Useful reference for an AoE Claim exploit. |
| Defensive RP spender | **~45 RP** | Shows that RP can support meaningful utility/survival rather than only DPS. |

## Other important resource interactions

- Spending Runes generally generates Runic Power, making the two resources form the classic DK resource cycle.
- Runic Power spending can feed back into Rune generation through effects such as **Runic Empowerment** or **Runic Corruption**, depending on specialization and talents.
- Some abilities can generate Runic Power without spending a Rune, so “Runic Power = only Rune output” should not be treated as a universal DK rule.
- Some Rune abilities cost more than one Rune but are intentionally more powerful; Rune cost does **not** universally imply that the ability is simply “better resource generation.”
- Talents and specialization mechanics can alter whether an ability consumes Runes, generates Runic Power, or becomes free.

## What matters for Lichborn

The useful existing WoW grammar is:

> **Spend Runes → generate Runic Power → spend Runic Power.**

Lichborn's proposed twist is to insert its signature disease into that familiar loop:

> **Spend Runes → build Death's Claim → generate Runic Power → use Runic Power to exploit Death's Claim.**

The current brainstorming direction for Lichborn is that **Mastery: Domination** determines how many stacks of Death's Claim are applied when Rune-spending abilities are used.

The current preference is **not** to grant proportionally more Claim simply because an ability costs more Runes. A powerful 2-Rune ability should therefore be able to be stronger in immediate effect while being less efficient at building Death's Claim, preserving useful differences between single-target and AoE/resource patterns.

## Source notes

Current Midnight references used:

- Wowhead — Frost Death Knight Abilities and Talents, Patch 12.1.0.
- Wowhead — Blood Death Knight Abilities and Talents, Patch 12.1.0.
- Wowhead — Unholy Death Knight Abilities and Talents, Patch 12.1.0.
- Current spell references for Obliterate, Scourge Strike, Festering Strike, Death Coil, and related resource costs.

This file intentionally describes the **existing DK toolkit** rather than proposing that Lichborn should copy any of it.
