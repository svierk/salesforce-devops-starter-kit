# Security Policy

## Supported versions

This repository is the meta repository of the Salesforce DevOps Starter Kit - it
provides the reusable workflows, examples and documentation. Only the latest
state of the `main` branch is actively maintained and receives fixes.

Each building block is an independent GitHub Action in its own repository. Report
a vulnerability in a specific action in that action's repository (see the
[building-block catalog](README.md#-building-blocks)); use this repository for
issues in the reusable workflows, examples or documentation.

## Reporting a vulnerability

Please **do not report security vulnerabilities through public GitHub issues**.

Instead, report them privately via GitHub's
[private vulnerability reporting](https://github.com/svierk/salesforce-devops-starter-kit/security/advisories/new)
("Report a vulnerability" under the repository's **Security** tab).

Please include as much detail as possible:

- the affected workflow, example or action and a description of the issue,
- steps to reproduce or a proof of concept,
- the potential impact (e.g. secret exposure, privilege escalation in a pipeline).

You can expect an initial response within a few days. Once the issue is
confirmed, a fix will be prepared and released as quickly as is reasonable, and
your contribution will be credited unless you prefer to remain anonymous.

Thank you for helping keep this project and its users safe!
