export type LayerTrack = "component" | "asset" | "approximation" | "layout";

export type LayerKind =
  | "section"
  | "group"
  | "text"
  | "button"
  | "nav"
  | "card"
  | "form"
  | "input"
  | "list"
  | "table"
  | "image"
  | "icon"
  | "background"
  | "chart"
  | "map"
  | "scene3d";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Canvas {
  width: number;
  height: number;
  background?: string;
}

export interface TokenSet {
  colors: Record<string, string>;
  typography: Record<string, unknown>;
  spacing: Record<string, number>;
  radii: Record<string, number>;
}

export interface SectionNode {
  id: string;
  name: string;
  visible?: boolean;
  bounds: Rect;
  layerIds: string[];
}

export interface LayerSpacing {
  x?: number;
  y?: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface LayerStyle {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: LayerSpacing;
  gap?: number;
  opacity?: number;
}

export interface LayerNode {
  id: string;
  kind: LayerKind;
  track: LayerTrack;
  editable: boolean;
  bounds: Rect;
  style?: LayerStyle;
  sectionId?: string;
  assetId?: string;
  componentId?: string;
  content?: {
    text?: string;
    alt?: string;
    [key: string]: unknown;
  };
}

export interface AssetNode {
  id: string;
  type: "image" | "video" | "font" | "json" | "model" | "other";
  source: "reference-crop" | "generated" | "uploaded" | "remote" | "project";
  bounds?: Rect;
  uri?: string;
}

export interface ComponentNode {
  id: string;
  layerIds: string[];
  exportable: boolean;
  props?: Record<string, unknown>;
}

export interface InteractionNode {
  id: string;
  layerId: string;
  event: "click" | "hover" | "focus" | "input" | "submit";
  action: string;
}

export interface ResponsiveRule {
  id: string;
  query: string;
  changes: Record<string, unknown>;
}

export interface VerificationScores {
  visualSimilarity: number | null;
  structureScore: number | null;
  componentScore: number | null;
  projectFitScore: number | null;
}

export interface LayerDoc {
  schema: "layerdoc";
  version: "0.1.0";
  metadata: {
    name: string;
    createdAt: string;
  };
  canvas: Canvas;
  tokens: TokenSet;
  sections: SectionNode[];
  layers: LayerNode[];
  assets: AssetNode[];
  components: ComponentNode[];
  interactions: InteractionNode[];
  responsive: {
    breakpoints: Record<string, string>;
    rules: ResponsiveRule[];
  };
  verification: {
    scores: VerificationScores;
    issues: VerificationIssue[];
  };
}

export interface CreateLayerDocInput {
  name: string;
  canvas: Canvas;
  tokens?: Partial<TokenSet>;
  sections?: SectionNode[];
  layers?: LayerNode[];
  assets?: AssetNode[];
  components?: ComponentNode[];
  interactions?: InteractionNode[];
  responsive?: Partial<LayerDoc["responsive"]>;
}

export type VerificationIssueCode =
  | "asset_missing"
  | "bounds_invalid"
  | "bounds_outside_canvas"
  | "duplicate_id"
  | "layer_missing"
  | "section_missing"
  | "track_mismatch";

export interface VerificationIssue {
  code: VerificationIssueCode;
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: VerificationIssue[];
}

export interface ProjectFitScore {
  projectFitScore: number;
  assetCoverageRatio: number;
  fullPageBitmapRisk: boolean;
}
