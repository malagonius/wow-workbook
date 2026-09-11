# Lichborn — Death Knight Resource Reference

This is a **reference to the existing Death Knight resource grammar**, not a list of Lichborn abilities or design decisions.

The purpose is to keep the new spec grounded in actual WoW Death Knight gameplay and to give us existing Rune / Runic Power patterns to compare against while brainstorming.

Reference point: current Midnight-era Death Knight guides, Patch 12.1.0, checked September 2026.

## Rune spenders

### Blood

- **Heart Strike** — primary Rune spender; melee damage and bonus Runic Power generation.
- **Marrowrend** — Rune spender that grants Bone Shield charges.
- **Chains of Ice** — Rune-consuming utility ability that applies a strong slow.

### Frost

- **Obliterate** — primary melee Rune spender / single-target attack.
- **Howling Blast** — Rune-consuming ranged attack that applies Frost Fever.
- **Frostscythe** — specialization talent that replaces/serves as the AoE alternative to Obliterate.

### Unholy

- **Festering Strike** — Rune-consuming melee attack that supports the Unholy resource/disease engine.
- **Scourge Strike** — Rune-consuming melee attack.
- **Chains of Ice** — class utility Rune spender.

## Runic Power spenders

### Shared / class-side

- **Death Strike** — major Runic Power spender; the Blood defensive/repair interaction is its defining role.
- **Death Coil** — ranged Runic Power spender; primarily used by Unholy and available in other contexts where applicable.
- **Raise Ally** — Runic Power-consuming combat resurrection utility.

### Frost

- **Frost Strike** — primary single-target Runic Power spender.
- **Glacial Advance** — Runic Power-consuming line AoE attack.

### Unholy

- **Death Coil** — primary single-target Runic Power spender.
- **Epidemic** — Runic Power-consuming AoE spender.

## Other important resource interactions

- Spending Runes generally generates Runic Power, making the two resources form the classic DK resource cycle.
- Spending Runic Power can interact with Rune regeneration through effects such as **Runic Empowerment** / **Runic Corruption**, depending on specialization and talents.
- Some abilities can generate Runic Power without spending a Rune, so “Runic Power = only Rune output” should not be treated as a universal DK rule.
- Talents and specialization mechanics can alter whether an ability consumes Runes, generates Runic Power, or becomes free.

## What matters for Lichborn

The useful existing WoW grammar is:

> **Spend Runes → generate Runic Power → spend Runic Power.**

Lichborn's proposed twist is to insert its signature disease into that familiar loop:

> **Spend Runes → build Death's Claim → generate Runic Power → use Runic Power to exploit Death's Claim.**

This should remain the reference point while designing the spec.

## Source notes

Current Midnight references used:

- Wowhead — Frost Death Knight Abilities and Talents, Patch 12.1.0.
- Wowhead — Blood Death Knight Abilities and Talents, Patch 12.1.0.
- Wowhead — Unholy Death Knight Abilities and Talents, Patch 12.1.0.
- Blizzard's Midnight / pre-expansion notes were also checked for current Death Knight resource-related changes.

This file intentionally describes the **existing DK toolkit** rather than proposing that Lichborn should copy any of it.
