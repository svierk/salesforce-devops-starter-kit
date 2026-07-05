# Contributing

Thanks for your interest in improving the Salesforce DevOps Starter Kit! 🙌

## How this project is organized

- Each **building block** is an independent GitHub Action in its own repository (see the [catalog](README.md#-building-blocks)).
- This repository is the **meta repository**: it provides the documentation, reusable workflows, and examples that tie the building blocks together.

Please open issues and pull requests in the repository that matches your change:

- A bug or feature in a single action → that action's repository.
- Documentation, reusable workflows, or examples → this repository.

## Proposing changes

1. Open an issue describing the problem or idea first, so we can align on the approach.
2. Fork the repository and create a feature branch.
3. Keep changes focused and follow the conventions of the existing code:
   - Building blocks are composite actions; pass inputs via `env:` and start scripts with `set -euo pipefail`.
   - Document new inputs and outputs in the action's README.
4. Open a pull request and link the related issue.

## Adding a new building block

New blocks are welcome when they cover a distinct, reusable step of a Salesforce CI/CD pipeline. A good building block:

- Wraps a single `sf` CLI capability with sensible inputs and outputs.
- Ships with a README (usage, inputs, outputs, references) and an MIT `LICENSE`.
- Once published, gets added to the [catalog](README.md#-building-blocks) here.

## Code of conduct

Be respectful and constructive. This is a community project for the Trailblazer Community — let's keep it welcoming.
