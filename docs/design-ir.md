# Design IR

Design IR is the source of truth for code generation.

## Top-Level Shape

```ts
interface DesignIR {
  meta: DesignMeta;
  frame: Frame;
  tokens: DesignTokens;
  components: ComponentNode[];
  data: DataContract[];
  interactions: InteractionContract[];
  assets: AssetContract[];
  codegen: CodegenIntent;
  review: ReviewState;
}
```

## Required Layers

- `frame`: viewport size, background, density assumptions.
- `tokens`: colors, typography, spacing, radius, borders, shadows.
- `components`: semantic component tree, bounds, variants, slots, token references.
- `data`: fixtures and schemas for repeated or data-driven UI.
- `interactions`: clickable controls, states, navigation, dialogs, filters.
- `assets`: icons, photos, avatars, logos, chart/map/3D strategy.
- `codegen`: target framework, directories, component mapping, verification commands.
- `review`: human-confirmed status and unresolved decisions.

## Review Rules

Production code can be generated only after these areas are confirmed:

- component semantics
- design tokens
- repeated data contracts
- interaction states
- asset strategy
- target project mapping

