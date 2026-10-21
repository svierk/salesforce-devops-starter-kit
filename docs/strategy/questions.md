# The Five Questions

::: tip Just want the answer?
The [guided questionnaire](index.md#find-your-blueprint) asks these one at a time, skips the ones that cannot change your outcome, and shows your path through the decision tree. This page is the reasoning behind the questions - read it if you want to argue with the routing rather than follow it.
:::

Each question is deliberately coarse - it is meant to narrow the field in a few minutes, not to model your organisation exactly. Record your answers; [Kit Mapping](mapping.md) turns them into a concrete configuration.

The order matters. Question 1 comes first because your org landscape is an architecture decision your DevOps model has to follow, not the other way round - a multi-org shop lands on [B4](b4-multi-org-regional.md) whatever its other answers, so the questionnaire stops asking. Within one org, questions 2-4 decide the blueprint; question 5 decides how you release on it - and, for [B2](b2-multi-team-environment-branches.md), which of its two variants you run.

## 1. Single-org or multi-org?

**(a) One production org** · **(b) Several production orgs (region, business unit, brand)**

This decides your repository topology and how far your pipeline fans out. One production org means one deployment target and one source of truth. Several production orgs mean the same change may need to land in each of them, at different times, with local variations - which pushes you toward shared packages or a shared metadata repository rather than shared branches.

Multi-org is a legitimate answer to divergent business processes, data residency and compliance boundaries, or org limits. It costs you unified reporting, cross-org reuse, and a multiple of the pipeline surface.

Do not answer (b) just because you have several _sandboxes_. This question is about production orgs - and it applies to a single team running several orgs just as much as to a large organisation.

> **(b)** → [B4](b4-multi-org-regional.md), regardless of the other answers.

## 2. How many teams or parallel workstreams?

**(a) One team, one stream** · **(b) Several teams or parallel feature streams**

Team count is the strongest driver of how many long-lived branches you need. A single stream can integrate directly on `main` - every merge is already the integration. Several streams need somewhere to collide _before_ production, which means an integration branch, and often a release branch to freeze scope while the next stream keeps moving.

Every additional long-lived branch costs you merge effort and XML conflict risk on profiles, permission sets and flows, permanently. Add one only when parallel streams genuinely force it.

> **(a)** → toward [B1](b1-simple-org-development.md), or [B5](b5-low-code-admin-first.md) if much of the work is declarative.
> **(b)** → toward [B2](b2-multi-team-environment-branches.md), or [B3](b3-package-based-modular.md) if the metadata is modular.

## 3. Pro-code or low-code and admin share?

**(a) Mostly developers who are comfortable with Git** · **(b) Many admins and low-code builders without Git**

Salesforce is unusual in that a large share of change is made by clicking in a browser, by people for whom a rebase is not a reasonable ask. If that describes your team, your strategy has to hide Git rather than expose it: fewer environments, more automation, retrieval assisted by tooling, and a model where nobody has to resolve an XML conflict by hand.

Answer (b) if a majority of your changes originate declaratively _and_ those builders would have to touch Git themselves under the model you are considering.

> **(b)** with one team → [B5](b5-low-code-admin-first.md).
> **(b)** with several teams → the blueprint stays, but tooling does the promoting, and the [working agreements of B5](b5-low-code-admin-first.md#working-agreements) apply.

## 4. How mature is your DevOps practice, and how modular is your metadata?

Two separate answers - a mature team can work on a tangled org, and a well-structured org can be run by a team that is only starting out.

**Maturity:** **(a) Level 1 - starting out** · **(b) Level 2-3 - established** · **(c) Level 4 - advanced**

- **Level 1** - deployments are manual or barely automated, tests run late, no metrics. Anything with four long-lived branches will collapse under its own weight.
- **Level 2-3** - CI runs on every pull request, deployments are scripted, delta deployments are in place, someone watches failure rates.
- **Level 4** - trunk-based or near it, feature flags decouple deploy from release, delivery metrics are tracked and improving.

Maturity sets both the _number_ of environments you can operate and the deployment mode you can sustain (full → delta → smart test selection). Counter-intuitively, higher maturity means **fewer** long-lived branches, not more. See [Dimensions](dimensions.md#maturity-signals) for the metrics behind this.

**Modularity:** **(a) Modular - the metadata factors into separable parts in practice** · **(b) Not yet - one interwoven "happy soup"**

Packaging is what removes long-lived branches, and it needs metadata that genuinely splits apart - not just on a whiteboard. This only matters once the basics are in place, so the questionnaire skips it at level 1.

> Several teams at **level 1** → [B2](b2-multi-team-environment-branches.md), but start with two stages and add more as the practice matures.
> Several teams, **level 2 or higher**, **modular** → [B3](b3-package-based-modular.md); **not yet** → [B2](b2-multi-team-environment-branches.md).

## 5. How do you release?

**(a) Continuously - each change ships as soon as it is ready** · **(b) On planned release dates - changes ship together** · **(c) As versioned packages - a release is a new package version**

This is not the same as how often you deploy. It asks what a release _is_ for you: a single change that is ready, a dated bundle with a frozen scope, or a package version with its own number.

- **(a) Continuously** - merging, or promoting a story to production, is the release decision. That needs a validation gate that genuinely blocks, and changes small and independent enough to ship one by one.
- **(b) On release dates** - changes collect in front of production and ship together. That needs a place to freeze scope while the next release keeps moving: a release branch, a tag, or the stage in front of production.
- **(c) As versioned packages** - a release is a promoted package version, installed org by org. That needs modular metadata; it is the model of [B3](b3-package-based-modular.md) and of the shared core in [B4](b4-multi-org-regional.md).

> Several streams on one org → this picks the [B2](b2-multi-team-environment-branches.md) variant: **(a)** → story promotion, **(b)** → release train. **(c)** without modular metadata points at B3 as the destination - run the release train until you get there.
> Everywhere else it does not change the blueprint, but it changes how you set it up - the questionnaire's result says how.

**Compliance is a separate matter.** If regulation (SOX and similar) requires that the author of a change is not the person who promotes it to production, add required reviewers to the GitHub Environment in front of production. That works with every release style and every blueprint - it maps onto environments, not onto extra branches.

## Putting it together

| Your answers (Q1-Q5)                                           | Blueprint                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| Single-org · one team · pro-code · any · continuous            | [B1](b1-simple-org-development.md)                           |
| Single-org · one team · low-code · any · any                   | [B5](b5-low-code-admin-first.md)                             |
| Single-org · several · any · L1 · any                          | [B2](b2-multi-team-environment-branches.md), two stages      |
| Single-org · several · any · L2+, not modular · release dates  | [B2](b2-multi-team-environment-branches.md), release train   |
| Single-org · several · any · L2+, not modular · story by story | [B2](b2-multi-team-environment-branches.md), story promotion |
| Single-org · several · any · L2+, modular · packages           | [B3](b3-package-based-modular.md)                            |
| Multi-org · any                                                | [B4](b4-multi-org-regional.md)                               |

If your answers straddle two rows, pick the simpler blueprint and read the more complex one's migration section for what to watch for.
