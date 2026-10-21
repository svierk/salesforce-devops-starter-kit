# The Five Questions

::: tip Just want the answer?
The [guided questionnaire](index.md#find-your-blueprint) asks all five, one at a time, and shows your path through the decision tree. This page is the reasoning behind the questions - read it if you want to argue with the routing rather than follow it.
:::

Each question is deliberately coarse - it is meant to narrow the field in a few minutes, not to model your organisation exactly. Record your answers; [Kit Mapping](mapping.md) turns them into a concrete configuration.

All five questions are always asked, in this order, so every path through the decision tree has the same length. An answer that cannot change the blueprint on your path still shapes the result. Question 1 comes first because your org landscape is an architecture decision your DevOps model has to follow, not the other way round - a multi-org shop lands on [B4](b4-multi-org-regional.md) whatever its other answers, and those answers then decide how to set B4 up. Within one org, questions 2-4 decide the blueprint; question 5 decides how you release on it - and, for [B2](b2-multi-team-environment-branches.md), which of its three variants you run.

## 1. Single-org or multi-org?

**(a) One production org** · **(b) Several production orgs (region, business unit, brand)**

This decides your repository topology and how far your pipeline fans out. One production org means one deployment target and one source of truth. Several production orgs mean the same change may need to land in each of them, at different times, with local variations - which pushes you toward shared packages or a shared metadata repository rather than shared branches.

Multi-org is a legitimate answer to divergent business processes, data residency and compliance boundaries, or org limits. It costs you unified reporting, cross-org reuse, and a multiple of the pipeline surface.

Do not answer (b) just because you have several _sandboxes_. This question is about production orgs - and it applies to a single team running several orgs just as much as to a large organisation.

> **(b)** → [B4](b4-multi-org-regional.md), regardless of the other answers. Question 4 then picks its shape: per-org environment chains while the practice matures, a trunk with a shared core at level 4.

## 2. How many teams or parallel workstreams?

**(a) One team, one stream** · **(b) Several teams or parallel feature streams**

Team count is the strongest driver of how many long-lived branches you need. A single stream can integrate directly on `main` - every merge is already the integration. Several streams need somewhere to collide _before_ production, which means an integration branch, and often a release branch to freeze scope while the next stream keeps moving.

Every additional long-lived branch costs you merge effort and XML conflict risk on profiles, permission sets and flows, permanently. Add one only when parallel streams genuinely force it.

> **(a)** → [B1](b1-simple-org-development.md), or [B5](b5-low-code-admin-first.md) if most of the work is declarative.
> **(b)** → [B2](b2-multi-team-environment-branches.md), or [B3](b3-modular-trunk.md) if the teams are ready for one trunk.

## 3. How is the team set up?

**(a) Mostly developers who are comfortable with Git** · **(b) Balanced, cross-functional** · **(c) Mostly admins and low-code builders**

Salesforce is unusual in that a large share of change is made by clicking in a browser, by people for whom a rebase is not a reasonable ask. The more of your team works that way, the more your strategy has to hide Git rather than expose it: fewer environments, more automation, retrieval assisted by tooling, and a model where nobody has to resolve an XML conflict by hand.

- **(a) Mostly developers** - pull requests and branches can be everyone's interface.
- **(b) Balanced** - developers and admins side by side, the most common setup. Git stays the shared source of truth; admins contribute through tooling - the Salesforce extensions for VS Code or DevOps Center - rather than through the command line.
- **(c) Mostly admins** - answer this if a majority of your changes originate declaratively _and_ those builders would have to touch Git themselves under the model you are considering.

> **(a)** or **(b)** with one team → [B1](b1-simple-org-development.md); **(c)** → [B5](b5-low-code-admin-first.md).
> With several teams the blueprint stays; **(b)** and **(c)** add tool-assisted contribution, and with **(c)** tooling does the promoting and the [working agreements of B5](b5-low-code-admin-first.md#working-agreements) apply.

## 4. How mature is your DevOps practice?

**(a) Level 1 - starting out** · **(b) Level 2-3 - established** · **(c) Level 4 - advanced**

- **Level 1** - deployments are manual or barely automated, tests run late, no metrics. Anything with four long-lived branches will collapse under its own weight.
- **Level 2-3** - CI runs on every pull request, deployments are scripted, delta deployments are in place, someone watches failure rates.
- **Level 4** - trunk-based or near it, feature flags decouple deploy from release, delivery metrics are tracked and improving.

Maturity sets both the _number_ of environments you can operate and the deployment mode you can sustain (full → delta → smart test selection). Counter-intuitively, higher maturity means **fewer** long-lived branches, not more. See [Dimensions](dimensions.md#maturity-signals) for the metrics behind this.

How modular your metadata is does not decide whether several teams can share a trunk - discipline and a blocking gate do. It decides what you ship from that trunk: one source tree, source modules or packages. That choice is made per module, inside [B3](b3-modular-trunk.md#what-you-ship).

> Several teams at **level 1** → [B2](b2-multi-team-environment-branches.md), but start with two stages and add more as the practice matures.
> Several teams at **level 2-3** → [B2](b2-multi-team-environment-branches.md). If the metadata is already modular, its [migration path to B3](b2-multi-team-environment-branches.md#migration-path) is short.
> Several teams at **level 4** → [B3](b3-modular-trunk.md) - you already work trunk-based.

## 5. How do you release?

**(a) Story by story, all the way to production** · **(b) Story by story to UAT, bundled into production** · **(c) Whole releases on planned dates**

This is not the same as how often you deploy. It asks how changes are batched on their way to production - one at a time, signed off one at a time but shipped together, or planned and tested as one release from the start.

- **(a) Story by story** - merging, or promoting a story to production, is the release decision. That needs a validation gate that genuinely blocks, and changes small and independent enough to ship one by one.
- **(b) Bundled into production** - stories are signed off individually, but production receives them together on a date. This is the most common pattern in practice: it keeps sign-off fine-grained and production changes predictable.
- **(c) Whole releases** - scope is planned and frozen per release, and the release is tested as one. That needs a place to freeze scope while the next release keeps moving: a release branch, a tag, or the stage in front of production.

> Several streams on one org → this picks the [B2](b2-multi-team-environment-branches.md) variant: **(a)** → story promotion, **(b)** → release bundle, **(c)** → release train.
> Everywhere else it does not change the blueprint, but it changes how you set it up - the questionnaire's result says how.

Package versions are not a fourth answer. They are an artifact, not a cadence - you can ship them in any of these three ways. Whether you package at all is decided per module in [B3](b3-modular-trunk.md#what-you-ship).

**Compliance is a separate matter.** If regulation (SOX and similar) requires that the author of a change is not the person who promotes it to production, add required reviewers to the GitHub Environment in front of production. That works with every release style and every blueprint - it maps onto environments, not onto extra branches.

## Putting it together

| Your answers (Q1-Q5)                                       | Blueprint                                                    |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| Multi-org · any · any · L1-3 · any                         | [B4](b4-multi-org-regional.md), per-org environment chains   |
| Multi-org · any · any · L4 · any                           | [B4](b4-multi-org-regional.md), trunk with a shared core     |
| Single-org · one team · developers or balanced · any · any | [B1](b1-simple-org-development.md)                           |
| Single-org · one team · low-code · any · any               | [B5](b5-low-code-admin-first.md)                             |
| Single-org · several · any · L1-3 · story by story         | [B2](b2-multi-team-environment-branches.md), story promotion |
| Single-org · several · any · L1-3 · bundled                | [B2](b2-multi-team-environment-branches.md), release bundle  |
| Single-org · several · any · L1-3 · whole releases         | [B2](b2-multi-team-environment-branches.md), release train   |
| Single-org · several · any · L4 · any                      | [B3](b3-modular-trunk.md)                                    |

At level 1, B2 starts with two stages. If your answers straddle two rows, pick the simpler blueprint and read the more complex one's migration section for what to watch for.
