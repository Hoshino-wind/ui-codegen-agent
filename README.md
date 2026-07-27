# AI UI Production System

[English](./README.md) · [简体中文](./README.zh-CN.md)

> A LayerDoc-first workbench for turning a reviewed UI visual decomposition into editable UI, controlled revisions, HTML/React exports, and machine-checkable handoff evidence.

## 15-second overview

AI UI images are easy to produce and hard to ship: pixels do not contain real text, components, interactions, responsive rules, or integration contracts. This repository puts a typed intermediate representation—**LayerDoc**—between a source image and generated code.

The implemented workflow is:

```text
source PNG
  -> reviewed HomepageAnalysisPlan
  -> LayerDoc
  -> controlled edits / reviewed section candidates
  -> deterministic HTML preview + React/Tailwind export
  -> visual, structural, component, and project-fit verification
  -> project package with schemas, manifests, audits, and CI commands
```

This is not an “arbitrary screenshot to production code in one click” system. A real, general-purpose VLM decomposition worker is **not implemented** in this repository; the current boundary accepts a plan produced by a human or an external vision worker, and includes a deterministic mock decomposition for backtesting.

## The problem

A visually similar page can still be a poor engineering artifact. A full-page bitmap may score well in a screenshot comparison while providing no editable copy, reusable components, responsive behavior, or trustworthy project integration.

This project therefore evaluates two questions separately:

1. **Does the output resemble the reference?**
2. **Is the output structured, editable, exportable, and safe to integrate?**

## Core mechanisms

### 1. LayerDoc is the source of truth

LayerDoc records the canvas, design tokens, sections, layers, assets, components, interactions, responsive rules, revision history, and verification state in one typed graph. The source image remains provenance and visual evidence; it does not become the editable implementation.

Every layer is classified into one of four production tracks:

| Track | Examples | Intended treatment |
| --- | --- | --- |
| `component` | text, buttons, cards, forms, lists | editable DOM/component output |
| `asset` | illustrations, backgrounds, product images | referenced media with provenance |
| `approximation` | charts, maps, 3D scenes | explicit approximation, not disguised bitmap code |
| `layout` | sections, groups, hierarchy | structural and responsive rules |

The distinction prevents a pixel-perfect shortcut from being reported as a component implementation.

### 2. Editing is controlled and auditable

Editor actions are pure LayerDoc transforms. Implemented operations include copy, styles, image assets, bounds, button actions, section order and visibility, plus undo/redo in the Studio workspace.

Exports can include `edit-audit.json`, which records applied and undone operations, affected layers/sections, and a summary that project-local verification recomputes.

### 3. Section regeneration is reviewed before application

An AI worker can return a section candidate that conforms to the exported `section-candidate.schema.json`. The system verifies the candidate against the current section graph before applying it.

An accepted candidate:

- keeps the stable section identity;
- replaces its layers, assets, components, interactions, and responsive rules as one graph operation;
- refreshes preview, React export, contracts, manifests, and verifier state;
- stores before/after snapshots in `generation.sectionApplications`;
- can be reverted to the recorded previous graph.

Candidate generation itself is an integration boundary. The repository implements the contract, verification, apply, and revert path—not a hosted generation model.

### 4. One graph drives preview and export

The same LayerDoc produces:

- deterministic HTML preview with section/component/layer markers;
- a React + Tailwind TSX component;
- responsive media-query CSS;
- `integration-contract.json` and its JSON Schema;
- asset index, production manifest, handoff summary, CI workflow, and backtest runbook;
- project-local verification and candidate-application scripts.

Traceability attributes connect rendered DOM nodes back to LayerDoc IDs and expose current verification state without scraping README text.

### 5. Verification is multi-dimensional

The verifier keeps four scores separate:

```text
visual_similarity   PNG-to-PNG similarity
structure_score     graph integrity and editable structure
component_score     component coverage and exportability
project_fit_score   integration readiness and bitmap-shortcut risk
```

Quality gates also check source provenance, section coverage, graph references, responsive targets, asset mappings, DOM selectors, exported contracts, and full-page/section-sized bitmap risks. Structural blockers are kept distinct from non-blocking track notes.

## Architecture

```text
src/importers/   PNG intake, analysis-plan/task contracts, manifest conversion
       |
       v
src/layerdoc/    schema, classification, validation, scoring, audit
       |
       +---------------------+
       |                     |
       v                     v
src/editor/      controlled transforms and section candidates
       |                     |
       +----------+----------+
                  v
src/exporters/   HTML, React/Tailwind, schemas, project package
                  |
                  v
src/verifier/    screenshot diff, graph/report scoring, quality gates
                  |
                  v
src/app/         React Studio for intake, review, edit, preview, verify, export
```

## Quick start

### Run the Studio and test suite

Requirements: a current Node.js release with npm. Dependencies are locked in `package-lock.json`.

```bash
npm install
npm test
npm run typecheck
npm run dev
```

The Studio opens from the local Vite server printed by `npm run dev`.

### Run the deterministic end-to-end backtest

This path creates stable mock PNGs locally and does not call a remote image or vision model:

```bash
npm run build:lib
npm run backtest:homepage -- \
  --out artifacts/homepage-backtest \
  --component ProductionHomepage
```

The output includes source/candidate images, a LayerDoc, preview, React export, project package, verifier evidence, and `backtest-report.json`.

### Process a real homepage PNG

First create the decomposition task:

```bash
npm run build:lib
npm run create:analysis-task -- \
  --input references/homepage.png \
  --out artifacts/analysis-task \
  --name "Product homepage"
```

A human operator or an external vision worker must produce `analysis-plan.json` from that task. Audit it before building LayerDoc:

```bash
npm run verify:analysis-plan -- \
  --input analysis-plan.json \
  --source references/homepage.png \
  --out artifacts/analysis-plan-check
```

Then run the production chain:

```bash
npm run pipeline:homepage -- \
  --input references/homepage.png \
  --analysis-plan analysis-plan.json \
  --out artifacts/homepage-run \
  --component ProductionHomepage \
  --verify-project
```

Use `--candidate <rendered.png>` when a stable candidate screenshot already exists. Without one, exported preview verification can capture `preview.html` with Playwright.

## Verification evidence

The repository currently contains **303 automated tests** across **38 Node test files**. They cover LayerDoc validation, controlled edits, candidate apply/revert, PNG intake, Analysis Plan contracts, HTML and React/Tailwind exporters, package materialization, project-local scripts, screenshot diffing, verification gates, CLI behavior, and the deterministic homepage backtest.

Run the evidence locally:

```bash
npm test
npm run typecheck
npm run build
```

The tests are deterministic and use Node’s built-in test runner. Browser screenshot capture is a separate runtime path; PNG comparison itself is deterministic.

## Current limits

Implemented now:

- LayerDoc schema, validation, classification, scoring, and audit;
- React Studio for controlled intake, editing, preview, verification, and export;
- reviewed section candidate schema, verification, apply, history, and revert;
- HTML preview and React/Tailwind TSX export;
- project packages with schemas, manifests, contracts, audit data, and local verification commands;
- deterministic homepage backtest and PNG visual diff.

Not implemented or intentionally constrained:

- no general-purpose VLM that automatically decomposes arbitrary screenshots;
- the current production target is a marketing homepage with **8–15 sections**;
- React export preserves verified LayerDoc geometry, including absolute positioning; it is not an automatic semantic redesign into an ideal responsive component system;
- no freeform vector editor, multiplayer collaboration, or plugin ecosystem;
- candidate generation and production screenshot rendering are external integration points;
- verification can expose engineering risk, but cannot prove subjective design quality or business effectiveness.

## Repository structure

```text
src/app/        React Studio and browser handoff utilities
src/layerdoc/   LayerDoc types, schema, validation, scoring, audit
src/importers/  analysis-plan, image-manifest, and PNG intake
src/editor/     controlled edits and section candidate contracts
src/exporters/  preview, React/Tailwind, schemas, project packages
src/verifier/   visual diff, reports, project checks, quality gates
src/cli/        intake, pipeline, backtest, export, materialization
test/           automated behavior and end-to-end contract tests
docs/concepts/  editor concept and implementation screenshots
```

## Roadmap

- Add a pluggable VLM decomposition adapter with benchmark fixtures and confidence-aware review.
- Expand beyond the homepage constraint while preserving explicit structure contracts.
- Add semantic layout synthesis after verification, rather than relying on absolute geometry in the final React projection.
- Build stronger accessibility, interaction, and responsive-behavior gates.
- Evaluate decomposition quality on public, reproducible screenshot fixtures.

## Development

```bash
npm run build:lib
npm run build:app
npm run typecheck
npm test
```

New behavior should be tested through the public contract it changes. Generated packages are designed to be inspected and verified independently rather than trusted because they were produced by the same process.
