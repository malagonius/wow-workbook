# Lichborn — Decisions

Decisions recorded here are ideas that have been explicitly established during brainstorming. They can be changed later if we deliberately revisit them.

## Frozen pillars

### 1. The spec is about dominion
The defining fantasy is **dominating the enemy**, not summoning an army.

### 2. Victory becomes more inevitable over time
The longer the Lich remains engaged with a target, the more the target is doomed.

### 3. Dominion is persistent
The core stacking state should not naturally disappear on a normal short timer. Distance/escape is an important counterplay vector.

### 4. Dominion is not a percentage meter
“100% domination” is the fictional endpoint of victory/defeat, not a gameplay resource or UI meter.

### 5. The signature disease is Death's Claim
**Death's Claim** is the working name for the accumulating enemy-side disease/state. It is intended to stack indefinitely rather than aiming toward a 100% cap.

### 6. The core resource loop uses the existing DK Rune → Runic Power structure
The current direction is:

> **Spend Runes → build Death's Claim + generate Runic Power → spend Runic Power to exploit Death's Claim.**

Runic Power is the player's actual resource. Death's Claim is the enemy-side scaling factor that makes Runic Power effects increasingly powerful against that target.

### 7. Death's Claim is not consumed by default
The current preferred direction is that Runic Power abilities **read the target's current Death's Claim stacks** to determine how much DPS or utility they provide. The Claim remains on the target.

This supersedes the earlier brainstorming idea of converting Claim into secondary stacking debuffs; that idea remains brainstorming only.

### 8. Mastery name: Domination
The working mastery name is **Domination**.

The intended player-facing wording is deliberately simple and WoW-like:

> **Your abilities that spend Runes apply Death's Claim based on your Mastery.**

The current design intent is that a Rune-spending ability applies Claim according to Mastery, while higher Rune-cost abilities do **not** automatically generate proportionally more Claim. The exact formula is intentionally not locked yet.

### 9. The spec should have a deliberately slower action cadence
As a thematic counterweight to its “eventual victory” fantasy, the spec is intended to have a **slower-than-normal action/GCD cadence**. The user proposed halving its GCDs as a starting concept.

The exact value is **not locked**. The design principle is more important than the number:

> **Lichborn should feel deliberate and slow rather than hyperactive.**

### 10. KISS / Midnight design constraint
The spec should have a **very simple and intuitive core rotation**, appropriate to WoW and the user's Midnight-era goal. Complexity should come from meaningful choices and optional talent paths, not from maintaining many independent stacks, meters, or bookkeeping systems.

### 11. Multi-target handling should remain simple
M+ and PvP target switching should not force the core spec to become cumbersome. Optional talents may provide:

- An Outbreak-like way to spread Death's Claim.
- Automatic cleave/splash so normal players can simply single-target while nearby enemies are affected.

These are talent directions, not finalized spells.

### 12. Breath-of-Sindragosa-style resource tension is an interesting possible play pattern
The spec may eventually have a damage path where maintaining a high Runic Power state is valuable, creating a Breath of Sindragosa-like “keep the resource alive” minigame.

This is **not yet a required part of the core rotation** and should not make the basic spec overly complicated.

## Design guardrails

- Do not accidentally recreate Unholy's undead-army identity.
- Do not make the spec simply Deathbringer 2.0.
- Do not make domination feel like generic crowd control with different names.
- Do not turn Death's Claim into a conventional stacking DoT whose only purpose is damage.
- Do not overcommit to literal mind control before determining what is balanceable.
- Keep the baseline gameplay simple enough for WoW PvP, M+, and raiding.

## Process decision

Brainstorming proceeds **one high-impact question at a time**. We record the answer before moving on so the design context is not lost between conversations.
