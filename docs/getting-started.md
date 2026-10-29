---
description: "Set up a first Salesforce CI/CD pipeline with the kit - from choosing a strategy and configuring JWT authentication to pull request validation and deployment."
---

# Getting Started

This guide takes you from an empty repository to a working Salesforce CI/CD pipeline using the building blocks of this kit.

## 1. Decide your strategy

Before you wire up a single workflow, settle **which** org landscape and branching model the pipeline runs on. That decision determines how many environments you need, which branches are protected, and which workflows you switch on - and it is expensive to reverse once a team is working in it.

If you already have a branching model that works, skip ahead. If you do not, or you are not sure it still fits:

➡️ **[Find your blueprint](strategy/index.md)** - a short guided questionnaire - a handful of questions - leading to one of five blueprints. Each blueprint page lists the exact workflows, GitHub Environments and branch protection rules to configure, so you arrive at step 4 below knowing what to copy.

::: tip Not a commitment
Every blueprint documents its migration path to the next one. Start with the simplest model that fits and move when the signals say so - [Strategy & Blueprints](strategy/index.md) covers both.
:::

## 2. Prerequisites

- A Salesforce DX project in a GitHub repository (a `sfdx-project.json` at the root).
- A **Dev Hub** enabled org (for scratch org flows) and/or the sandbox/production orgs you deploy to.
- A dedicated CI integration user.

## 3. Set up authentication

Follow [authentication.md](authentication.md) to authenticate your org with the JWT flow and store the credentials as GitHub Actions secrets (`SFDX_CONSUMER_KEY`, `SFDX_JWT_SECRET_KEY` and `SFDX_USERNAME`). This is the only manual setup step.

If your blueprint uses more than one target org, create one **GitHub Environment per org** and store these three secrets in each - the deployment workflow resolves them per environment, so one caller serves every stage. Pull request validation can use the same mechanism through its own `environment` input; scratch org CI keeps using the repository secrets of your Dev Hub.

## 4. Choose a starting point

You have two ways to adopt the kit:

### Option 1 - Use a reusable workflow (fastest)

Copy one of the [examples](../examples) into your project's `.github/workflows/` directory. For pull request validation:

```yaml
name: PR Validation

on:
  pull_request:
    branches: [main]

# A reusable workflow can never get more permissions than the caller grants -
# pr-validation needs security-events: write to upload its SARIF report.
permissions:
  contents: read
  security-events: write

jobs:
  validate:
    uses: svierk/salesforce-devops-starter-kit/.github/workflows/pr-validation.yml@v1.7.0
    with:
      source-dir: force-app
    secrets:
      SFDX_CONSUMER_KEY: ${{ secrets.SFDX_CONSUMER_KEY }}
      SFDX_JWT_SECRET_KEY: ${{ secrets.SFDX_JWT_SECRET_KEY }}
      SFDX_USERNAME: ${{ secrets.SFDX_USERNAME }}
```

Commit it, open a pull request, and watch the validation run.

### Option 2 - Compose your own pipeline

If you need more control, wire the building blocks together yourself:

```yaml
name: CI

on:
  pull_request:
    branches: [main]

# Least-privilege token: this pipeline only reads the repository. Add
# security-events: write if you upload the code analysis results as SARIF.
permissions:
  contents: read

jobs:
  validate:
    name: Validate
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false # don't leave the GITHUB_TOKEN in .git/config for later steps

      - name: Install SF CLI
        uses: svierk/sfdx-cli-setup@v1.2.0

      - name: Salesforce Org Login
        uses: svierk/sfdx-login@v1.4.3
        with:
          client-id: ${{ secrets.SFDX_CONSUMER_KEY }}
          jwt-secret-key: ${{ secrets.SFDX_JWT_SECRET_KEY }}
          username: ${{ secrets.SFDX_USERNAME }}
          alias: ci

      - name: Code Review
        uses: svierk/sfdx-code-review@v1.1.1
        with:
          workspace: force-app
          severity-threshold: 3

      - name: Validate Deployment
        uses: svierk/sfdx-deploy@v1.3.1
        with:
          delta: true
          delta-from: origin/${{ github.base_ref }}
          target-org: ci
          test-level: RunLocalTests
          dry-run: true
```

## 5. Recommended next steps

- Add the **scratch org CI** workflow to run tests in a clean org on every change.
- Add the **create scratch org** workflow so team members can provision ready-to-use orgs on demand (self-service, no local CLI needed).
- Add a **deployment** workflow gated by a GitHub Environment for production.
- Grant the deployed permission sets with **sfdx-assign-permissions** and automate post-deploy steps (data migrations, cache clearing) with **sfdx-apex-execute** - both are wired into the reusable workflows as optional inputs.
- Keep the version pins current with **Dependabot** and review the hardening checklist (see [security & versioning](../README.md#-security--versioning)).
- Revisit your [branching strategy](strategy/index.md) once a second team or a formal approval gate appears - each blueprint documents the signals and the migration path.

## Building block reference

Every action documents its full inputs and outputs in its own repository - see the [building blocks catalog](../README.md#-building-blocks).
