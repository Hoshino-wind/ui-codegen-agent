# UI Codegen Agent

UI Codegen Agent turns AI-generated UI metadata into production-grade frontend code.

The core idea is **Design IR first**:

```text
AI UI metadata + preview image
  -> Design IR review and confirmation
  -> target project scanner
  -> component and token mapper
  -> production code generator
  -> build, typecheck, and screenshot QA
```

The preview image is not the source of truth. The source of truth is a structured Design IR that records layout, layers, component semantics, design tokens, data contracts, interactions, assets, and codegen targets.

Pixel Twin Lab can be used later as a visual QA engine, but it is not part of the primary generation path.

## Goals

- Generate maintainable project-native React/Vue/Next code from confirmed Design IR.
- Map UI intent to existing project components, tokens, routes, and style conventions.
- Keep repeated content data-driven instead of hard-coded as duplicated markup.
- Make human review explicit before code generation.
- Verify generated output with lint, typecheck, build, and optional screenshot comparison.

## Non-Goals

- Reverse-engineering production code from a flat screenshot as the primary workflow.
- Claiming one-pixel fidelity from visual inspection alone.
- Shipping full-page bitmap overlays as UI implementation.

## Current Status

This repository is an initial agent project scaffold. It defines the product direction, architecture, and TypeScript contracts for the Design IR-first workflow.

## Repository Layout

```text
docs/
  architecture.md
  design-ir.md
  roadmap.md
  superpowers/specs/2026-06-24-ui-codegen-agent-design.md
examples/
  sample-design-ir.json
src/
  ir/
  pipeline/
  project/
  codegen/
```

## Scripts

```bash
npm run typecheck
```

