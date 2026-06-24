# Roadmap

## Milestone 1: Contracts

- Define Design IR TypeScript types.
- Define project profile and codegen plan contracts.
- Add a sample IR fixture.
- Add schema validation.

## Milestone 2: Project Scanner

- Detect React, Next.js, Vue, Vite, and package managers.
- Detect style system: CSS, CSS Modules, Tailwind, styled-components, design tokens.
- Inventory reusable local components.

## Milestone 3: Human Review Studio

- Render the IR as editable component/layer panels.
- Track confirmation state.
- Export confirmed IR.

## Milestone 4: Codegen Planner

- Map components and tokens to target project conventions.
- Generate a write plan without touching files.
- Report unresolved mappings.

## Milestone 5: Emitters

- Implement React emitter first.
- Add Next.js routing integration.
- Add Vue emitter after the React path is stable.

## Milestone 6: Verification

- Run target project checks.
- Add screenshot QA adapter.
- Optionally integrate Pixel Twin Lab as a visual diff backend.

