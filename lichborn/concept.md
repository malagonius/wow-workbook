# Lichborn — Concept

> **The longer the fight goes, the more inevitable your victory feels.**

## Core fantasy

The spec is about **dominating the enemy**.

The desired player fantasy is to feel like **Arthas / the next Lich King**: a slow, methodical juggernaut whose opponent becomes progressively less able to resist Death's will.

Core emotional premise:

> **Kill it before it kills you, because it will.**

The ultimate fantasy is not simply killing an enemy. It is making the enemy's defeat feel predetermined because the Lich has established an irreversible claim over it.

## WoW design constraints

This is a **World of Warcraft specialization**, not a tabletop subclass.

The concept must make sense across:

- **Raiding** — sustained single-target pressure and long encounters.
- **Mythic+** — practical multi-target gameplay, with priority targeting and optional cleave/spread tools.
- **PvP** — clear counterplay, meaningful utility, and effects that can be balanced rather than unconditional domination.

The overall design should follow **KISS (Keep It Simple)**. The core rotation should be easy to understand intuitively, in keeping with the goal of a simple modern WoW rotation.

## Central gameplay loop

The current strongest direction is:

**Use Runes → build Death's Claim → generate Runic Power → spend Runic Power.**

Death's Claim is the enemy-side accumulating disease/claim. It is **not itself the player's primary resource**.

Runes are used in the normal Death Knight resource relationship: spending Runes generates Runic Power and also contributes to building **Death's Claim** on enemies.

Runic Power is then spent on abilities whose potency is determined by the amount of Death's Claim on the target.

In simplified terms:

> **Rune → Death's Claim → Runic Power → Exploit Death's Claim.**

The player is therefore not trying to reach a literal “100% Dominion” meter. **100% domination is the fictional endpoint — victory/defeat — not a required percentage mechanic.**

## Death's Claim

**Death's Claim** is the current working name for the accumulating disease/debuff.

Core idea:

- It is applied/generated through the Rune portion of the rotation.
- It stacks upward over the course of an engagement.
- The stack count can become extremely large / theoretically indefinite rather than being a percentage toward a cap.
- It generally should not simply fall off on a short timer.
- The stack count determines how much power the Lich can extract from Runic Power abilities against that target.
- Death's Claim is currently envisioned as **persistent power scaling**, not as a second player resource that is constantly spent.

The important fantasy distinction is:

> **Death's Claim is the disease taking hold in the enemy. Runic Power is what the Lich uses to exploit that claim.**

## Exploiting Death's Claim

Runic Power spenders are the current proposed “Exploit” part of the loop.

A spender may be:

- **DPS** — dealing more damage against a target with more Death's Claim.
- **Utility** — stronger crowd control or other utility against a target with more Death's Claim.
- Potentially other expressions of the Lich's control, provided they remain understandable and balanceable in WoW.

The Death's Claim stack count acts as the **potency multiplier/scaling factor**, rather than requiring a separate domination percentage system.

Conceptually:

> **Low Claim:** Runic Power has limited influence.
>
> **High Claim:** the same Runic Power becomes terrifyingly powerful.

## Resource gameplay / Breath-like possibility

There is interest in a gameplay pattern inspired by the **Breath of Sindragosa** minigame:

- Continue generating Runic Power.
- Maintain a high Runic Power state rather than immediately dumping it.
- Use the high-Claim target to amplify the payoff.
- Create a satisfying “how long can I keep this going?” DPS challenge.

This should remain an **optional gameplay direction**, not an assumption that the entire spec must revolve around permanently hoarding Runic Power. The final design must preserve the KISS/simple-rotation goal.

## Multi-target / target switching

The target-switch problem is considered manageable within normal WoW specialization design rather than requiring a complicated core system.

Potential approaches include talent choices such as:

- **Outbreak-like spreading:** actively spread Death's Claim from one target to nearby targets.
- **Automatic cleave:** single-target gameplay remains the same while talents cause a percentage of relevant damage/effects to splash to nearby enemies.

Priority targeting can therefore remain part of optimization in high-end Mythic+, while less optimized players still have reasonable cleave options without manually maintaining many independent disease stacks.

This is intentionally a talent-design question rather than a reason to complicate the core rotation.

## Dominion

The word **Dominion** remains useful as the overall fantasy/theme of the spec, but it is currently **not a literal percentage resource**.

“100% Dominion” means nothing mechanically by itself. It simply describes the fictional endpoint: the enemy has been completely overcome / defeated.

The concrete mechanic should instead be **Death's Claim**, the accumulating disease.

The original idea that Dominion should directly represent loss of agency is still a useful fantasy direction, but any actual CC/control effects should be expressed through understandable WoW abilities rather than a hidden “domination percentage.”

## Existing-spec differentiation

- **Blood:** You cannot kill me.
- **Frost:** You cannot withstand me.
- **Unholy:** I bring death, decay, and undead.
- **Lichborn:** **You cannot escape what your death has already become.**

Another useful distinction:

- Unholy: **I have an army.**
- Lichborn: **You are supplying my army / your death belongs to me.**

Pets/undead are by-products and flavor, not the core gameplay objective.

## Current status

The current resource architecture is promising but **not yet frozen**.

Next design phase: brainstorm actual WoW abilities around the Rune → Death's Claim → Runic Power → Exploit loop, without committing to numbers, talents, or final spell names yet.
