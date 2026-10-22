---
description: "Several teams sharing one production org - environment branches with story promotion, release bundles or a release train, and approval gates per stage."
---

# B2 - Multi-Team with Environment Branches

Several streams, one long-lived Git branch per org, and an explicit release decision. The classic enterprise Salesforce setup - and the one that costs the most to operate, so adopt it only for the stages your approval process actually requires.

The environment branches are the same in every variant. What differs is **what travels between them**, and that follows from [how you release](background.md#release-styles):

- **[Release train](#release-train)** - the whole state of a branch moves up the chain, stage by stage, on planned release dates. It is the default model of the open-source [sfdx-hardis](https://sfdx-hardis.cloudity.com/salesforce-devops-deploy-major-branches/).
- **[Story promotion](#story-promotion)** - every user story travels on its own, into each stage through a short-lived promotion branch, and reaches production when it is ready. [Gearset Pipelines](https://docs.gearset.com/en/articles/6115722-the-gearset-pipelines-branching-model) implements it almost exactly; Copado and DevOps Center follow the same principle with different mechanics. Here it runs on plain GitHub and the kit's workflows.
- **[Release bundle](#release-bundle)** - stories travel one by one up to UAT, where they are signed off individually; on the release date, a release branch carries the signed-off stories as one bundle through pre-production into production. DevOps Center builds the same idea in as a "bundling stage".

::: tip In short
For **several teams sharing one production org** with approval gates. One long-lived branch per org - `integration`, `uat`, `preprod`, `main` - and changes promoted story by story, as a bundle on release dates, or as a whole release train. Switch on PR validation on every environment branch and one deployment per branch, each with its own GitHub Environment. **Watch out:** merge overhead and drift grow with every stage - keep only the stages your approvals need.
:::

## At a glance

|                   |                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Team size**     | 5-25 developers and admins across several streams                                                                          |
| **Environments**  | Integration + UAT + pre-production + production                                                                            |
| **Branch model**  | Four environment branches: `integration`, `uat`, `preprod`, `main`                                                         |
| **Release style** | Story promotion: story by story · Release bundle: per story to UAT, bundled into production · Release train: release dates |
| **Maturity**      | Level 2-3 - at level 1, start with two stages (see below)                                                                  |
| **Prerequisites** | Sandbox budget - see the licence warning below                                                                             |

## Three ways to promote

|                            | Story promotion                                                 | Release bundle                                                                  | Release train                                   |
| -------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------- |
| What moves                 | One user story, separately into each stage                      | One story at a time up to UAT; from there, the signed-off stories as one bundle | The whole state of a branch                     |
| Feature branches start at  | `main` - the production state                                   | `main` - the production state                                                   | `integration`                                   |
| Stage-to-stage merges      | Never - environment branches are not merged into each other     | Never - up to UAT per story, from there one release branch per date             | Yes, strictly up the chain                      |
| Deployment between stages  | Delta - only what the story brought                             | Delta - the story, then the bundle                                              | Full                                            |
| A story that is not ready  | Holds only itself                                               | Stays out of the bundle and waits for the next date                             | Holds the train, or has to be backed out        |
| Where conflicts are solved | In the story's promotion branch, once per stage                 | In promotion branches up to UAT, then once more in the release branch           | In the target branch, once per hop              |
| Urgent fixes               | A story like any other, promoted only as far as it needs        | A story promoted straight on, or a small bundle of its own                      | Separate hotfix path with a hard constraint     |
| Fits                       | Continuous delivery of independent stories, with approval gates | Sign-off per story, production on release dates                                 | Planned release dates, scope frozen per release |

If stories should reach production as soon as they are signed off, run story promotion. If stories are signed off one by one but production gets them on dates, run the release bundle. If whole releases are planned and tested as one, run the train. Switching later does not touch the orgs or the environment branches - only how changes travel between them.

## Target picture

### Release train

```mermaid
flowchart LR
    subgraph BUILD["BUILD stream"]
      F1["feature/story-123"]
      F2["feature/story-456"]
    end
    subgraph RUN["RUN stream"]
      HF["hotfix/prod-issue"]
    end

    INT["integration<br/><i>Integration Sandbox</i>"]
    UAT["uat<br/><i>UAT Sandbox (Partial/Full)</i>"]
    PP["preprod<br/><i>PreProd Sandbox (Full)</i>"]
    MAIN["main<br/><i>Production</i>"]

    F1 -->|"PR + delta deploy"| INT
    F2 -->|"PR + delta deploy"| INT
    INT -->|"promote (full deploy)"| UAT
    UAT -->|"promote (full deploy)"| PP
    PP -->|"promote (full deploy)"| MAIN
    HF -->|"PR"| PP
    MAIN -.->|"retrofit branch"| INT

    classDef org fill:#dde4f9,stroke:#1d4ed8,color:#0b1a4a;
    classDef branch fill:#ebe4fa,stroke:#5b21d6,color:#24104f;
    class INT,UAT,PP,MAIN org;
    class F1,F2,HF branch;
```

### Story promotion

```mermaid
flowchart LR
    F["feature/story-123<br/><i>branched from main</i>"]

    P1["promotion/<br/>story-123-integration"]
    P2["promotion/<br/>story-123-uat"]
    P3["promotion/<br/>story-123-preprod"]

    INT["integration<br/><i>Integration Sandbox</i>"]
    UAT["uat<br/><i>UAT Sandbox (Partial/Full)</i>"]
    PP["preprod<br/><i>PreProd Sandbox (Full)</i>"]
    MAIN["main<br/><i>Production</i>"]

    F -->|"merge"| P1
    F -->|"merge"| P2
    F -->|"merge"| P3
    P1 -->|"PR + delta deploy"| INT
    P2 -->|"PR + delta deploy"| UAT
    P3 -->|"PR + delta deploy"| PP
    F -->|"PR + delta deploy"| MAIN

    classDef org fill:#dde4f9,stroke:#1d4ed8,color:#0b1a4a;
    classDef branch fill:#ebe4fa,stroke:#5b21d6,color:#24104f;
    class INT,UAT,PP,MAIN org;
    class F,P1,P2,P3 branch;
```

### Release bundle

```mermaid
flowchart LR
    F1["feature/story-123"]
    F2["feature/story-456"]

    INT["integration<br/><i>Integration Sandbox</i>"]
    UAT["uat<br/><i>UAT Sandbox (Partial/Full)</i>"]
    REL["release/2026-11<br/><i>branched from main</i>"]
    PP["preprod<br/><i>PreProd Sandbox (Full)</i>"]
    MAIN["main<br/><i>Production</i>"]

    F1 -->|"promotion branches"| INT
    F1 -->|"promotion branches"| UAT
    F2 -->|"promotion branches"| INT
    F2 -->|"promotion branches"| UAT
    F1 -->|"signed off: merge"| REL
    F2 -->|"signed off: merge"| REL
    REL -->|"PR + delta deploy"| PP
    REL -->|"PR + delta deploy"| MAIN

    classDef org fill:#dde4f9,stroke:#1d4ed8,color:#0b1a4a;
    classDef branch fill:#ebe4fa,stroke:#5b21d6,color:#24104f;
    class INT,UAT,PP,MAIN org;
    class F1,F2,REL branch;
```

## Org & sandbox landscape

One sandbox per environment branch:

| Branch        | Org            | Sandbox type         | Why                                                    |
| ------------- | -------------- | -------------------- | ------------------------------------------------------ |
| `integration` | Integration    | Developer Pro        | Where streams collide first; metadata only is enough   |
| `uat`         | UAT            | Partial Copy or Full | Business sign-off needs realistic data                 |
| `preprod`     | Pre-production | Full                 | Last rehearsal - as close to production as you can get |
| `main`        | Production     | -                    | -                                                      |

Plus Developer sandboxes or scratch orgs per developer for building.

::: tip Starting out? Begin with two stages
At maturity level 1, four long-lived branches collapse under their own weight. Start with `uat` and `main` only - the pull request into `uat` is where streams collide, and the UAT sign-off is your gate. Add `integration` once CI runs on every pull request, and `preprod` only when a release rehearsal on production-like data is genuinely required.
:::

::: warning This is the expensive blueprint
On Enterprise Edition, Full and Developer Pro sandboxes are a paid add-on. Before committing to four stages, price the entitlement - and ask whether UAT on a Partial Copy would be enough, which is often the case. A stage nobody signs off in is pure overhead. See [Background](background.md#sandbox-types).
:::

Remember the refresh intervals: a Full sandbox can only be refreshed every 29 days, so `preprod` drifts from production between refreshes. Schedule the refresh, and treat "it worked in preprod" as evidence, not proof.

## Branch model

**Environment branches** are long-lived, protected, and each bound to one org: `integration`, `uat`, `preprod`, `main`. Each one describes what its org should contain.

**Short-lived branches** carry the work and are deleted once merged. Which ones you use depends on the variant.

### Release train

`feature/*` and `hotfix/*` are the short-lived branches. Make `integration` the repository's default branch - it is where feature work targets.

**Merge direction is strictly one way**, up the chain. Deployment mode differs by hop:

- **Feature → environment** (`feature/*` → `integration`): **delta** deployment. Only what the branch changed.
- **Environment → environment** (`integration` → `uat` → …): **full** deployment. The promoted state is the whole branch, and a delta here would silently skip anything a previous hop missed.

Two streams share the chain:

- **BUILD** - normal features, entering at `integration` and traversing all four stages.
- **RUN** - urgent fixes, entering at `preprod` and reaching `main` in two hops.

::: danger The RUN stream has a hard constraint
While a release is being validated in `preprod`, the RUN stream cannot deploy to production without shipping that unvalidated release with it. Either your pre-production validation window is short, or your hotfix path is blocked for its duration. Decide which, in advance, and write it down.
:::

After a hotfix reaches `main`, **retrofit** it back into the BUILD stream: branch from `main`, open a pull request into `integration`. Do this immediately - a retrofit deferred by a week is a merge conflict on a flow you no longer remember. Where retrofits are routine, a Salesforce-aware merge driver is worth the setup.

### Story promotion

`feature/*` branches start from **`main`**, so a story carries the production state plus its own change - nothing that is still in flight in a lower stage. Keep `main` as the default branch.

Environment branches are **never merged into each other**. A story reaches each stage on its own, through a **promotion branch**: a short-lived branch cut from the target environment branch, holding exactly one story for exactly one stage. (Some tools use the term differently - sfdx-hardis, for example, calls a cherry-picked partial release a promotion branch.)

For each stage:

1. Create a promotion branch from the target environment branch, e.g. `promotion/story-123-uat` from `uat`.
2. Merge the feature branch into it. Resolve conflicts **here**, so the feature branch stays clean for the next stage.
3. Open a pull request into the environment branch. Once merged, the stage deploys the delta - exactly what the merge brought in.
4. Delete the promotion branch.

```bash
git switch -c promotion/story-123-uat origin/uat
git merge --no-ff origin/feature/story-123   # resolve conflicts on this branch
git push -u origin promotion/story-123-uat
gh pr create --base uat --title "Promote story-123 to uat"
```

To production, the feature branch itself goes into `main` - through a promotion branch only if it conflicts. An urgent fix is simply a story that is promoted only as far as it has to go, typically `uat` and then `main`, without waiting for anything else.

**Sync after every release.** Each stage holds a different set of stories, so the environment branches drift apart by design. After each production deployment, merge `main` back into every environment branch through a pull request. It keeps each stage at "production plus the stories in flight", and it stops the same conflict from coming back at every stage. Do not replace it with story-by-story back-merges: those carry a story's own commits, but not the merge commits on `main`, which then resurface later as unexplained differences.

### Release bundle

Up to `uat`, stories travel exactly as in [story promotion](#story-promotion-1): feature branches from `main`, one promotion branch per story and stage. On the release date the bundle takes over:

1. Cut `release/<date>` from `main`.
2. Merge every story that passed its UAT sign-off into it. Conflicts between the stories of this release are solved here, once.
3. Open a pull request into `preprod`. Once the rehearsal passes, open the next one from the same release branch into `main`.
4. Delete the release branch, and sync `main` back into every environment branch as in story promotion.

What reaches `preprod` is byte for byte what reaches `main` - the gap story promotion leaves between test stage and production closes at the last two stages. A story that misses its sign-off simply stays out of the bundle and waits for the next date.

## Promotion path & roles

| Role            | Release train                                                                              | Story promotion                                                           |
| --------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Developer       | Builds in a dev sandbox, commits to `feature/*`, opens a PR into `integration`             | Builds, then promotes the story into `integration` and the test stages    |
| Tech lead       | Reviews PRs into `integration`, keeps the branch green                                     | Reviews the story's first promotion and its PR into `main`                |
| Release manager | Owns the stage-to-stage promotions, decides what enters the train, runs the approval gates | Decides which stories enter `preprod` and `main`, runs the approval gates |
| Business owner  | Signs off in UAT - the gate that justifies the stage existing                              | Signs off each story in UAT                                               |

The **release bundle** follows the story promotion roles up to `uat`; from there, the release manager owns the release branch and decides which signed-off stories go into it.

Grant merge rights on `uat`, `preprod` and `main` to the release manager role only. `integration` stays open to the team - that is the point of having it.

## Strengths

- Clear stage gates with a named owner per gate.
- Maps onto approval and segregation-of-duties requirements without inventing process.
- **Release train:** conflicts surface in `integration`, early and cheaply, rather than during a release. BUILD and RUN separate cleanly, so an urgent fix does not have to wait for the train.
- **Story promotion:** stories move independently - one that fails UAT holds nobody else back. `main` only ever receives stories, never the leftovers of a lower stage. Urgent fixes need no special path.
- **Release bundle:** sign-off stays per story, yet production receives exactly the bundle that was rehearsed in `preprod`. A story that is not ready never blocks the date.

## Trade-offs & anti-patterns

- **Four long-lived branches is real, permanent overhead.** Every promotion is a merge, and XML metadata merges badly. This is the cost you are paying for the gates - make sure you are getting them.
- **Do not degrade into branch-per-org as backup.** If promotions stop being reviewed pull requests and become "sync the branch to what is in the org", you have lost the model's only real benefit. See the [warning in Dimensions](background.md#branching-models).
- **Do not add a fifth stage.** If something needs another environment, it usually needs feature flags instead.
- **Drift is the silent failure mode.** Orgs receive changes outside the pipeline; each one makes the next promotion less predictable.
- **Release train: do not test large features directly in `preprod`.** It blocks the RUN stream and skips the UAT gate.
- **Story promotion: what you tested is not byte for byte what you ship.** Each stage resolves its own conflicts, so `uat` and `main` can differ in more than the stories they hold. The sync after every release keeps that gap small; skipping it makes it grow.
- **Story promotion: dependent stories need a rule.** If story B builds on story A, promoting B alone breaks the stage. Once a dependency is known, combine the two into one feature branch and promote them together - "promote A first" fails as soon as A is held back.
- **Story promotion and release bundle: deltas hide gaps.** Every stage only ever receives deltas, and a delta can pass where a full deployment of the same branch would fail - a deleted picklist value that is still referenced, for example. Run a full check-only deployment of every environment branch into its org regularly - weekly is enough. The [weekly full validation](#kit-mapping) under Kit mapping does exactly that.
- **Release bundle: stories are merged twice.** Once per stage up to `uat`, then again into the release branch - conflicts can need solving at both points. Small, independent stories keep that cheap.
- **Story promotion: do not promote by hand at scale.** Four promotion branches per story is toil. Let [`promote.yml`](/workflows/promote) do it - see Kit mapping.

## Kit mapping

**Validation on every environment branch** - [`pr-validation.yml`](/workflows/pr-validation) as a required check for pull requests into all four, with delta validation against the org behind the target branch. In story promotion, these are the pull requests from the promotion branches - each one validates the story merged with that stage's state, in that stage's org:

```yaml
name: PR Validation

on:
  pull_request:
    branches: [integration, uat, preprod, main]

permissions:
  contents: read
  security-events: write

jobs:
  validate:
    uses: svierk/salesforce-devops-starter-kit/.github/workflows/pr-validation.yml@v1.3.0
    with:
      source-dir: force-app
      test-level: RunLocalTests
      delta: true
      severity-threshold: '3'
      # integration-validation | uat-validation | preprod-validation |
      # main-validation - the org behind the target branch, see below
      environment: ${{ format('{0}-validation', github.base_ref) }}
    secrets: inherit
```

**One deployment per environment branch** - [`deployment.yml`](/workflows/deployment), triggered on push, with a GitHub Environment per org. The environment carries both the approval rules and the org's credentials, so the same reusable workflow serves all four stages:

```yaml
name: Deployment

on:
  push:
    branches: [integration, uat, preprod, main]

permissions:
  contents: read

jobs:
  deploy:
    uses: svierk/salesforce-devops-starter-kit/.github/workflows/deployment.yml@v1.3.0
    with:
      source-dir: force-app
      target-org-alias: ${{ github.ref_name }}
      test-level: RunLocalTests
      # Release train: stage-to-stage promotions deploy the full branch state
      delta: false
      # integration | uat | preprod | production - each with its own secrets
      # and, for preprod and production, required reviewers
      environment: ${{ github.ref_name == 'main' && 'production' || github.ref_name }}
    secrets: inherit
```

For **story promotion** and the **release bundle**, deploy the delta of each merge instead - the story or the bundle, plus any conflict resolution from its promotion or release branch. `github.event.before` is the state of the environment branch before the push:

```yaml
      delta: true
      delta-from: ${{ github.event.before }}
```

::: tip One secret set per org
Create four GitHub Environments and store `SFDX_CONSUMER_KEY`, `SFDX_JWT_SECRET_KEY` and `SFDX_USERNAME` as environment secrets in each. `secrets: inherit` then resolves the right org automatically, and adding a stage never means editing the caller. Add required reviewers to `preprod` and `production` for the approval gate.

Validation needs a twin per branch - `integration-validation`, `uat-validation`, `preprod-validation`, `main-validation` - with the same three secrets but **no** required reviewers and no branch restrictions. A protected environment would hold every pull request until someone approves it, or reject it outright.
:::

**Promotions as a form in the Actions tab** - [`promote.yml`](/workflows/promote) runs the steps above: it cuts the promotion branch, merges the story and opens the pull request into the stage. The same workflow cuts a release bundle and opens the sync pull requests after a release - the [example caller](/workflows/promote#example-usage) shows all three. A conflict stops the run, and its summary lists the files and the commands to finish the promotion locally.

```yaml
jobs:
  promote:
    uses: svierk/salesforce-devops-starter-kit/.github/workflows/promote.yml@v1.3.0
    with:
      target: uat
      sources: feature/story-123
    secrets:
      PROMOTION_APP_ID: ${{ secrets.PROMOTION_APP_ID }}
      PROMOTION_APP_PRIVATE_KEY: ${{ secrets.PROMOTION_APP_PRIVATE_KEY }}
```

Install a GitHub App with contents and pull request write access and pass its credentials: a pull request opened with the default `GITHUB_TOKEN` does **not** trigger other workflows, so the PR validation would never run on it.

**Weekly full validation** (story promotion and release bundle) - [`deployment.yml`](/workflows/deployment) as a check-only, full deployment of every environment branch into its org. The `ref` input checks out each branch, so one scheduled caller covers all of them:

```yaml
name: Weekly Full Validation

on:
  schedule:
    - cron: '0 3 * * 1'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  validate:
    strategy:
      fail-fast: false
      matrix:
        branch: [integration, uat, preprod, main]
    uses: svierk/salesforce-devops-starter-kit/.github/workflows/deployment.yml@v1.3.0
    with:
      ref: ${{ matrix.branch }}
      target-org-alias: ${{ matrix.branch }}
      dry-run: true
      delta: false
      environment: ${{ format('{0}-validation', matrix.branch) }}
    secrets: inherit
```

**Branch protection on all four environment branches:**

- Require a pull request before merging - no direct pushes, including for the release manager
- Require the PR Validation check to pass
- Require branches to be up to date before merging
- Restrict who can merge into `uat`, `preprod` and `main` to the release manager role
- Block force pushes and deletions
- Release train: merge environment-to-environment pull requests with a merge commit - never squash, and do not delete the source branch. The next promotion's scope is computed from that history.
- Default branch: `integration` for the release train, `main` for story promotion and the release bundle

**Optional:** [`scratch-org-ci.yml`](/workflows/scratch-org-ci) on `feature/*` pushes as fast CI before the first promotion - it creates a clean org, deploys, tests and deletes it, so a story is tested in isolation before it reaches shared `integration`.

## Migration path

**Between the variants** - in either direction, at any time. The orgs and the environment branches stay; only the way changes travel between them changes. Teams often start on the train, move to the release bundle once stories are signed off individually, and to story promotion once they are small and independent enough to ship one by one.

**To [B3](b3-modular-trunk.md)** - the usual destination. Cut the first module out of the happy soup - as source, or as an org-dependent unlocked package if it is tightly coupled - and as modules and feature flags take over, collapse the stages: `uat` usually goes first, then `preprod`.

**Signals you are ready:** deployment frequency, lead time and change fail rate improving over several quarters, measured against your own baseline, and metadata that has proven separable in practice - not just on a whiteboard.

**Signals you over-built:** a stage where nothing is ever rejected, a UAT sign-off that is a formality, or a promotion chain that takes longer than the development it gates. Remove the stage. Moving back toward [B1](b1-simple-org-development.md) is a legitimate outcome.

**If compliance boundaries or data residency appear** → [B4](b4-multi-org-regional.md), which can run this same model once per production org.
