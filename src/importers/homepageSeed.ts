import { addAnalysisLayer, type HomepageAnalysisPlan } from "./homepageAnalysisPlan.js";
import type { PngIntakeLayerPlan } from "./pngIntake.js";
import type { Rect } from "../layerdoc/types.js";

function hasLayer(plan: HomepageAnalysisPlan, layerId: string): boolean {
  return plan.sections.some((section) => section.layers.some((layer) => layer.id === layerId));
}

function addLayerIfMissing(plan: HomepageAnalysisPlan, sectionId: string, layer: PngIntakeLayerPlan): HomepageAnalysisPlan {
  if (hasLayer(plan, layer.id)) {
    return plan;
  }
  return addAnalysisLayer(plan, sectionId, layer);
}

function sectionById(plan: HomepageAnalysisPlan, sectionId: string) {
  const section = plan.sections.find((candidate) => candidate.id === sectionId);
  if (!section) {
    throw new Error(`Section "${sectionId}" was not found.`);
  }
  return section;
}

function clampRectToSection(rect: Rect, sectionBounds: Rect): Rect {
  const width = Math.max(1, Math.min(rect.width, sectionBounds.width));
  const height = Math.max(1, Math.min(rect.height, sectionBounds.height));
  const x = Math.min(Math.max(rect.x, sectionBounds.x), sectionBounds.x + sectionBounds.width - width);
  const y = Math.min(Math.max(rect.y, sectionBounds.y), sectionBounds.y + sectionBounds.height - height);

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height)
  };
}

function seededSectionCopy(sectionId: string, sectionName: string): { title: string; detail: string; detailKind?: "button" } {
  const copy: Record<string, { title: string; detail: string; detailKind?: "button" }> = {
    proof: {
      title: "Structure score is separated from visual",
      detail: "100 structure / 100 component / tracked assets"
    },
    workflow: {
      title: "Image analysis becomes an editable graph",
      detail: "8 sections, 18 layers, one source of truth."
    },
    features: {
      title: "LayerDoc source of truth",
      detail: "Canvas, tokens, sections, layers, assets, components."
    },
    editor: {
      title: "Operators edit copy, color, assets, and section order.",
      detail: "No freeform vector surface. Every control writes LayerDoc."
    },
    export: {
      title: "React + Tailwind export preserves structure",
      detail: "data-layer-id and data-section-id survive export."
    },
    verifier: {
      title: "Screenshot diff joins structural validation.",
      detail: "Visual, structure, component, and project-fit scores."
    },
    "final-cta": {
      title: "Turn the approved visual into a project package.",
      detail: "Export React",
      detailKind: "button"
    }
  };

  return copy[sectionId] ?? {
    title: `${sectionName} becomes editable`,
    detail: "Classified layer ready for LayerDoc export."
  };
}

function seededSectionLayer(plan: HomepageAnalysisPlan, sectionId: string, kind: "title" | "detail"): PngIntakeLayerPlan {
  const section = sectionById(plan, sectionId);
  const copy = seededSectionCopy(sectionId, section.name);
  const gutter = Math.min(80, Math.max(24, Math.round(section.bounds.width * 0.055)));
  const titleBounds = clampRectToSection(
    {
      x: section.bounds.x + gutter,
      y: section.bounds.y + Math.min(36, Math.max(14, Math.round(section.bounds.height * 0.14))),
      width: Math.min(560, section.bounds.width - gutter * 2),
      height: 34
    },
    section.bounds
  );
  const detailBounds = clampRectToSection(
    {
      x: titleBounds.x,
      y: titleBounds.y + titleBounds.height + 10,
      width: kind === "detail" && copy.detailKind === "button" ? Math.min(184, titleBounds.width) : Math.min(540, titleBounds.width),
      height: kind === "detail" && copy.detailKind === "button" ? 44 : 36
    },
    section.bounds
  );

  if (kind === "title") {
    return {
      id: `${sectionId}-title`,
      kind: "text",
      bounds: titleBounds,
      text: copy.title
    };
  }

  return {
    id: `${sectionId}-${copy.detailKind === "button" ? "button" : "card"}`,
    kind: copy.detailKind ?? "text",
    bounds: detailBounds,
    text: copy.detail
  };
}

/**
 * Seed the hero region with editable component layers and a reference crop.
 * This is a deterministic scaffold for MVP intake, not computer vision.
 */
export function addHeroAnnotationSetToPlan(plan: HomepageAnalysisPlan): HomepageAnalysisPlan {
  const sectionId = "hero";
  const hero = sectionById(plan, sectionId);
  const gutter = Math.min(96, Math.max(24, Math.round(hero.bounds.width * 0.067)));
  const imageWidth = Math.min(420, Math.max(120, Math.round(hero.bounds.width * 0.28)));
  const imageHeight = Math.min(164, Math.max(56, hero.bounds.height - 64));
  const imageBounds = clampRectToSection(
    {
      x: hero.bounds.x + Math.min(Math.round(hero.bounds.width * 0.62), hero.bounds.width - imageWidth - gutter),
      y: hero.bounds.y + Math.min(48, Math.max(16, hero.bounds.height - imageHeight - 12)),
      width: imageWidth,
      height: imageHeight
    },
    hero.bounds
  );
  const textWidth = Math.min(620, Math.max(140, imageBounds.x - hero.bounds.x - gutter * 2 - 24));
  const titleY = hero.bounds.y + Math.min(52, Math.max(16, Math.round(hero.bounds.height * 0.16)));
  const titleHeight = Math.min(72, Math.max(34, Math.round(hero.bounds.height * 0.3)));
  const copyY = Math.min(titleY + titleHeight + 10, hero.bounds.y + Math.max(16, hero.bounds.height - 72));
  const copyHeight = Math.min(48, Math.max(24, hero.bounds.y + hero.bounds.height - copyY - 32));
  const ctaY = Math.min(copyY + copyHeight + 10, hero.bounds.y + Math.max(16, hero.bounds.height - 56));
  const ctaWidth = Math.min(184, textWidth);
  let next = plan;

  next = addLayerIfMissing(next, sectionId, {
    id: "hero-title",
    kind: "text",
    bounds: clampRectToSection({ x: hero.bounds.x + gutter, y: titleY, width: textWidth, height: titleHeight }, hero.bounds),
    text: "Imported hero headline"
  });
  next = addLayerIfMissing(next, sectionId, {
    id: "hero-copy",
    kind: "text",
    bounds: clampRectToSection({ x: hero.bounds.x + gutter, y: copyY, width: textWidth, height: copyHeight }, hero.bounds),
    text: "Annotated from the PNG analysis plan before code export."
  });
  next = addLayerIfMissing(next, sectionId, {
    id: "hero-cta",
    kind: "button",
    bounds: clampRectToSection({ x: hero.bounds.x + gutter, y: ctaY, width: ctaWidth, height: 44 }, hero.bounds),
    text: "Generate LayerDoc"
  });
  next = addLayerIfMissing(next, sectionId, {
    id: "hero-image",
    kind: "image",
    bounds: imageBounds,
    alt: "Hero visual crop",
    asset: {
      id: "hero-crop",
      uri: "/assets/hero-reference.svg",
      source: "reference-crop",
      cropBounds: { ...imageBounds }
    }
  });

  return next;
}

/**
 * Create the default 18-layer homepage annotation scaffold used by the editor
 * and CLI. Operators can refine these layers before committing LayerDoc.
 */
export function seedHomepageAnalysisPlan(plan: HomepageAnalysisPlan): HomepageAnalysisPlan {
  let next = addHeroAnnotationSetToPlan(plan);

  for (const section of next.sections) {
    if (section.id === "hero") {
      continue;
    }

    next = addLayerIfMissing(next, section.id, seededSectionLayer(next, section.id, "title"));
    next = addLayerIfMissing(next, section.id, seededSectionLayer(next, section.id, "detail"));
  }

  return next;
}
