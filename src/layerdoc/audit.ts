import { scoreProjectFit } from "./scoring.js";
import { validateLayerDoc } from "./validation.js";
import type { AssetNode, LayerDoc, LayerNode, LayerTrack, Rect, VerificationIssue } from "./types.js";

export interface LayerDocTrackCounts {
  component: number;
  asset: number;
  approximation: number;
  layout: number;
}

export interface LayerDocAuditSummary {
  sections: number;
  layers: number;
  editableLayers: number;
  components: number;
  exportableComponents: number;
  assets: number;
  interactions: number;
  responsiveRules: number;
}

export interface LayerDocRiskyAsset {
  id: string;
  coverageRatio: number;
}

export interface LayerDocRiskySectionAsset {
  sectionId: string;
  assetId: string;
  coverageRatio: number;
}

export interface LayerDocAssetCompliance {
  passed: boolean;
  assetCoverageRatio: number;
  fullPageBitmapRisk: boolean;
  riskyAssets: LayerDocRiskyAsset[];
  riskySectionAssets: LayerDocRiskySectionAsset[];
  findings: string[];
}

export interface LayerDocStructureAudit {
  valid: boolean;
  issues: VerificationIssue[];
}

export interface LayerDocSectionAudit {
  sectionId: string;
  name: string;
  visible: boolean;
  layerCount: number;
  editableLayerCount: number;
  tracks: LayerDocTrackCounts;
}

export interface LayerDocAudit {
  summary: LayerDocAuditSummary;
  tracks: LayerDocTrackCounts;
  structure: LayerDocStructureAudit;
  assetCompliance: LayerDocAssetCompliance;
  sectionBreakdown: LayerDocSectionAudit[];
}

const trackOrder: LayerTrack[] = ["component", "asset", "approximation", "layout"];

function emptyTrackCounts(): LayerDocTrackCounts {
  return {
    component: 0,
    asset: 0,
    approximation: 0,
    layout: 0
  };
}

function countTracks(layers: LayerNode[]): LayerDocTrackCounts {
  const counts = emptyTrackCounts();
  for (const layer of layers) {
    counts[layer.track] += 1;
  }
  return counts;
}

function area(rect: Rect | undefined): number {
  return rect ? Math.max(0, rect.width) * Math.max(0, rect.height) : 0;
}

function intersection(left: Rect, right: Rect): Rect {
  const x1 = Math.max(left.x, right.x);
  const y1 = Math.max(left.y, right.y);
  const x2 = Math.min(left.x + left.width, right.x + right.width);
  const y2 = Math.min(left.y + left.height, right.y + right.height);

  return {
    x: x1,
    y: y1,
    width: Math.max(0, x2 - x1),
    height: Math.max(0, y2 - y1)
  };
}

function ratio(part: number, whole: number): number {
  return Math.round((part / Math.max(1, whole)) * 100) / 100;
}

function riskyAssets(assets: AssetNode[], canvasArea: number): LayerDocRiskyAsset[] {
  return assets
    .map((asset) => ({ id: asset.id, coverageRatio: ratio(area(asset.bounds), canvasArea) }))
    .filter((asset) => asset.coverageRatio > 0.5);
}

function riskySectionAssets(doc: LayerDoc): LayerDocRiskySectionAsset[] {
  const byId = new Map(doc.layers.map((layer) => [layer.id, layer]));
  const threshold = 0.8;

  return doc.sections.flatMap((section) =>
    section.layerIds.flatMap((layerId) => {
      const layer = byId.get(layerId);
      if (!layer?.assetId || layer.kind !== "image" || layer.track !== "asset") {
        return [];
      }

      const coverageRatio = ratio(area(intersection(layer.bounds, section.bounds)), area(section.bounds));
      if (coverageRatio <= threshold) {
        return [];
      }

      return [{ sectionId: section.id, assetId: layer.assetId, coverageRatio }];
    })
  );
}

function assetFindings(
  fullPageBitmapRisk: boolean,
  assetCoverageRatio: number,
  assetIssues: VerificationIssue[],
  sectionAssets: LayerDocRiskySectionAsset[]
): string[] {
  const findings: string[] = [];
  if (fullPageBitmapRisk) {
    findings.push(`Potential full-page bitmap shortcut: asset coverage is ${assetCoverageRatio}.`);
  }
  if (sectionAssets.length > 0) {
    findings.push(`Potential section bitmap shortcut: ${sectionAssets.length} section asset(s) cover most of their section.`);
  }
  if (assetIssues.length > 0) {
    findings.push(`${assetIssues.length} asset reference issue(s) found.`);
  }
  return findings;
}

/**
 * Turn the LayerDoc graph into an audit artifact a project reviewer can inspect
 * without reverse-engineering scores or reading generated code.
 */
export function createLayerDocAudit(doc: LayerDoc): LayerDocAudit {
  const validation = validateLayerDoc(doc);
  const projectFit = scoreProjectFit(doc);
  const canvasArea = doc.canvas.width * doc.canvas.height;
  const assetIssues = validation.issues.filter((issue) => issue.code === "asset_missing");
  const sectionAssets = projectFit.fullPageBitmapRisk ? [] : riskySectionAssets(doc);

  return {
    summary: {
      sections: doc.sections.length,
      layers: doc.layers.length,
      editableLayers: doc.layers.filter((layer) => layer.editable).length,
      components: doc.components.length,
      exportableComponents: doc.components.filter((component) => component.exportable).length,
      assets: doc.assets.length,
      interactions: doc.interactions.length,
      responsiveRules: doc.responsive.rules.length
    },
    tracks: countTracks(doc.layers),
    structure: {
      valid: validation.valid,
      issues: validation.issues
    },
    assetCompliance: {
      passed: !projectFit.fullPageBitmapRisk && sectionAssets.length === 0 && assetIssues.length === 0,
      assetCoverageRatio: projectFit.assetCoverageRatio,
      fullPageBitmapRisk: projectFit.fullPageBitmapRisk,
      riskyAssets: riskyAssets(doc.assets, canvasArea),
      riskySectionAssets: sectionAssets,
      findings: assetFindings(projectFit.fullPageBitmapRisk, projectFit.assetCoverageRatio, assetIssues, sectionAssets)
    },
    sectionBreakdown: doc.sections.map((section) => {
      const sectionLayers = section.layerIds
        .map((layerId) => doc.layers.find((layer) => layer.id === layerId))
        .filter((layer): layer is LayerNode => Boolean(layer));
      const tracks = countTracks(sectionLayers);

      for (const track of trackOrder) {
        tracks[track] = tracks[track] ?? 0;
      }

      return {
        sectionId: section.id,
        name: section.name,
        visible: section.visible !== false,
        layerCount: sectionLayers.length,
        editableLayerCount: sectionLayers.filter((layer) => layer.editable).length,
        tracks
      };
    })
  };
}
