# Kit Mapping

The bridge between the strategy layer and the pipeline. Once you have picked a blueprint, this page tells you which parts of the kit to switch on - and what to configure in GitHub around them.

Each blueprint page carries the full, copy-pasteable callers. This page is the overview you compare against.

## Reusable workflows per blueprint

| Workflow                                                  | [B1](b1-simple-org-development.md) | [B2](b2-multi-team-environment-branches.md) |  [B3](b3-modular-trunk.md)   | [B4](b4-multi-org-regional.md) | [B5](b5-low-code-admin-first.md) |
| --------------------------------------------------------- | :--------------------------------: | :-----------------------------------------: | :--------------------------: | :----------------------------: | :------------------------------: |
| [`pr-validation.yml`](/workflows/pr-validation)           |              required              |       required, on all 4 env branches       |           required           |   required, one job per org    |   required, relaxed threshold    |
| [`deployment.yml`](/workflows/deployment)                 |             on `main`              |               per env branch                | from `main` or a release tag |         per-org matrix         |       on `uat` and `main`        |
| [`scratch-org-ci.yml`](/workflows/scratch-org-ci)         |              optional              |          optional, on `feature/*`           |     **gate for modules**     |            core CI             |                -                 |
| [`create-scratch-org.yml`](/workflows/create-scratch-org) |              optional              |                  optional                   |         recommended          |          recommended           |           recommended            |
| [`promote.yml`](/workflows/promote)                       |                 -                  |     story promotion and release bundle      |              -               |        B2 chain per org        |                -                 |

## Key input settings

| Setting                     |       B1        |                   B2                   |               B3               |       B4        |         B5          |
| --------------------------- | :-------------: | :------------------------------------: | :----------------------------: | :-------------: | :-----------------: |
| `delta` on validation       |     `true`      |                 `true`                 |             `true`             |     `true`      |       `true`        |
| `delta` on deployment       |     `false`     | train `false`, story and bundle `true` | `true` (from the last release) |     `false`     |       `false`       |
| `test-level`                | `RunLocalTests` |            `RunLocalTests`             |        `RunLocalTests`         | `RunLocalTests` |   `RunLocalTests`   |
| `severity-threshold`        |       `3`       |                  `3`                   |              `3`               |       `3`       |         `2`         |
| `environment` on deployment |  `production`   |             one per stage              |          `production`          |   one per org   | `uat`, `production` |

Keep `RunLocalTests` as the test level for production. `RunRelevantTests`, introduced as a beta in Spring '26, selects tests from the changed code - but Salesforce itself advises against using it in production pipelines yet. Try it in validation runs first.

::: tip Why delta on validation but mostly not on deployment
Validating a pull request only needs to check what the branch changed - that is the fast feedback loop. A promotion between long-lived branches deploys the branch's whole state, because a delta there would silently skip anything an earlier hop missed.

[B2's story promotion and release bundle](b2-multi-team-environment-branches.md#three-ways-to-promote) are the exception: environment branches are never merged into each other, so each push carries exactly what one pull request merged - usually one story. Deploy it as a delta with `delta-from: ${{ github.event.before }}`. Otherwise, `delta-from` is for the case where you deliberately want to deploy the difference since a release tag.
:::

## Building blocks

All blueprints use [`get-node-version`](https://github.com/svierk/get-node-version), [`sfdx-cli-setup`](https://github.com/svierk/sfdx-cli-setup) and [`sfdx-login`](https://github.com/svierk/sfdx-login) - the reusable workflows call them for you. The blocks below matter when you compose your own pipeline:

| Block                                                                                                                                                           | Where it earns its place                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [`sfdx-deploy`](https://github.com/svierk/sfdx-deploy)                                                                                                          | Everywhere. `delta` + `dry-run` is the validation gate; `delta-from` targets a release tag                                                  |
| [`sfdx-run-tests`](https://github.com/svierk/sfdx-run-tests)                                                                                                    | Everywhere. Apex, LWC (Jest) and Flow tests with coverage                                                                                   |
| [`sfdx-code-review`](https://github.com/svierk/sfdx-code-review)                                                                                                | Everywhere. Relax `severity-threshold` in B5, keep it strict in B3/B4                                                                       |
| [`sfdx-create-scratch-org`](https://github.com/svierk/sfdx-create-scratch-org) / [`sfdx-delete-scratch-org`](https://github.com/svierk/sfdx-delete-scratch-org) | B3 and B4, where scratch orgs are the development environment                                                                               |
| [`sfdx-package-installation`](https://github.com/svierk/sfdx-package-installation)                                                                              | B3 (dependencies) and B4 (distributing the core, pinned per org)                                                                            |
| [`sfdx-data-import`](https://github.com/svierk/sfdx-data-import)                                                                                                | Wherever a fresh org needs to be usable - strongest with `create-scratch-org.yml`                                                           |
| [`sfdx-assign-permissions`](https://github.com/svierk/sfdx-assign-permissions)                                                                                  | Wherever a fresh org needs to be usable - `create-scratch-org.yml` grants permission sets before the data import                            |
| [`sfdx-apex-execute`](https://github.com/svierk/sfdx-apex-execute)                                                                                              | B2 and B4, where each promotion may need data migrations - `apex-file-path` on `deployment.yml` runs them after a real (non-dry-run) deploy |

::: warning Not covered yet
Package **version creation and promotion** (`sf package version create` / `promote`) has no building block. B3 and B4 need it, so that step is currently a direct `sf` CLI call in your own workflow - the CLI is already installed and authenticated by the time your step runs.
:::

## Branch protection

Configure these under **Settings → Branches** for every long-lived branch in your blueprint.

| Rule                           |     B1     |                      B2                       |             B3              |         B4         |         B5         |
| ------------------------------ | :--------: | :-------------------------------------------: | :-------------------------: | :----------------: | :----------------: |
| Protected branches             |   `main`   |    `integration`, `uat`, `preprod`, `main`    |           `main`            |       `main`       |   `uat`, `main`    |
| Default branch                 |   `main`   | `integration` (train), `main` (story, bundle) |           `main`            |       `main`       |       `uat`        |
| Require a pull request         |    yes     |                      yes                      |             yes             |        yes         |        yes         |
| Required approvals             |     1      |                       1                       |       1 (owning team)       |   1 (CODEOWNERS)   | 1 (pipeline owner) |
| Required status checks         | validation |                  validation                   | validation + scratch org CI | validation per org |     validation     |
| Require up-to-date branches    |    yes     |                      yes                      |             yes             |        yes         |        yes         |
| Restrict who can merge         |     -      |   release manager on `uat`/`preprod`/`main`   |              -              |     CODEOWNERS     |   pipeline owner   |
| Block force pushes & deletions |    yes     |                      yes                      |             yes             |        yes         |        yes         |

## GitHub Environments

[`deployment.yml`](/workflows/deployment) takes an `environment` input, and that one input carries two things at once: **environment-scoped secrets** (so each org has its own credentials, and no job ever sees another org's) and **protection rules** (required reviewers, wait timers, branch restrictions).

This is what lets one reusable workflow serve every stage and every org. Create one environment per target org, store `SFDX_CONSUMER_KEY`, `SFDX_JWT_SECRET_KEY` and `SFDX_USERNAME` in each, and use `secrets: inherit` in the caller.

[`pr-validation.yml`](/workflows/pr-validation) takes an `environment` input too, so validation can run against the org behind each target branch. Give it its own environment per org - for example `uat-validation` - with the same credentials but **no** required reviewers or branch restrictions, or every pull request waits for an approval. [`scratch-org-ci.yml`](/workflows/scratch-org-ci) reads the **repository secrets** of your Dev Hub.

| Blueprint | Environments to create                                                           |
| --------- | -------------------------------------------------------------------------------- |
| B1        | `production`                                                                     |
| B2        | `integration`, `uat`, `preprod`, `production`                                    |
| B3        | `staging`, `production`                                                          |
| B4        | one per production org, e.g. `eu-production`, `na-production`, `apac-production` |
| B5        | `uat`, `production`                                                              |

Add **required reviewers** to every environment that fronts a production org. That approval is your release gate, and in a segregation-of-duties context it is the control an auditor will ask about.

See [Authentication](/authentication) for setting up the JWT flow and producing these secrets.

## What no blueprint gives you

Two gaps are the same in all five, because the platform does not solve them:

- **Backup and recovery.** Salesforce has no rollback. Every blueprint needs an explicit backup solution with a stated RPO and RTO. The pipeline is not one.
- **Drift detection.** Changes made directly in an org are invisible to the pipeline until they cause a deployment failure. A scheduled diff between the org and the branch is the cheap mitigation, and it belongs in every blueprint.
