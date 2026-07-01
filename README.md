# AI UI Production System

LayerDoc-first tooling for turning AI-generated UI visuals into editable,
verifiable, project-ready engineering assets.

The project is intentionally not a generic "UI generator". The core product
idea is a production chain:

```text
Image / AI Visual
  -> LayerDoc
  -> Controlled Editor
  -> HTML Preview
  -> React/Tailwind Export
  -> Verifier
  -> Project Integration
```

## Why LayerDoc

Text-to-image output only produces pixels. It does not produce real buttons,
text nodes, components, data contracts, responsive behavior, interactions, or
project code. LayerDoc is the intermediate asset that makes those objects
explicit before code generation.

LayerDoc owns:

- `canvas`: the source surface dimensions and background.
- `tokens`: colors, typography, spacing, and radii used by renderers.
- `sections`: high-level page regions such as hero, proof, pricing, and CTA.
- `layers`: editable objects inside sections.
- `assets`: images, crops, generated media, models, and other external files.
- `components`: exportable component groupings.
- `interactions`: controlled behavior attached to layers.
- `responsive`: breakpoint rules and layout changes.
- `verification`: visual, structural, component, and project-fit evidence.

LayerDoc metadata can also carry `sourceImage` provenance for the original AI
visual. That reference is evidence for verification and handoff, not the source
of truth for editable structure.

## Classification Tracks

The first step after image analysis is classification, not code generation.

```text
component      text, buttons, cards, nav, forms, lists, tables
asset          illustrations, backgrounds, product images, textures
approximation  charts, maps, 3D, canvas, complex visualizations
layout         sections, groups, spacing, hierarchy, responsive rules
```

This prevents dishonest output, such as hand-drawing a chart as static SVG or
shipping a full-page image while calling it a component implementation.

## Current MVP Surface

The repository currently implements the core LayerDoc domain layer:

- Convert an image-analysis manifest into LayerDoc.
- Create a complete LayerDoc shell.
- Classify layer kinds into production tracks.
- Validate graph references, canvas geometry, and empty visible sections.
- Apply controlled editor operations without mutating the original document:
  copy, layer style, image assets, bounds, and section order.
- Run a React/Vite controlled editor console for the sample homepage LayerDoc.
- Edit an Analysis Plan panel that scaffolds homepage sections before building LayerDoc.
- Audit Analysis Plans before LayerDoc build with section coverage, track counts,
  blockers, and readiness evidence exposed in Studio, LayerDoc metadata,
  pipeline reports, and exported project handoff files.
- Upload a PNG in the browser to initialize Analysis Plan dimensions.
- Render a deterministic HTML preview with section, component, and layer DOM markers.
- Export a React + Tailwind component that preserves LayerDoc traceability.
- Project responsive rules into preview and exported React media-query CSS.
- Export an `integration-contract.json` mapping LayerDoc objects to project
  files, responsive rules, and DOM selectors for downstream integration;
  hidden sections stay editable in `layerdoc.json` without being required in
  rendered project surfaces or responsive CSS contract checks.
- Export a `handoff-summary.json` with the source LayerDoc hash, entry
  component, contract counts, verifier scores, audit status, and verification
  commands so CI or downstream importers can consume the package without
  scraping README text.
- Verify that exported integration contracts still match the LayerDoc source, generated project selectors, preview selectors, section order, layer bounds, layer style, layer copy, asset URIs, responsive CSS, and interaction metadata.
- Enforce Studio and exported quality gates against verifier scores, LayerDoc
  asset-compliance audit results, and visible-section editable coverage,
  including full-page bitmap, section-sized bitmap, and visual-only section
  risks.
- Report editable coverage at the visible-section level so reviewers can catch
  visual-only page regions even when the overall layer count looks healthy.
- Compare reference and candidate PNG screenshots and write a pixel diff image.
- Produce a verifier report with separate score dimensions.
- Write current verifier scores back into `LayerDoc.verification` so saved
  LayerDoc files carry quality state while screenshot evidence remains in the
  external verifier report.
- Preserve Analysis Plan provenance in `LayerDoc.metadata.analysisPlan` and
  exported project handoff files so downstream consumers can see whether the
  editable structure came from a seeded scaffold, provided plan, or editor
  review.
- Validate that provenance during Studio import, package export verification,
  and LayerDoc checks so broken source-of-structure metadata cannot silently
  enter the production chain.

The first target page type is an AI-generated marketing homepage with 8-15
sections/layers.

## Image Ingestion Boundary

The system does not let raw pixels leak into the editor or exporter. A visual
analysis pass first produces a controlled `HomepageAnalysisPlan`:

```ts
const plan = createHomepageAnalysisPlan({
  name: "AI homepage",
  canvas: { width: 1440, height: 1200 }
});

const annotated = addAnalysisLayer(plan, "hero", {
  id: "hero-title",
  kind: "text",
  bounds: { x: 120, y: 96, width: 620, height: 80 },
  text: "Launch faster"
});
```

The plan is the editable annotation artifact. A vision model, crop workbench,
or human operator can refine it without touching LayerDoc or generated code.

After the plan is confirmed, PNG intake turns it into an
`ImageAnalysisManifest`:

```ts
{
  name: "AI homepage",
  sourceImage: { uri: "/references/home.png", width: 1440, height: 1200 },
  sections: [
    {
      id: "hero",
      name: "Hero",
      bounds: { x: 0, y: 0, width: 1440, height: 640 },
      layers: [
        {
          id: "hero-title",
          kind: "text",
          bounds: { x: 120, y: 96, width: 620, height: 80 },
          text: "Launch faster"
        },
        {
          id: "hero-art",
          kind: "image",
          bounds: { x: 820, y: 72, width: 420, height: 280 },
          asset: { id: "hero-crop", uri: "/assets/hero.png" }
        }
      ]
    }
  ]
}
```

The rest of the system consumes the resulting LayerDoc.
The imported LayerDoc preserves `metadata.sourceImage` and
`metadata.analysisPlan` so exported packages and verification reports can trace
back to both the original AI visual and the confirmed structure source without
treating the PNG as the editable source.

For the homepage MVP, ingestion enforces 8-15 sections so the product stays
focused on real page structure rather than single-canvas bitmap conversion.
The editor can keep an empty section scaffold while analysis is in progress,
but LayerDoc build is blocked until every homepage section contains at least
one confirmed layer. PNG intake and ImageAnalysisManifest import enforce the
same section-coverage rule at the production boundary.

When the source is a real PNG, `createImageManifestFromPng` owns the file
boundary: it reads dimensions, writes deterministic reference crops for asset
layers, and returns the same manifest shape:

```ts
const manifest = createImageManifestFromPng({
  name: "AI homepage",
  sourcePngPath: "references/homepage.png",
  assetOutputDir: "public/assets/imported",
  publicAssetBaseUri: "/assets/imported",
  sections: toPngIntakeSections(annotated)
});

const layerDoc = createLayerDocFromImageManifest(manifest);
```

The analysis plan can come from a vision model, a crop workbench, or manual
review. The PNG intake module deliberately does not invent semantics by itself;
it only turns confirmed section/layer structure into project assets.

For end-to-end handoff, the homepage pipeline CLI can consume a confirmed plan
instead of the deterministic seed scaffold:

```bash
layerdoc-run-homepage \
  --input references/homepage.png \
  --analysis-plan analysis-plan.json \
  --out artifacts/homepage-run \
  --component ProductionHomepage
```

The resulting `pipeline-report.json` records whether the structure came from a
provided plan or from the seeded MVP scaffold.

The homepage pipeline CLI also copies the original input PNG into the exported
project as `reference.png`, so the handoff project can rerun visual verification
without manually locating the source image.

## Verification Dimensions

Verifier output must stay split by concern:

```text
visual_similarity   screenshot similarity against the reference
structure_score     editable structure and reference integrity
component_score     component grouping and exportability
project_fit_score   readiness for target project integration
```

Pixel similarity alone is not enough. A bitmap can look perfect while being a
poor engineering asset.

The visual score comes from real PNG comparison:

```ts
const visualDiff = comparePngSnapshots({
  referencePath: "artifacts/reference.png",
  candidatePath: "artifacts/candidate.png",
  diffPath: "artifacts/diff.png",
  threshold: 0.1
});

const report = createVerificationReport(layerDoc, { visualDiff });
```

Playwright or another renderer should own screenshot capture. The verifier only
compares stable files and merges the resulting visual score with LayerDoc graph
checks.

## Development

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

The codebase is TypeScript-first and uses Node's built-in test runner. New
behavior should be added test-first.

The current editor concept and implementation screenshots live in:

```text
docs/concepts/editor-console-concept.png
docs/concepts/editor-console-implementation.png
```

## Package Layout

```text
src/app/        React editor console and sample homepage LayerDoc
src/layerdoc/   schema, classification, validation, scoring
src/importers/  image-analysis manifest to LayerDoc conversion
src/editor/     controlled LayerDoc edit operations
src/exporters/  HTML preview and React/Tailwind projection
src/verifier/   score aggregation and issue reporting
test/           behavior tests for the production chain
```

## Product Boundary

The editor should be a controlled AI UI production console, not a Figma clone.
The MVP edits copy, colors, images, spacing, radius, buttons, section order,
visibility, preview modes, regeneration requests, export, and verifier runs.

Freeform vector editing, multiplayer design collaboration, and plugin
ecosystems are intentionally out of scope.

Controlled editor operations are plain LayerDoc transforms:

```ts
const styled = updateLayerStyle(layerDoc, "cta", {
  backgroundColor: "#111827",
  textColor: "#ffffff",
  borderRadius: 16,
  padding: { x: 24, y: 12 }
});

const swapped = updateImageLayerAsset(styled, "hero-image", {
  uri: "/assets/hero-v2.png",
  source: "uploaded"
});
```

Because these edits update LayerDoc, the same state can feed preview, export,
verification, and future undo/history without separate UI-specific state.
