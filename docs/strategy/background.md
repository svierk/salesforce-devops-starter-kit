# Background & Trade-Offs

The reasoning behind the [questionnaire](index.md) and the blueprints. Read this if you want to argue with a blueprint rather than adopt it.

## Why Salesforce is different

The choice of org landscape and branching model is harder on Salesforce than elsewhere. Sandboxes are licensed, metered and slow to refresh; there is no true rollback; declarative changes arrive from people who may never touch Git; and XML metadata merges badly. Copying a branching model from a web project rarely survives contact with those constraints - the sections below are the trade-offs the blueprints are built on.

## Sandbox types

Your branching model can never be richer than your sandbox budget. Each long-lived branch in an environment-style model needs an org behind it, and those orgs are licensed, sized and rate-limited.

| Type          | Storage (data / file)                                                                            | Contains               | Refresh interval |
| ------------- | ------------------------------------------------------------------------------------------------ | ---------------------- | ---------------- |
| Developer     | 200 MB / 200 MB                                                                                  | Metadata only          | 1 day            |
| Developer Pro | 1 GB / 1 GB                                                                                      | Metadata only          | 1 day            |
| Partial Copy  | 5 GB data, sampled via a template (up to 10,000 records per object) / file storage as production | Metadata + sample data | 5 days           |
| Full          | Same as production                                                                               | Metadata + all data    | 29 days          |

The **refresh interval** is the constraint people underestimate. A Full sandbox used as pre-production can only be brought back in line with production once every 29 days - so it drifts, and the drift is invisible until a deployment fails there and not in production. A failed release rehearsal in a Full sandbox cannot be repeated from a clean state within the same month, either.

Two platform features soften this. **Quick Clone** creates a new sandbox from a template sandbox instead of from production, which is much faster for short-lived test environments. **Data Mask & Seed** masks personal data in sandboxes and seeds them with realistic test data - an alternative to the template sampling of a Partial Copy.

::: warning Licences are edition-dependent
Sandbox entitlements ship with the edition, and the gap between editions is large. Enterprise Edition includes 25 Developer sandboxes and one Partial Copy but **not** Full or Developer Pro - those are a [paid add-on](https://www.salesforce.com/editions-pricing/platform/environments/), priced as a share of your net spend (at list price roughly 5 % for Developer Pro, 20 % for Partial Copy and 30 % for Full). Performance and Unlimited Edition include a Full sandbox and several Developer Pro sandboxes as standard.

Any blueprint below that asks for a Full-copy UAT or pre-production stage is therefore a **budget decision** on Enterprise Edition, not just a technical one. Entitlements change; confirm yours against [Salesforce Help](https://help.salesforce.com/s/articleView?id=platform.deploy_sandboxes_parent.htm&type=5) before you plan around them.
:::

Scratch orgs sidestep the entitlement question for development and CI - they are ephemeral, source-tracked and created from a definition file. They cannot replace a data-realistic UAT stage, because they start empty. Their limits come from the Dev Hub: Enterprise Edition allows 40 active scratch orgs and 80 new ones per day, Unlimited and Performance 100 and 200 ([Salesforce DX Developer Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs_editions_and_allocations.htm)). A scratch org lives 1 to 30 days, 7 by default.

## Single-org vs. multi-org

| Single-org fits                              | Multi-org fits                                |
| -------------------------------------------- | --------------------------------------------- |
| Standardised processes across the business   | Genuinely divergent processes per unit        |
| Unified reporting and a single customer view | Data residency or compliance boundaries       |
| Small to mid-size organisations              | Regional or BU autonomy, independent roadmaps |
| Maximum reuse of metadata and automation     | Avoiding hard org limits                      |

The cost of multi-org is data silos, harder cross-org reporting, and a pipeline that fans out. The cost of single-org is that every business unit shares one release cadence and one set of limits.

The established framing comes from operating-model theory - business process **integration** on one axis, **standardisation** on the other. High integration and high standardisation argue for as few orgs as possible; high autonomy on both argues for multi-org; standardised-but-independent units are the case for multi-org plus a shared managed or unlocked package carrying the common core. That last pattern is exactly [B4](b4-multi-org-regional.md).

## Org development vs. package development

|                  | Org Development Model                            | Package Development Model (2GP)                     |
| ---------------- | ------------------------------------------------ | --------------------------------------------------- |
| Unit of change   | Metadata in one "happy soup"                     | Versioned unlocked packages                         |
| Source of truth  | Version control                                  | Version control                                     |
| Develops against | Sandboxes                                        | Scratch orgs with source tracking                   |
| Release coupling | One release train                                | Packages release independently                      |
| Fits             | Single team, legacy orgs, declarative-heavy work | Several teams, modular metadata, decoupled roadmaps |

Between the two sits **modular source**: package directories in `sfdx-project.json`, deployed as source rather than built as package versions. It gives you most of the structure of package development without its build and promotion cost, and it is the default artifact in [B3](b3-modular-trunk.md#what-you-ship).

**When to switch:** growing org complexity, several teams or admins stepping on each other, and a wish to decouple a project from the big release train.

**What blocks the switch:**

- Not every metadata type is packageable. The [Metadata Coverage Report](https://developer.salesforce.com/docs/metadata-coverage) is the binding source - check it before committing, and re-check per release, because it moves.
- Dependencies. Org-dependent unlocked packages (`--org-dependent`) move dependency validation from build time to install time, which resolves "field does not exist" build failures against a loosely coupled org - at the price of losing "build once, install anywhere".
- Existing metadata rarely factors cleanly. Extracting the first package from a mature happy soup is the real cost, not the pipeline change.

## Branching models

| Model                                      | Shape                                                                                                      | Fits                                                                                                                                                                               | Watch out for                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **GitHub Flow / feature branch**           | `main` + short-lived `feature/*`                                                                           | Small teams, Git newcomers, [B1](b1-simple-org-development.md)                                                                                                                     | Nothing between a merge and production - production gating has to be a deployment gate |
| **Git Flow**                               | `main` + `develop` + release and hotfix branches                                                           | Structured sprint releases, larger teams                                                                                                                                           | Two permanent branches to keep in sync; heavy for most Salesforce teams                |
| **Environment branches - release train**   | One long-lived branch per org; the whole state moves stage to stage                                        | Planned release dates with approval gates, [B2](b2-multi-team-environment-branches.md#release-train)                                                                               | Permanent merge overhead - see the warning below                                       |
| **Environment branches - story promotion** | One long-lived branch per org; each story is merged into each stage through a short-lived promotion branch | Independent stories with approval gates, [B2](b2-multi-team-environment-branches.md#story-promotion); the model of Gearset Pipelines, and in principle of Copado and DevOps Center | Stages drift apart by design - sync them after every release                           |
| **Environment branches - release bundle**  | Story promotion up to UAT; from there, a release branch carries the signed-off stories as one bundle       | Sign-off per story, production on release dates, [B2](b2-multi-team-environment-branches.md#release-bundle); DevOps Center's "bundling stage"                                      | Stories are merged twice - per stage and into the release branch                       |
| **Trunk-based**                            | One branch + feature flags, modules or packages optional                                                   | High maturity, [B3](b3-modular-trunk.md)                                                                                                                                           | Requires real discipline and a quality gate that actually blocks                       |

::: warning Branch-per-org as an org mirror is an anti-pattern
Mapping one long-lived Git branch to each Salesforce org is the most common Salesforce branching model, and most teams adopt it without examining why. The model itself is workable. What fails is the version where promotions stop being reviewed pull requests and the branches become a copy of whatever is in each org - Git as a metadata backup rather than as a review mechanism.

What keeps it healthy is automation and discipline: every promotion a reviewed pull request, conflicts resolved in a defined place, and a regular sync so the branches cannot drift apart. DevOps platforms (Copado, Gearset Pipelines and similar) provide that out of the box; with GitHub Actions and this kit you provide it yourself - [B2](b2-multi-team-environment-branches.md) shows all three variants.

If you land on an environment-style model - [B2](b2-multi-team-environment-branches.md) or [B5](b5-low-code-admin-first.md) - adopt it deliberately and keep the number of stages to the minimum that your approval process actually requires.
:::

## Release styles

How you release is a separate choice from how you branch, and it narrows the branching options more than people expect. The [questionnaire](index.md) asks it last.

| Release style               | A release is                                              | Fits                                                                                                                                                                         |
| --------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Story by story**          | One change, shipped as soon as it is signed off           | [B1](b1-simple-org-development.md), [B2 story promotion](b2-multi-team-environment-branches.md#story-promotion), [B3](b3-modular-trunk.md), [B5](b5-low-code-admin-first.md) |
| **Bundled into production** | Stories signed off one by one, shipped together on a date | [B2 release bundle](b2-multi-team-environment-branches.md#release-bundle), [B3](b3-modular-trunk.md) with a tag per release date                                             |
| **Whole releases**          | A planned, frozen scope tested as one                     | [B2 release train](b2-multi-team-environment-branches.md#release-train), [B4](b4-multi-org-regional.md) rollouts per org                                                     |

Package versions are an artifact, not a release style - they can ship in any of the three ways. Whether to package is a question of modularity, covered in [B3](b3-modular-trunk.md#what-you-ship).

Release dates do not require release branches. In [B1](b1-simple-org-development.md), merging stays continuous and only the production deployment waits for the date - run it from a release tag or a manually triggered workflow, behind a GitHub Environment with required reviewers.

## Salesforce-specific pitfalls

These apply to every blueprint, and each one shapes at least one recommendation in this section.

- **There is no true rollback.** You can deploy a destructive change, but you cannot undo a deployment. Every blueprint needs a backup and recovery answer with a stated RPO/RTO - the pipeline does not provide one.
- **XML metadata merges badly.** Profiles, permission sets and flows are the usual casualties. Mitigate by keeping permissions in permission sets rather than profiles, by keeping long-lived branches few, and by using a Salesforce-aware merge driver where merges between long-lived branches are routine - the open-source [sf-git-merge-driver](https://github.com/scolladon/sf-git-merge-driver) merges profiles, permission sets, labels and value sets by key rather than line by line. Check its coverage for flows and layouts before relying on it there.
- **Declarative change arrives outside Git.** Someone will build a flow in a sandbox and expect it to reach production. The strategy has to name who retrieves it and when, or it will be deployed by hand.
- **Apex test runs are slow.** Long validation times push people to skip the gate. Mitigate with delta deployments (only changed metadata) and by scoping test levels to what the change can actually affect.
- **Feature flags decouple deployment from release.** Custom permissions plus custom metadata types are the common implementation. The simplest variant is still the best one for small teams: do not deploy a feature until it is needed.

## Maturity signals

The [DORA metrics](https://dora.dev/guides/dora-metrics/) are the standard vocabulary for Salesforce DevOps maturity, and the annual [State of Salesforce DevOps](https://gearset.com/blog/state-of-salesforce-devops-report/) reports track them for this ecosystem specifically:

| Metric                          | Question it answers                                          |
| ------------------------------- | ------------------------------------------------------------ |
| Deployment frequency            | How often do you ship to production?                         |
| Change lead time                | How long from commit to production?                          |
| Change fail rate                | What share of deployments causes a problem?                  |
| Failed deployment recovery time | How fast do you recover from one?                            |
| Deployment rework rate          | What share of deployments are unplanned fixes for incidents? |

Condensed into the four levels the [questionnaire](index.md) asks about:

1. **Starting out** - manual or lightly scripted deployments, no metrics, testing late.
2. **Automated** - CI on every pull request, scripted deployments, static analysis blocking.
3. **Measured** - delta deployments, tracked DORA metrics, deliberate environment strategy.
4. **Optimised** - trunk-based, feature-flagged, delivery metrics tracked and improving against your own baseline.

Use the metrics as **migration triggers**, not as a scoreboard. DORA itself no longer publishes industry performance tiers and warns against fixed targets and comparisons between teams - compare each team with its own baseline. Each blueprint page states which signals mean you are ready for the next one.

Two practices matter at every level and in every blueprint, independent of the branching model: **backups** with a stated recovery point and recovery time, because Salesforce has no rollback, and **observability** - knowing within hours, not weeks, that a deployment broke something. In the available survey data, a consistent release process, a consolidated toolchain, backups and observability track with delivery performance more clearly than any branching model does.

## Salesforce DevOps Center

Salesforce's free DevOps Center manages Git branches on the admin's behalf: a work item becomes a feature branch, and promotion happens through a UI rather than through Git. Since 2026 it is a native platform capability, enabled in Setup instead of installed as a managed package, and its pipeline can enforce quality gates - Apex and Flow tests, code coverage and Code Analyzer findings - before a promotion. That makes it a genuine successor to change sets and a reasonable on-ramp for [B5](b5-low-code-admin-first.md).

Its limits matter for the target architecture, though: it is built around org-based development rather than scratch orgs and packages, there is no rollback, its work items stand in for your issue tracker rather than connecting to it, and it copes poorly with merges made outside the tool. GitLab and Azure DevOps support and a Jira integration are announced but not yet available. The product is moving quickly - check [what is new in DevOps Center](https://admin.salesforce.com/blog/2026/the-future-of-salesforce-devops-is-here-whats-new-for-admins) before you rule it in or out. Treat it as an entry point, not a destination.
