import assert from "node:assert/strict";
import test from "node:test";

import { parseSectionRegenerationCandidateJson } from "../dist/app/sectionCandidateFile.js";
import { createSectionRegenerationCandidateJsonSchema } from "../dist/index.js";

test("parseSectionRegenerationCandidateJson imports a reviewed section candidate", () => {
  const candidate = parseSectionRegenerationCandidateJson(JSON.stringify({
    requestId: "regen-hero-1",
    section: {
      id: "hero",
      name: "Hero",
      bounds: { x: 0, y: 0, width: 1440, height: 360 },
      layerIds: ["hero-title"]
    },
    layers: [
      {
        id: "hero-title",
        sectionId: "hero",
        kind: "text",
        track: "component",
        editable: true,
        bounds: { x: 96, y: 72, width: 640, height: 80 },
        content: { text: "Reviewed candidate" }
      }
    ],
    components: [{ id: "RegeneratedHero", layerIds: ["hero-title"], exportable: true }]
  }));

  assert.equal(candidate.requestId, "regen-hero-1");
  assert.equal(candidate.section.id, "hero");
  assert.equal(candidate.layers[0].content.text, "Reviewed candidate");
  assert.deepEqual(candidate.assets, []);
  assert.deepEqual(candidate.interactions, []);
  assert.deepEqual(candidate.responsiveRules, []);
  assert.equal(candidate.components[0].id, "RegeneratedHero");
});

test("parseSectionRegenerationCandidateJson rejects malformed candidate JSON", () => {
  assert.throws(
    () => parseSectionRegenerationCandidateJson(JSON.stringify({ section: { id: "hero" }, layers: "not-array" })),
    /Section candidate layers must be an array/
  );
  assert.throws(
    () => parseSectionRegenerationCandidateJson("not json"),
    /Section candidate JSON is not valid/
  );
});

test("createSectionRegenerationCandidateJsonSchema publishes the regeneration worker output contract", () => {
  const schema = createSectionRegenerationCandidateJsonSchema();

  assert.equal(schema.title, "SectionRegenerationCandidate 0.1.0");
  assert.deepEqual(schema.required, ["section", "layers"]);
  assert.equal(schema.properties.section.properties.id.minLength, 1);
  assert.deepEqual(schema.properties.section.properties.layerIds.items, { type: "string", minLength: 1 });
  assert.deepEqual(schema.properties.layers.items.required, ["id", "kind", "track", "editable", "bounds"]);
  assert.equal(schema.properties.layers.items.properties.kind.enum.includes("button"), true);
  assert.equal(schema.properties.layers.items.properties.track.enum.includes("component"), true);
  assert.equal(schema.properties.assets.items.properties.source.enum.includes("generated"), true);
  assert.equal(schema.properties.responsiveRules.items.properties.target.properties.type.enum.includes("section"), true);
});
