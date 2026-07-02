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

const analysisPlanTrackCountsSchema = {
  type: "object",
  required: layerTracks,
  additionalProperties: false,
  properties: Object.fromEntries(layerTracks.map((track) => [track, { type: "number", minimum: 0 }]))
};

const analysisPlanSectionAuditSchema = {
  type: "object",
  required: ["sectionId", "name", "layerCount", "editableLayerCount", "tracks"],
  additionalProperties: false,
  properties: {
    sectionId: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    layerCount: { type: "number", minimum: 0 },
    editableLayerCount: { type: "number", minimum: 0 },
    tracks: analysisPlanTrackCountsSchema
  }
};

const analysisPlanAuditSchema = {
  type: "object",
  required: ["summary", "tracks", "coverage", "readiness", "issues", "sectionBreakdown"],
  additionalProperties: false,
  properties: {
    summary: {
      type: "object",
      required: ["sections", "layers", "editableLayers"],
      additionalProperties: false,
      properties: {
        sections: { type: "number", minimum: 0 },
        layers: { type: "number", minimum: 0 },
        editableLayers: { type: "number", minimum: 0 }
      }
    },
    tracks: analysisPlanTrackCountsSchema,
    coverage: {
      type: "object",
      required: ["sectionsWithLayers", "emptySectionIds"],
      additionalProperties: false,
      properties: {
        sectionsWithLayers: { type: "number", minimum: 0 },
        emptySectionIds: { type: "array", items: { type: "string" } }
      }
    },
    readiness: {
      type: "object",
      required: ["sectionRangeOk", "validPlan", "allSectionsHaveLayers", "readyForLayerDoc", "blockers"],
      additionalProperties: false,
      properties: {
        sectionRangeOk: { type: "boolean" },
        validPlan: { type: "boolean" },
        allSectionsHaveLayers: { type: "boolean" },
        readyForLayerDoc: { type: "boolean" },
        blockers: { type: "array", items: { type: "string" } }
      }
    },
    issues: { type: "array", items: { type: "string" } },
    sectionBreakdown: { type: "array", items: analysisPlanSectionAuditSchema }
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
        "metadata_invalid",
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

const verificationVisualProblemAreaSchema = {
  type: "object",
  required: [
    "id",
    "bounds",
    "affectedLayerId",
    "affectedLayerKind",
    "affectedLayerTrack",
    "affectedLayerEditable",
    "affectedSectionId"
  ],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    bounds: rectSchema,
    affectedLayerId: { type: ["string", "null"] },
    affectedLayerKind: { enum: [...layerKinds, null] },
    affectedLayerTrack: { enum: [...layerTracks, null] },
    affectedLayerEditable: { type: ["boolean", "null"] },
    affectedSectionId: { type: ["string", "null"] }
  }
};

const sectionRegenerationGraphSnapshotSchema = {
  type: "object",
  required: ["section", "layers", "assets", "components", "interactions", "responsiveRules"],
  additionalProperties: false,
  properties: {
    section: {
      type: "object",
      required: ["id", "name", "bounds", "layerIds"],
      additionalProperties: true,
      properties: {
        id: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        bounds: rectSchema,
        layerIds: { type: "array", items: { type: "string", minLength: 1 } }
      }
    },
    layers: { type: "array", items: { type: "object", required: ["id", "kind", "track", "editable", "bounds"], additionalProperties: true } },
    assets: { type: "array", items: { type: "object", required: ["id", "type", "source"], additionalProperties: true } },
    components: { type: "array", items: { type: "object", required: ["id", "layerIds", "exportable"], additionalProperties: true } },
    interactions: { type: "array", items: { type: "object", required: ["id", "layerId", "event", "action"], additionalProperties: true } },
    responsiveRules: { type: "array", items: { type: "object", required: ["id", "query", "target", "changes"], additionalProperties: true } }
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
          },
          analysisPlanAudit: analysisPlanAuditSchema
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
        required: ["sectionRequests", "sectionApplications"],
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
                status: { enum: ["requested", "running", "applied", "rejected", "reverted"] },
                requestedAt: { type: "string" }
              }
            }
          },
          sectionApplications: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "sectionId", "status", "appliedAt", "previous", "applied"],
              additionalProperties: false,
              properties: {
                id: { type: "string", minLength: 1 },
                sectionId: { type: "string", minLength: 1 },
                requestId: { type: "string", minLength: 1 },
                status: { enum: ["applied", "reverted"] },
                appliedAt: { type: "string" },
                revertedAt: { type: "string" },
                previous: sectionRegenerationGraphSnapshotSchema,
                applied: sectionRegenerationGraphSnapshotSchema
              }
            }
          }
        }
      },
      verification: {
        type: "object",
        required: ["scores", "issues", "visualProblemAreas"],
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
          },
          visualProblemAreas: {
            type: "array",
            items: verificationVisualProblemAreaSchema
          }
        }
      }
    }
  };
}
