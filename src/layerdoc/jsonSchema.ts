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

const verificationIssueSchema = {
  type: "object",
  required: ["code", "path", "message"],
  additionalProperties: false,
  properties: {
    code: {
      enum: [
        "asset_missing",
        "bounds_invalid",
        "bounds_outside_canvas",
        "duplicate_id",
        "layer_missing",
        "layer_section_mismatch",
        "responsive_target_missing",
        "section_empty",
        "section_missing",
        "track_mismatch"
      ]
    },
    path: { type: "string" },
    message: { type: "string" }
  }
};

/**
 * Publish the LayerDoc contract with exported packages so downstream projects
 * can validate the editable source without depending on this repository.
 */
export function createLayerDocJsonSchema(): Record<string, unknown> {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://layerdoc.ai/schemas/layerdoc-0.1.0.schema.json",
    title: "LayerDoc 0.1.0",
    type: "object",
    required: [
      "schema",
      "version",
      "metadata",
      "canvas",
      "tokens",
      "sections",
      "layers",
      "assets",
      "components",
      "interactions",
      "responsive",
      "generation",
      "verification"
    ],
    additionalProperties: false,
    properties: {
      schema: { const: "layerdoc" },
      version: { const: "0.1.0" },
      metadata: {
        type: "object",
        required: ["name", "createdAt"],
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 1 },
          createdAt: { type: "string" },
          sourceImage: {
            type: "object",
            required: ["uri", "width", "height"],
            additionalProperties: false,
            properties: {
              uri: { type: "string", minLength: 1 },
              width: { type: "number", exclusiveMinimum: 0 },
              height: { type: "number", exclusiveMinimum: 0 }
            }
          },
          analysisPlan: {
            type: "object",
            required: ["source", "name", "sectionCount", "layerCount"],
            additionalProperties: false,
            properties: {
              source: { enum: ["seeded", "provided", "editor", "manual"] },
              name: { type: "string", minLength: 1 },
              sectionCount: { type: "number", minimum: 0 },
              layerCount: { type: "number", minimum: 0 },
              uri: { type: "string", minLength: 1 }
            }
          }
        }
      },
      canvas: {
        type: "object",
        required: ["width", "height"],
        additionalProperties: false,
        properties: {
          width: { type: "number", exclusiveMinimum: 0 },
          height: { type: "number", exclusiveMinimum: 0 },
          background: { type: "string" }
        }
      },
      tokens: {
        type: "object",
        required: ["colors", "typography", "spacing", "radii"],
        additionalProperties: false,
        properties: {
          colors: { type: "object", additionalProperties: { type: "string" } },
          typography: { type: "object" },
          spacing: { type: "object", additionalProperties: { type: "number" } },
          radii: { type: "object", additionalProperties: { type: "number" } }
        }
      },
      sections: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "name", "bounds", "layerIds"],
          additionalProperties: false,
          properties: {
            id: { type: "string", minLength: 1 },
            name: { type: "string" },
            visible: { type: "boolean" },
            bounds: rectSchema,
            layerIds: { type: "array", items: { type: "string" } }
          }
        }
      },
      layers: {
        type: "array",
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
            sectionId: { type: "string" },
            assetId: { type: "string" },
            componentId: { type: "string" },
            style: {
              type: "object",
              additionalProperties: false,
              properties: {
                backgroundColor: { type: "string" },
                textColor: { type: "string" },
                borderColor: { type: "string" },
                borderRadius: { type: "number" },
                fontFamily: { type: "string" },
                fontSize: { type: "number", exclusiveMinimum: 0 },
                fontWeight: { type: "number", exclusiveMinimum: 0 },
                lineHeight: { type: "number", exclusiveMinimum: 0 },
                letterSpacing: { type: "number" },
                padding: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    x: { type: "number" },
                    y: { type: "number" },
                    top: { type: "number" },
                    right: { type: "number" },
                    bottom: { type: "number" },
                    left: { type: "number" }
                  }
                },
                gap: { type: "number" },
                opacity: { type: "number" }
              }
            },
            content: {
              type: "object",
              additionalProperties: true,
              properties: {
                text: { type: "string" },
                alt: { type: "string" }
              }
            }
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
            type: { enum: ["image", "video", "font", "json", "model", "other"] },
            source: { enum: ["reference-crop", "generated", "uploaded", "remote", "project"] },
            bounds: rectSchema,
            uri: { type: "string" }
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
            layerIds: { type: "array", items: { type: "string" } },
            exportable: { type: "boolean" },
            props: { type: "object" }
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
            layerId: { type: "string" },
            event: { enum: ["click", "hover", "focus", "input", "submit"] },
            action: { type: "string" }
          }
        }
      },
      responsive: {
        type: "object",
        required: ["breakpoints", "rules"],
        additionalProperties: false,
        properties: {
          breakpoints: { type: "object", additionalProperties: { type: "string" } },
          rules: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "query", "target", "changes"],
              additionalProperties: false,
              properties: {
                id: { type: "string", minLength: 1 },
                query: { type: "string" },
                target: {
                  type: "object",
                  required: ["type", "id"],
                  additionalProperties: false,
                  properties: {
                    type: { enum: ["section", "layer", "component"] },
                    id: { type: "string", minLength: 1 }
                  }
                },
                changes: { type: "object" }
              }
            }
          }
        }
      },
      generation: {
        type: "object",
        required: ["sectionRequests"],
        additionalProperties: false,
        properties: {
          sectionRequests: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "sectionId", "prompt", "status", "requestedAt"],
              additionalProperties: false,
              properties: {
                id: { type: "string", minLength: 1 },
                sectionId: { type: "string" },
                prompt: { type: "string" },
                status: { enum: ["requested", "running", "applied", "rejected"] },
                requestedAt: { type: "string" }
              }
            }
          }
        }
      },
      verification: {
        type: "object",
        required: ["scores", "issues"],
        additionalProperties: false,
        properties: {
          scores: {
            type: "object",
            required: ["visualSimilarity", "structureScore", "componentScore", "projectFitScore"],
            additionalProperties: false,
            properties: {
              visualSimilarity: { type: ["number", "null"] },
              structureScore: { type: ["number", "null"] },
              componentScore: { type: ["number", "null"] },
              projectFitScore: { type: ["number", "null"] }
            }
          },
          issues: {
            type: "array",
            items: verificationIssueSchema
          }
        }
      }
    }
  };
}
