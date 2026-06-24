# UI Codegen Agent Design

## Objective

Build a new independent agent project that turns AI-generated UI metadata plus a preview image into production-grade frontend code. The project is separate from Pixel Twin Lab. Pixel Twin Lab may be integrated later as a QA backend, but the main product path must be Design IR-first.

## Primary Workflow

```text
AI UI metadata + preview image
  -> normalize into Design IR
  -> human confirms layers, components, tokens, data, interactions, and assets
  -> scan target project
  -> map IR to project components and tokens
  -> plan file writes
  -> emit production code
  -> run verification
```

## Architecture

The system is divided into five bounded areas:

- Design IR contracts: the canonical representation of layout, components, tokens, data, interactions, assets, codegen intent, and review state.
- Input adapters: convert provider-specific AI metadata into the canonical IR.
- Project scanner: detects target project framework, routing, package manager, style system, UI libraries, source roots, and reusable components.
- Codegen planner and mapper: turns confirmed IR plus project profile into an ordered, reviewable write plan.
- Framework emitters: write project-native code from the plan, starting with React/Next.

## Key Product Rules

- The preview image is a visual preview, not the source of truth.
- Production code generation must read confirmed Design IR.
- Repeated UI must use data contracts and templates.
- Component semantics matter more than raw layer geometry.
- Unconfirmed regions block production file writes.
- Screenshot QA is evidence, not the generation source.

## Initial Scope

The first repository version contains documentation, TypeScript contracts, and a sample IR fixture. It does not implement full code generation yet.

## Out Of Scope

- Flat screenshot reverse engineering as the main workflow.
- Full visual editor implementation.
- Multi-framework emitters before React/Next contracts are stable.
- Pixel Twin Lab integration beyond architecture notes.

## Verification

The initial scaffold must pass TypeScript typechecking. Later milestones will add schema validation, project scanner tests, planner tests, emitter snapshots, and build verification against fixture projects.

