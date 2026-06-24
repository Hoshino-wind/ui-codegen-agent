# Architecture

UI Codegen Agent is built around a Design IR-first pipeline. The preview image is a rendering artifact; generated code must be derived from confirmed structured metadata.

## Pipeline

```text
Input Adapter
  -> Design IR Normalizer
  -> Human Review Contract
  -> Project Scanner
  -> Component Mapper
  -> Token Mapper
  -> Codegen Planner
  -> Framework Emitter
  -> Verification Runner
```

## Modules

### Input Adapter

Accepts AI-generated UI metadata and a preview image. It converts provider-specific metadata into the internal Design IR shape.

### Human Review Contract

Marks which parts of the IR have been confirmed by a person: layout bounds, component semantics, token choices, interactions, responsive behavior, and asset strategy.

### Project Scanner

Reads the target project and detects framework, router, package manager, source roots, style system, UI libraries, existing components, and token conventions.

### Component Mapper

Maps Design IR components to existing project components when possible. If no match exists, it proposes new reusable components with props contracts.

### Codegen Planner

Turns confirmed IR plus project profile into an ordered write plan. It must separate fixtures, components, route wiring, styles, and assets.

### Framework Emitter

Writes project-native code. React, Next.js, Vue, and other emitters should share the same IR and planning contracts but own framework-specific output.

### Verification Runner

Runs typecheck, lint, build, unit tests when available, and optional screenshot QA.

## Guardrails

- Code generation reads confirmed IR, not the flat preview image.
- Tables, lists, cards, feeds, and charts render from data contracts.
- Tokens are centralized and mapped to the target project style system.
- Unconfirmed IR cannot emit production files.
- Asset islands must be explicit and region-scoped.

