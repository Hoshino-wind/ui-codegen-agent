export type FrameworkTarget = "react" | "next" | "vue" | "unknown";

export type LayerType =
  | "frame"
  | "group"
  | "text"
  | "shape"
  | "image"
  | "icon"
  | "chart"
  | "map"
  | "scene-3d";

export type ComponentKind =
  | "page"
  | "section"
  | "card"
  | "button"
  | "input"
  | "select"
  | "tabs"
  | "table"
  | "list"
  | "badge"
  | "nav"
  | "modal"
  | "chart"
  | "media"
  | "custom";

export type ReviewStatus = "unconfirmed" | "confirmed" | "needs-decision";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesignMeta {
  id: string;
  name: string;
  source: "ai-generated" | "imported";
  createdAt: string;
}

export interface Frame {
  width: number;
  height: number;
  background: string;
  deviceScaleFactor?: number;
}

export interface TypographyToken {
  id: string;
  family: string;
  size: number;
  weight: number;
  lineHeight: number;
  usage?: string;
}

export interface DesignTokens {
  colors: Record<string, string>;
  typography: Record<string, TypographyToken>;
  spacing: Record<string, number>;
  radius: Record<string, number>;
  shadows: Record<string, string>;
}

export interface LayerNode {
  id: string;
  type: LayerType;
  name: string;
  bounds: Rect;
  zIndex: number;
  text?: string;
  tokenRefs?: Record<string, string>;
  children?: LayerNode[];
}

export interface ComponentNode {
  id: string;
  kind: ComponentKind;
  name: string;
  bounds: Rect;
  layerIds: string[];
  variant?: string;
  props?: Record<string, unknown>;
  tokenRefs?: Record<string, string>;
  children?: ComponentNode[];
  reviewStatus: ReviewStatus;
}

export interface DataContract {
  id: string;
  componentId: string;
  shape: "object" | "array";
  fields: Record<string, string>;
  mockData: unknown;
  source: "ai-generated" | "human-confirmed" | "project";
}

export interface InteractionContract {
  id: string;
  componentId: string;
  trigger: "click" | "hover" | "focus" | "submit" | "change";
  behavior: string;
  states?: string[];
  reviewStatus: ReviewStatus;
}

export interface AssetContract {
  id: string;
  componentId: string;
  kind: "icon" | "photo" | "avatar" | "logo" | "chart-library" | "map-library" | "three-library";
  strategy: "project-asset" | "generated-asset" | "library" | "external-url";
  source?: string;
  reviewStatus: ReviewStatus;
}

export interface CodegenIntent {
  framework: FrameworkTarget;
  finalDir: string;
  componentMappings: Record<string, string>;
  tokenMappings: Record<string, string>;
  verificationCommands: string[];
}

export interface ReviewState {
  status: ReviewStatus;
  confirmedBy?: string;
  confirmedAt?: string;
  openQuestions: string[];
}

export interface DesignIR {
  meta: DesignMeta;
  frame: Frame;
  layers: LayerNode[];
  tokens: DesignTokens;
  components: ComponentNode[];
  data: DataContract[];
  interactions: InteractionContract[];
  assets: AssetContract[];
  codegen: CodegenIntent;
  review: ReviewState;
}

