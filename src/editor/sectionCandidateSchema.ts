const layerKinds = [
  "section",
  "group",
  "text",
  "button",
  "nav",
  "card",
  "form",
  "input",
  "list",
  "table",
  "image",
  "icon",
  "background",
  "chart",
  "map",
  "scene3d"
];

const layerTracks = ["component", "asset", "approximation", "layout"];
const assetTypes = ["image", "video", "font", "json", "model", "other"];
const assetSources = ["reference-crop", "generated", "uploaded", "remote", "project"];
const interactionEvents = ["click", "hover", "focus", "input", "submit"];

const rectSchema = {
  type: "object",
  required: ["x", "y", "width", "height"],
  additionalProperties: false,
  properties: {
    x: { type: "number" },
    y: { type: "number" },
    width: { type: "number", exclusiveMinimum: 0 },
    height: { type: "number", exclusiveMinimum: 0 }
  }
};

const styleSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    backgroundColor: { type: "string" },
    textColor: { type: "string" },
    borderColor: { type: "string" },
    borderRadius: { type: "number", minimum: 0 },
    fontFamily: { type: "string" },
    fontSize: { type: "number", exclusiveMinimum: 0 },
    fontWeight: { type: "number", minimum: 0 },
    lineHeight: { type: "number", exclusiveMinimum: 0 },
    letterSpacing: { type: "number" },
    padding: { type: "object", additionalProperties: { type: "number" } },
    gap: { type: "number", minimum: 0 },
    opacity: { type: "number", minimum: 0, maximum: 1 }
  }
};

const responsiveTargetSchema = {
  type: "object",
  required: ["type", "id"],
  additionalProperties: false,
  properties: {
    type: { enum: ["section", "layer", "component"] },
    id: { type: "string", minLength: 1 }
  }
};

/**
 * Publish the reviewed section regeneration candidate contract so AI workers,
 * Studio imports, and downstream handoff packages can agree on the object
 * shape before a candidate is applied to LayerDoc.
 */
export function createSectionRegenerationCandidateJsonSchema(): Record<string, unknown> {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://layerdoc.ai/schemas/section-regeneration-candidate-0.1.0.schema.json",
    title: "SectionRegenerationCandidate 0.1.0",
    type: "object",
    required: ["section", "layers"],
    additionalProperties: false,
    properties: {
      requestId: { type: "string", minLength: 1 },
      section: {
        type: "object",
        required: ["id", "name", "bounds", "layerIds"],
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          visible: { type: "boolean" },
          bounds: rectSchema,
          layerIds: { type: "array", items: { type: "string", minLength: 1 } }
        }
      },
      layers: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["id", "kind", "track", "editable", "bounds"],
          additionalProperties: false,
          properties: {
            id: { type: "string", minLength: 1 },
            kind: { enum: layerKinds },
            track: { enum: layerTracks },
            editable: { type: "boolean" },
            bounds: rectSchema,
            style: styleSchema,
            sectionId: { type: "string", minLength: 1 },
            assetId: { type: "string", minLength: 1 },
            componentId: { type: "string", minLength: 1 },
            content: { type: "object", additionalProperties: true }
          }
        }
      },
      assets: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "type", "source"],
          additionalProperties: false,
          properties: {
            id: { type: "string", minLength: 1 },
            type: { enum: assetTypes },
            source: { enum: assetSources },
            bounds: rectSchema,
            uri: { type: "string", minLength: 1 }
          }
        }
      },
      components: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "layerIds", "exportable"],
          additionalProperties: false,
          properties: {
            id: { type: "string", minLength: 1 },
            layerIds: { type: "array", items: { type: "string", minLength: 1 } },
            exportable: { type: "boolean" },
            props: { type: "object", additionalProperties: true }
          }
        }
      },
      interactions: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "layerId", "event", "action"],
          additionalProperties: false,
          properties: {
            id: { type: "string", minLength: 1 },
            layerId: { type: "string", minLength: 1 },
            event: { enum: interactionEvents },
            action: { type: "string", minLength: 1 }
          }
        }
      },
      responsiveRules: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "query", "target", "changes"],
          additionalProperties: false,
          properties: {
            id: { type: "string", minLength: 1 },
            query: { type: "string", minLength: 1 },
            target: responsiveTargetSchema,
            changes: { type: "object", additionalProperties: true }
          }
        }
      }
    }
  };
}
