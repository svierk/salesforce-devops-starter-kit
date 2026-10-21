# The Five Questions

::: tip Just want the answer?
The [guided questionnaire](index.md#find-your-blueprint) asks these one at a time, skips the ones that cannot change your outcome, and shows your path through the decision tree. This page is the reasoning behind the questions - read it if you want to argue with the routing rather than follow it.
:::

Each question is deliberately coarse - it is meant to narrow the field in a few minutes, not to model your organisation exactly. Record your answers; [Kit Mapping](mapping.md) turns them into a concrete configuration.

The order matters: question 1 has by far the strongest effect on the shape of the result, question 5 the weakest. Questions 1-4 decide the blueprint; question 5 decides your approval gates. Depending on your answers, some questions become irrelevant - a multi-org shop lands on [B4](b4-multi-org-regional.md) whatever its packaging maturity, so the questionnaire stops asking.

## 1. How many teams or parallel workstreams?

**(a) One team, one stream** · **(b) Several teams or parallel feature streams**

Team count is the strongest driver of how many long-lived branches you need. A single stream can integrate directly on `main` - every merge is already the integration. Several streams need somewhere to collide _before_ production, which means an integration branch, and often a release branch to freeze scope while the next stream keeps moving.

Every additional long-lived branch costs you merge effort and XML conflict risk on profiles, permission sets and flows, permanently. Add one only when parallel streams genuinely force it.

> **(a)** → toward [B1](b1-simple-org-development.md), or [B5](b5-low-code-admin-first.md) if much of the work is declarative.
> **(b)** → toward [B2](b2-multi-team-release-branches.md), or [B3](b3-package-based-modular.md) if the metadata is modular.

## 2. Single-org or multi-org?

**(a) One production org** · **(b) Several production orgs (region, business unit, brand)**

This decides your repository topology and how far your pipeline fans out. One production org means one deployment target and one source of truth. Several production orgs mean the same change may need to land in each of them, at different times, with local variations - which pushes you toward shared packages rather than shared branches.

Multi-org is a legitimate answer to divergent business processes, data residency and compliance boundaries, or org limits. It costs you unified reporting, cross-org reuse, and a multiple of the pipeline surface.

Do not answer (b) just because you have several _sandboxes_. This question is about production orgs.

> **(b)** → [B4](b4-multi-org-regional.md), regardless of most other answers.

## 3. Pro-code or low-code and admin share?

**(a) Mostly developers who are comfortable with Git** · **(b) Many admins and low-code builders without Git**

Salesforce is unusual in that a large share of change is made by clicking in a browser, by people for whom a rebase is not a reasonable ask. If that describes your team, your strategy has to hide Git rather than expose it: fewer environments, more automation, retrieval assisted by tooling, and a model where nobody has to resolve an XML conflict by hand.

Answer (b) if a majority of your changes originate declaratively _and_ those builders would have to touch Git themselves under the model you are considering.

> **(b)** with a small team → [B5](b5-low-code-admin-first.md).

## 4. What is your DevOps maturity?

**(a) Level 1 - starting out** · **(b) Level 2-3 - established** · **(c) Level 4 - advanced**

Roughly:

- **Level 1** - deployments are manual or barely automated, tests run late, no metrics. Anything with four long-lived branches will collapse under its own weight.
- **Level 2-3** - CI runs on every pull request, deployments are scripted, delta deployments are in place, someone watches failure rates.
- **Level 4** - trunk-based or near it, feature flags decouple deploy from release, deployment frequency and lead time are measured and healthy.

Maturity sets both the _number_ of environments you can operate and the deployment mode you can sustain (full → delta → smart test selection). Counter-intuitively, higher maturity means **fewer** long-lived branches, not more. See [Dimensions](dimensions.md#maturity-signals) for the metrics behind this.

## 5. Release cadence and compliance?

**(a) Continuous or on demand** · **(b) Fixed release trains, approval gates, segregation of duties**

This decides whether you need release branches, approval environments, and gates that a pipeline cannot self-serve past. Regulated environments (SOX and similar) typically require that the person who wrote a change is not the person who promotes it to production - which maps onto GitHub Environments with required reviewers rather than onto extra branches.

> **(b)** → keep a dedicated pre-production stage and a protected production environment in whichever blueprint you land on.

## Putting it together

| Your answers (Q1-Q5)                                  | Blueprint                               |
| ----------------------------------------------------- | --------------------------------------- |
| One team · single-org · either · L1 · continuous      | [B1](b1-simple-org-development.md)      |
| Several · single-org · pro-code · L2-3 · fixed trains | [B2](b2-multi-team-release-branches.md) |
| Several · single-org · pro-code · L3-4 · continuous   | [B3](b3-package-based-modular.md)       |
| Several · multi-org · pro-code · L3-4 · mixed         | [B4](b4-multi-org-regional.md)          |
| One or few · single-org · low-code · L1-2 · mixed     | [B5](b5-low-code-admin-first.md)        |

If your answers straddle two rows, pick the simpler blueprint and read the more complex one's migration section for what to watch for.
