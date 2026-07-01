import assert from "node:assert/strict";
import test from "node:test";

import { parseSectionRegenerationCandidateJson } from "../dist/app/sectionCandidateFile.js";

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
