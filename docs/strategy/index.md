# Org & Branching Strategy

The rest of this kit answers _how_ to run a pipeline. This section answers the question that comes first: **which** org landscape and branching model should you run it on?

Salesforce makes that choice harder than it is elsewhere. Sandboxes are licensed, metered and slow to refresh; there is no true rollback; declarative changes arrive from people who may never touch Git; and XML metadata merges badly. Copying a branching model from a web project rarely survives contact with those constraints.

So this section does three things:

1. Asks you a few questions about your team and your org landscape.
2. Points you at one of **five blueprints** - concrete, opinionated target pictures.
3. Tells you, per blueprint, [exactly which workflows, actions and branch protection rules](mapping.md) of this kit to switch on.

::: tip Not a commitment
A blueprint is a starting point, not an identity. Every blueprint page ends with a **migration path** to the next one, and with the signals that tell you it is time to move.
:::

## Find your blueprint

A handful of questions, one at a time - always the same ones, so every path has the same length. Your path lights up in the decision tree as you go, and the result carries a link you can paste into a ticket.

<ClientOnly>
  <StrategyWizard />
</ClientOnly>

<details>
<summary>Prefer to read the tree yourself?</summary>

The questionnaire above is interactive on the [documentation site](https://svierk.github.io/salesforce-devops-starter-kit/strategy/); this is the same decision tree as a static diagram. [The Five Questions](questions.md) explains why each one is asked and what it changes.

```mermaid
flowchart TD
    QO{"How many<br/>production orgs?"} -->|One| QT{"How many teams or<br/>parallel workstreams?"}
    QO -->|Several| P2M(( ))
    QT -->|One| QS{"How is the<br/>team set up?"}
    QT -->|Several| P3N(( ))
    P2M --> P3M(( ))
    QS -->|Developers / balanced| P4B1(( ))
    QS -->|Low-code| P4B5(( ))
    P3N --> QM{"How mature is your<br/>DevOps practice?"}
    P3M --> P4M(( ))
    P4B1 --> P5B1(( ))
    P4B5 --> P5B5(( ))
    QM -->|Level 1-3| QR{"How do you ship<br/>to production?"}
    QM -->|Level 4| P5B3(( ))
    P4M --> P5M(( ))
    P5B1 --> B1["<b>B1</b><br/>Simple Org Development"]
    P5B5 --> B5["<b>B5</b><br/>Low-Code First"]
    QR -->|Story by story| B2S["<b>B2</b><br/>Environment Branches<br/>· Story Promotion"]
    QR -->|Bundled from UAT| B2B["<b>B2</b><br/>Environment Branches<br/>· Release Bundle"]
    QR -->|Whole releases| B2T["<b>B2</b><br/>Environment Branches<br/>· Release Train"]
    P5B3 --> B3["<b>B3</b><br/>Modular Trunk"]
    P5M --> B4["<b>B4</b><br/>Multi-Org / Regional"]

    classDef bp fill:#dde4f9,stroke:#1d4ed8,color:#0b1a4a,font-weight:bold;
    classDef pass fill:#9aa0a6,stroke:#9aa0a6;
    class B1,B2S,B2B,B2T,B3,B4,B5 bp;
    class P2M,P3N,P3M,P4B1,P4B5,P4M,P5B1,P5B5,P5B3,P5M pass;
```

</details>

::: info If two paths feel equally true
Take the simpler one. Adding a long-lived branch later is far cheaper than unwinding one.
:::

## The five blueprints

| Blueprint                                                                            | Fits when                                           | Org landscape                              | Branch model                                                                         |
| ------------------------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------ |
| [**B1** Simple Org Development](b1-simple-org-development.md)                        | One team, one production org, getting started       | 1 developer sandbox + production           | GitHub Flow (`main` + `feature/*`)                                                   |
| [**B2** Multi-Team with Environment Branches](b2-multi-team-environment-branches.md) | Several streams, one production org, approval gates | Integration + UAT + PreProd + production   | One branch per org - stories promoted one by one, as a bundle, or as a release train |
| [**B3** Modular Trunk](b3-modular-trunk.md)                                          | Several teams on one trunk, maturity level 4        | Scratch orgs + few sandboxes               | Trunk-based, feature flags; modules or packages as artifacts                         |
| [**B4** Multi-Org / Regional Rollout](b4-multi-org-regional.md)                      | Several production orgs by region or business unit  | One org (chain) per region/BU, shared core | Trunk + per-org release branches, or a B2 chain per org                              |
| [**B5** Low-Code First](b5-low-code-admin-first.md)                                  | Admin-heavy team, Git knowledge is the bottleneck   | Dev + UAT + production, heavy automation   | Simplified environment branches, tool-driven                                         |

## How to read a blueprint page

Every blueprint documents the same eight things, so you can diff them against each other:

- **At a glance** - team size, environments, cadence, prerequisites
- **Target picture** - a diagram of branches and the orgs they deploy to
- **Org & sandbox landscape** - which sandbox types, and what they cost you in licences
- **Branch model** - branch names, lifetimes and merge direction
- **Promotion path & roles** - who moves what, and through which gate
- **Strengths / Trade-offs & anti-patterns** - honest, including what this model is bad at
- **Kit mapping** - the workflows, actions and branch protection rules to switch on
- **Migration path** - the next blueprint, and the signals that you are ready for it

## Background

If you want the reasoning rather than the recommendation, [Dimensions & Trade-Offs](dimensions.md) covers sandbox types and licence bundles, org development vs. package development, the common branching models, release styles and the maturity signals (DORA) used throughout this section.
