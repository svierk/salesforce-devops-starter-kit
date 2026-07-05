# Getting Started

This guide takes you from an empty repository to a working Salesforce CI/CD pipeline using the building blocks of this kit.

## 1. Prerequisites

- A Salesforce DX project in a GitHub repository (a `sfdx-project.json` at the root).
- A **Dev Hub** enabled org (for scratch org flows) and/or the sandbox/production orgs you deploy to.
- A dedicated CI integration user.

## 2. Set up authentication

Follow [authentication.md](authentication.md) to authenticate your org with the JWT flow and store the credentials as GitHub Actions secrets (`SFDX_CONSUMER_KEY`, `SFDX_JWT_SECRET_KEY` and `SFDX_USERNAME`). This is the only manual setup step.

## 3. Choose a starting point

You have two ways to adopt the kit:

### Option 1 — Use a reusable workflow (fastest)

Copy one of the [examples](../examples) into your project's `.github/workflows/` directory. For pull request validation:

```yaml
name: PR Validation

on:
  pull_request:
    branches: [main]

jobs:
  validate:
    uses: svierk/salesforce-devops-starter-kit/.github/workflows/pr-validation.yml@main
    with:
      source-dir: force-app
    secrets:
      SFDX_CONSUMER_KEY: ${{ secrets.SFDX_CONSUMER_KEY }}
      SFDX_JWT_SECRET_KEY: ${{ secrets.SFDX_JWT_SECRET_KEY }}
      SFDX_USERNAME: ${{ secrets.SFDX_USERNAME }}
```

Commit it, open a pull request, and watch the validation run.

### Option 2 — Compose your own pipeline

If you need more control, wire the building blocks together yourself:

```yaml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  validate:
    name: Validate
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install SF CLI
        uses: svierk/sfdx-cli-setup@main

      - name: Salesforce Org Login
        uses: svierk/sfdx-login@main
        with:
          client-id: ${{ secrets.SFDX_CONSUMER_KEY }}
          jwt-secret-key: ${{ secrets.SFDX_JWT_SECRET_KEY }}
          username: ${{ secrets.SFDX_USERNAME }}
          alias: ci

      - name: Code Review
        uses: svierk/sfdx-code-review@main
        with:
          workspace: force-app
          severity-threshold: 3

      - name: Validate Deployment
        uses: svierk/sfdx-deploy@main
        with:
          delta: true
          delta-from: origin/${{ github.base_ref }}
          target-org: ci
          test-level: RunLocalTests
          dry-run: true
```

## 4. Recommended next steps

- Add the **scratch org CI** workflow to run tests in a clean org on every change.
- Add the **create scratch org** workflow so team members can provision ready-to-use orgs on demand (self-service, no local CLI needed).
- Add a **deployment** workflow gated by a GitHub Environment for production.
- **Pin** the actions to released versions and enable Dependabot (see the [versioning recommendation](../README.md#️-versioning-recommendation)).

## Building block reference

Every action documents its full inputs and outputs in its own repository — see the [building blocks catalog](../README.md#-building-blocks).
