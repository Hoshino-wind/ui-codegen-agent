# AI UI Production System

[English](./README.md) · [简体中文](./README.zh-CN.md)

> 一个以 LayerDoc 为核心的 AI UI 工程工作台：把经过确认的视觉分解结果转成可编辑 UI、受控修改、HTML/React 导出，以及可由机器复核的交付证据。

## 15 秒了解项目

AI UI 图片容易生成，却很难直接交付：像素里没有真实文本、组件、交互、响应式规则和集成合同。本项目在源图与代码之间加入一个强类型中间表示——**LayerDoc**。

当前已实现的流程是：

```text
源 PNG
  -> 经确认的 HomepageAnalysisPlan
  -> LayerDoc
  -> 受控编辑 / 经审核的 Section Candidate
  -> 确定性 HTML 预览 + React/Tailwind 导出
  -> 视觉、结构、组件、项目适配度验证
  -> 包含 Schema、Manifest、审计与 CI 命令的项目包
```

这不是“任意截图一键生成生产代码”。仓库目前**没有实现真实、通用的 VLM 自动分解 Worker**；现阶段接收人工或外部视觉 Worker 产出的 Analysis Plan，并提供确定性的 Mock 分解用于回归测试。

## 要解决的问题

页面看起来相似，不代表它是合格的工程资产。一张整页位图可能有很高的截图相似度，却没有可编辑文案、可复用组件、响应式行为或可信的项目集成方式。

因此，本项目把两个问题分开验证：

1. **结果是否接近参考图？**
2. **结果是否结构化、可编辑、可导出并可安全集成？**

## 核心机制

### 1. LayerDoc 是单一真值源

LayerDoc 用一个强类型图统一记录画布、设计 Token、Section、Layer、Asset、Component、Interaction、响应式规则、修改历史和验证状态。源图只作为来源追踪和视觉证据，不直接充当可编辑实现。

每个 Layer 都被归入四条生产轨道之一：

| 轨道 | 示例 | 处理方式 |
| --- | --- | --- |
| `component` | 文本、按钮、卡片、表单、列表 | 可编辑 DOM / 组件输出 |
| `asset` | 插画、背景、产品图片 | 带来源信息的媒体资产 |
| `approximation` | 图表、地图、3D 场景 | 明确标注为近似实现，不伪装成组件 |
| `layout` | Section、分组、层级 | 结构和响应式规则 |

这一区分能避免把“像素相似的捷径”误报成真实组件实现。

### 2. 编辑受控且可审计

编辑操作是纯 LayerDoc 变换。当前实现包括文案、样式、图片资产、边界、按钮行为、Section 顺序与显隐，以及 Studio 内的撤销/重做。

导出包可包含 `edit-audit.json`，记录已应用和已撤销操作、受影响的 Layer/Section 及汇总；项目本地验证会重新计算并核对该汇总。

### 3. Section 重生成候选必须先审核再应用

AI Worker 可以返回符合 `section-candidate.schema.json` 的 Section Candidate。系统先依据当前 Section 图验证候选，再决定是否应用。

候选被接受后会：

- 保持稳定的 Section ID；
- 一次性替换其 Layer、Asset、Component、Interaction 和响应式规则；
- 刷新预览、React 导出、合同、Manifest 与验证状态；
- 在 `generation.sectionApplications` 中保存前后图快照；
- 支持恢复到记录的上一版图。

候选内容的生成本身是集成边界。仓库实现了合同、验证、应用与回滚，不包含托管式生成模型。

### 4. 一个图同时驱动预览与导出

同一份 LayerDoc 可以生成：

- 带 Section/Component/Layer 标记的确定性 HTML 预览；
- React + Tailwind TSX 组件；
- 响应式 Media Query CSS；
- `integration-contract.json` 及其 JSON Schema；
- Asset Index、Production Manifest、Handoff Summary、CI Workflow 和 Backtest Runbook；
- 项目本地验证与 Candidate 应用脚本。

可追踪属性把渲染后的 DOM 节点关联回 LayerDoc ID，并直接暴露当前验证状态，无需从 README 中解析信息。

### 5. 验证维度相互独立

Verifier 分开输出四个分数：

```text
visual_similarity   PNG 对 PNG 的视觉相似度
structure_score     图完整性与可编辑结构
component_score     组件覆盖率与可导出性
project_fit_score   项目集成准备度与位图捷径风险
```

质量门禁还会检查来源信息、Section 覆盖、图引用、响应式目标、资产映射、DOM Selector、导出合同，以及整页/整区块位图风险。结构阻断项与不阻断交付的轨道提示会分开记录。

## 架构

```text
src/importers/   PNG Intake、Analysis Plan/Task 合同、Manifest 转换
       |
       v
src/layerdoc/    Schema、分类、校验、评分、审计
       |
       +---------------------+
       |                     |
       v                     v
src/editor/      受控变换与 Section Candidate
       |                     |
       +----------+----------+
                  v
src/exporters/   HTML、React/Tailwind、Schema、项目包
                  |
                  v
src/verifier/    截图 Diff、图/报告评分、质量门禁
                  |
                  v
src/app/         用于导入、审核、编辑、预览、验证和导出的 React Studio
```

## Quick Start

### 运行 Studio 与测试

需要带 npm 的当前 Node.js 版本；依赖已锁定在 `package-lock.json`。

```bash
npm install
npm test
npm run typecheck
npm run dev
```

Studio 地址以 `npm run dev` 输出的本地 Vite 地址为准。

### 运行确定性的端到端回测

此流程只在本地生成稳定的 Mock PNG，不调用远程图片或视觉模型：

```bash
npm run build:lib
npm run backtest:homepage -- \
  --out artifacts/homepage-backtest \
  --component ProductionHomepage
```

输出包含源图/候选图、LayerDoc、预览、React 导出、项目包、验证证据和 `backtest-report.json`。

### 处理真实首页 PNG

先创建视觉分解任务：

```bash
npm run build:lib
npm run create:analysis-task -- \
  --input references/homepage.png \
  --out artifacts/analysis-task \
  --name "Product homepage"
```

需要由人工或外部视觉 Worker 根据任务产出 `analysis-plan.json`。构建 LayerDoc 前先审计：

```bash
npm run verify:analysis-plan -- \
  --input analysis-plan.json \
  --source references/homepage.png \
  --out artifacts/analysis-plan-check
```

随后运行完整生产链：

```bash
npm run pipeline:homepage -- \
  --input references/homepage.png \
  --analysis-plan analysis-plan.json \
  --out artifacts/homepage-run \
  --component ProductionHomepage \
  --verify-project
```

如果已有稳定的候选截图，可传入 `--candidate <rendered.png>`。未传入时，导出项目的 Preview Verifier 可以用 Playwright 截取 `preview.html`。

## 验证证据

仓库当前包含 **38 个 Node 测试文件、303 项自动化测试**，覆盖 LayerDoc 校验、受控编辑、Candidate 应用/回滚、PNG Intake、Analysis Plan 合同、HTML 与 React/Tailwind 导出、项目包物化、项目本地脚本、截图 Diff、质量门禁、CLI 行为和确定性首页回测。

可在本地运行：

```bash
npm test
npm run typecheck
npm run build
```

测试使用 Node 内置 Test Runner，并保持确定性。浏览器截图属于独立运行路径；PNG 比较本身是确定性的。

## 当前边界

已经实现：

- LayerDoc Schema、校验、分类、评分与审计；
- 用于受控导入、编辑、预览、验证和导出的 React Studio；
- Section Candidate Schema、验证、应用、历史记录与回滚；
- HTML 预览和 React/Tailwind TSX 导出；
- 包含 Schema、Manifest、合同、审计数据与本地验证命令的项目包；
- 确定性首页回测与 PNG 视觉 Diff。

尚未实现或有意限制：

- 没有能自动分解任意截图的通用 VLM；
- 当前生产目标限定为 **8–15 个 Section** 的营销首页；
- React 导出会保留已验证的 LayerDoc 几何信息，包括绝对定位；它不会自动把页面语义化重构成理想的响应式组件系统；
- 不提供自由矢量编辑、多人协作或插件生态；
- Candidate 生成和生产环境截图渲染属于外部集成点；
- 验证可以暴露工程风险，但不能证明主观设计质量或业务效果。

## 仓库结构

```text
src/app/        React Studio 与浏览器交付工具
src/layerdoc/   LayerDoc 类型、Schema、校验、评分、审计
src/importers/  Analysis Plan、Image Manifest 与 PNG Intake
src/editor/     受控编辑与 Section Candidate 合同
src/exporters/  预览、React/Tailwind、Schema、项目包
src/verifier/   视觉 Diff、报告、项目检查、质量门禁
src/cli/        Intake、Pipeline、Backtest、导出与物化
test/           自动化行为测试和端到端合同测试
docs/concepts/  Editor 概念图与实现截图
```

## Roadmap

- 增加可插拔的 VLM 分解适配器、公开 Benchmark Fixture 和带置信度的审核流程。
- 在保留明确结构合同的前提下，扩展到首页之外的页面类型。
- 在验证之后增加语义化布局合成，降低最终 React 输出对绝对几何的依赖。
- 加强无障碍、交互和响应式行为门禁。
- 使用公开、可复现的截图 Fixture 评估视觉分解质量。

## 开发

```bash
npm run build:lib
npm run build:app
npm run typecheck
npm test
```

新增行为应通过其改变的公共合同进行测试。生成项目包应可被独立检查和验证，而不是因为“由同一套流程生成”就被默认信任。
