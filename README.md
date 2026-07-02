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
- `generation`: queued section regeneration requests plus applied/reverted
  section graph snapshots for traceable rollback.
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
- Export controlled editor edit history as `edit-audit.json`, with applied and
  undone operations, affected layer ids, affected section ids, and handoff
  summary coverage that project-local verification can validate.
- Run a React/Vite controlled editor console for the sample homepage LayerDoc.
- Edit an Analysis Plan panel that scaffolds homepage sections before building LayerDoc.
- Audit Analysis Plans before LayerDoc build with section coverage, track counts,
  blockers, and readiness evidence exposed in Studio, LayerDoc metadata,
  pipeline reports, and exported project handoff files.
- Create a model-ready homepage analysis task package from a source PNG, including
  schema handoff, classification tracks, acceptance gates, and anti-bitmap
  constraints for the vision/manual decomposition step.
- Preserve that decomposition task as `analysis-task.json` inside project
  packages when Analysis Plan provenance exists, so downstream reviewers can
  audit what the vision/manual step was asked to produce.
- Upload a PNG in the browser to initialize Analysis Plan dimensions.
- Render a deterministic HTML preview with section, component, and layer DOM markers.
- Overlay the source PNG on top of Canvas/HTML preview with controlled opacity
  so operators can align LayerDoc objects against the reference visual.
- Export a React + Tailwind component that preserves LayerDoc traceability.
- Expose current verifier scores as root `data-verification-*` attributes in both
  HTML preview and React/Tailwind export surfaces.
- Expose root `data-verification-issues`,
  `data-verification-structural-blockers`, and
  `data-verification-track-notes` separately so downstream DOM checks do not
  confuse non-blocking track notes with delivery blockers.
- Project responsive rules into preview and exported React media-query CSS.
- Export an `integration-contract.json` mapping LayerDoc objects to project
  files, responsive rules, DOM selectors, and queued section regeneration
  requests for downstream integration; it also binds root `data-verification-*`
  quality attributes in both project and preview surfaces. Hidden sections stay
  editable in `layerdoc.json` without being required in rendered project
  surfaces or responsive CSS contract checks.
- Apply reviewed section regeneration candidates back into LayerDoc by
  replacing one stable section id with new layers, assets, components,
  interactions, and responsive rules, then refreshing preview, React export,
  verifier state, and project package output from the updated graph.
- Record every accepted section candidate in `generation.sectionApplications`
  with before/after section graph snapshots, expose the history in project
  contracts and handoff summaries, and let Studio revert the latest applied
  candidate for a section.
- Export `section-candidate.schema.json` with project packages so AI workers
  and Studio imports share a verifiable contract for reviewed regeneration
  results, plus an exported `verify:section-candidate` script that checks a
  candidate against the current LayerDoc section graph before it is applied and
  an exported `apply:section-candidate` script that rewrites `layerdoc.json`,
  `integration-contract.json`, `handoff-summary.json`, `preview.html`, and the
  React component from the accepted candidate, plus `verify:section-application`
  to verify, apply, refresh preview screenshot evidence, recheck handoff
  artifacts, and enforce gates in one project-local command.
- Export a `handoff-summary.json` with the source LayerDoc hash, entry
  component, contract counts, regeneration request/application counts, verifier
  scores, audit status, optional controlled edit audit summary, and
  verification commands so CI or downstream importers can consume the package
  without scraping README text.
- Export a `production-manifest.json` as the recommended project integration
  entrypoint, tying the editable LayerDoc source, generated React component,
  HTML preview, integration contract, asset index, quality gates, and section
  regeneration commands into one stable file.
- Export a `backtest-runbook.json` with homepage backtest, pipeline,
  materialization, and project-local verification commands so Studio, CLI
  packages, and materialized projects share one machine-readable runbook.
- Export a `ci-workflow.json` with install, preview verification, structural
  verification, gate enforcement, and build phases so downstream CI systems can
  ingest the generated project without scraping README text.
- Export `production-manifest.schema.json` so downstream importers and CI can
  validate that project integration entrypoint before ingesting generated UI.
- Export a project-local `verify:production-manifest` command for validating
  that integration entrypoint without running the entire handoff chain.
- Export a project-local `verify:ci-workflow` command and `npm run ci` script
  for validating and running the generated project automation contract.
- Export an `asset-index.json` that inventories LayerDoc assets by source/type,
  usage, visible-project inclusion, section/component ownership, and DOM
  selectors so downstream project importers can wire media without reverse
  engineering `layerdoc.json` or rendered HTML.
- Verify that exported integration contracts still match the LayerDoc source, generated project selectors, preview selectors, section order, layer bounds, layer style, layer copy, asset URIs, responsive CSS, and interaction metadata.
- Enforce Studio and exported quality gates against verifier scores, LayerDoc
  asset-compliance audit results, and visible-section editable coverage,
  including full-page bitmap, section-sized bitmap, and visual-only section
  risks.
- Report editable coverage at the visible-section level so reviewers can catch
  visual-only page regions even when the overall layer count looks healthy.
- Compare reference and candidate PNG screenshots and write a pixel diff image.
- Produce a verifier report with separate score dimensions and a
  `structureBreakdown` explaining structural blockers versus track notes,
  `componentBreakdown` explaining component-layer coverage, and a
  `projectFitBreakdown` explaining the project integration score from baseline,
  exportable components, editable component layers, asset coverage, and bitmap
  shortcut risk.
- Write current verifier scores back into `LayerDoc.verification` so saved
  LayerDoc files carry quality state while screenshot evidence remains in the
  external verifier report.
- Sync exported preview verification back into `layerdoc.json`, package
  manifests, `production-manifest.json`, handoff summaries, integration
  contracts, and rendered root `data-verification-*` attributes so rerunning
  project verification stays self-consistent after a screenshot diff.
- Preserve uploaded PNG references in Studio project exports as `reference.png`
  so browser-built handoff packages can rerun visual verification like CLI
  pipeline packages.
- Run exported project verification in preview-first order so screenshot diff
  state is synchronized before handoff, LayerDoc, contract, and quality-gate
  checks read the package.
- Run a deterministic homepage backtest that generates a mock AI visual PNG,
  executes PNG intake, LayerDoc build, preview diff, project export, production
  manifest validation, and project verification in one command.
- Preserve Analysis Plan provenance in `LayerDoc.metadata.analysisPlan` and
  exported project handoff files so downstream consumers can see whether the
  editable structure came from a seeded scaffold, provided plan, editor
  review, manual plan, or mock vision decomposition.
- Validate that provenance during Studio import, package export verification,
  and LayerDoc checks so broken source-of-structure metadata cannot silently
  enter the production chain.
- Derive the Studio workflow sidebar from real source, LayerDoc, editable-layer,
  HTML preview, React export, visual evidence, and quality-gate state so the
  console shows the first incomplete production stage instead of a static
  progress list.

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

Before asking a vision worker or human operator to decompose the PNG, create a
task package that carries the source canvas, the HomepageAnalysisPlan schema,
the 8-15 section requirement, classification tracks, and anti-bitmap
constraints:

```bash
npm run create:analysis-task -- \
  --input references/homepage.png \
  --out artifacts/analysis-task \
  --name "AI homepage"
```

It writes `analysis-task.json` and `analysis-plan.schema.json`. In Studio, the
same Save Task action produces a ZIP package; when the PNG was uploaded in the
browser, that ZIP also includes `source.png` and the task points to it. The task
package is the model-facing handoff for producing `analysis-plan.json`; the
image still does not become the editable source of truth. Project packages that
carry Analysis Plan provenance also include `analysis-task.json`, and the
exported `verify:analysis-plan` command checks that it still matches the source
image, schema contract, and 8-15 section requirement.

Before LayerDoc build, the standalone verifier can audit that structure without
running the full homepage pipeline:

```bash
npm run verify:analysis-plan -- \
  --input analysis-plan.json \
  --source references/homepage.png \
  --out artifacts/analysis-plan-check
```

It writes `analysis-plan-audit.json` with section coverage, layer counts, track
counts, and blockers, plus `analysis-plan.schema.json` for model, editor, and
CI handoff. The command exits `2` when the JSON is parseable but not ready for
LayerDoc, and exits `1` for command, schema, or source-canvas errors.

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
provided plan or from the seeded MVP scaffold. Studio-built LayerDocs also
record whether their intake structure came from manual edits, imported plans,
editor helpers, or the deterministic Mock Vision decomposition boundary.
When Studio imports an Analysis Plan JSON file, the uploaded filename is carried
into `LayerDoc.metadata.analysisPlan.uri`, exported manifests, and
`handoff-summary.json` so downstream consumers can trace the exact structure
artifact used before LayerDoc build.

For MVP backtests, add `--verify-project` so the exported project runs its own
preview diff, handoff, source, LayerDoc, integration-contract, and gate checks:

```bash
npm run pipeline:homepage -- \
  --input references/homepage.png \
  --candidate artifacts/candidate.png \
  --analysis-plan analysis-plan.json \
  --out artifacts/homepage-run \
  --component ProductionHomepage \
  --verify-project
```

The project verification result is written into `pipeline-report.json` under
`project.verification`, and the generated project receives
`verification-artifacts/diff.png` plus synced score attributes.

The homepage pipeline CLI also writes the original input PNG into the exported
project package as `reference.png`, so the handoff project can rerun visual
verification without manually locating the source image.

For a deterministic smoke test of the whole MVP chain, run the homepage
backtest. It creates `source.png` and `candidate.png`, runs the same pipeline
with project verification enabled, and writes `backtest-report.json`:

```bash
npm run build:lib
npm run backtest:homepage -- \
  --out artifacts/homepage-backtest \
  --component ProductionHomepage
```

The Studio Project Package panel shows this command next to the lower-level
pipeline/materialize commands, and Save Backtest downloads the same
`backtest-runbook.json` artifact included in the exported project package.

Studio JSON handoffs are also materializable: binary files are represented as
base64 entries in `project-package.json`, and `parseProjectExportPackageJson`
plus `writeProjectExportPackage` can restore the package into a runnable project
directory.

```bash
npm run materialize:project -- \
  --input artifacts/project-package.json \
  --out artifacts/materialized-project \
  --verify-structure
```

`--verify-structure` runs the generated production manifest, CI workflow,
handoff, Analysis Plan, Image Manifest, LayerDoc, and integration contract
verifiers. Visual screenshot diff still runs from the materialized project with
`npm run verify:preview`; reviewed section candidates can use the project-local
application verifier to combine apply, preview diff, structure checks, and
gates.

```bash
npm run verify:section-application -- \
  --section hero \
  --input hero-candidate.json \
  --reference reference.png
```

```bash
npm run materialize:project -- \
  --input artifacts/project-package.json \
  --out artifacts/materialized-project \
  --verify-quality
```

`--verify-quality` extends the structure chain with `scripts/verify-gates.mjs`,
so handoff packages that already contain visual evidence can enforce the stored
score thresholds immediately after materialization.

```bash
npm run materialize:project -- \
  --input artifacts/project-package.json \
  --out artifacts/materialized-project \
  --verify-preview \
  --candidate artifacts/candidate.png
```

`--verify-preview` runs the generated `scripts/verify-preview.mjs` before the
structure and gate checks. Passing `--candidate` uses a pre-rendered PNG for
deterministic screenshot diff; omitting it lets the generated verifier capture
`preview.html` with Playwright.

## Verification Dimensions

Verifier output must stay split by concern:

```text
visual_similarity   screenshot similarity against the reference
structure_score     editable structure and reference integrity
component_score     component grouping and exportability
project_fit_score   readiness for target project integration
```

`structure_score` is emitted with `structureBreakdown`, `component_score` is
emitted with `componentBreakdown`, and `project_fit_score` is emitted with
`projectFitBreakdown`, in `verification-report.json`, `handoff-summary.json`,
and `production-manifest.json`. Downstream CI can see which structural issues
block delivery, which component-track layers are covered by real components,
and whether project fit was held back by bitmap shortcut risk.
Quality gates use `structureBreakdown.structuralIssueCount` for structural
blocking; `track_mismatch` remains visible as a track note without failing the
handoff by itself.

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
visibility, preview modes, regeneration requests, reviewed section candidates,
undo/redo history, export, and verifier runs.

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
verification, and editor undo/redo without separate UI-specific state. When the
workspace is exported, that history is materialized as `edit-audit.json` rather
than trapped in the browser session:

```json
{
  "kind": "controlled_editor_edit_audit",
  "summary": {
    "appliedEdits": 2,
    "undoneEdits": 1,
    "operations": { "update-text": 1, "move-section": 1 }
  }
}
```

`scripts/verify-handoff.mjs` recomputes that summary from the audit entries and
checks that `handoff-summary.json` points at the same evidence.
