# SaveIt 技术设计文档

## 1. 项目定位

SaveIt 是一个浏览器扩展，将**多级导航网站**（文档站、知识库、手册）完整保存为离线可浏览的文件。在 SingleFile "单页→单 HTML"的核心能力之上，增加自动发现、展开、遍历侧边导航树并批量捕获所有页面的能力。

## 2. 核心用例

| 场景 | 示例 | 预期行为 |
|------|------|---------|
| 文档站完整保存 | VitePress / Docusaurus / GitBook 站点 | 一键保存整站，保留目录结构 |
| 知识库离线归档 | Confluence space / Notion workspace | 展开全部页面树后逐页保存 |
| 选择性保存 | 只保存某个章节及其子页面 | 用户选中子树，仅保存选中部分 |
| 单页保存 | 任意网页 | 同 SingleFile 行为 |
| 登录后保存 | 需认证的内部文档 | 复用浏览器 session |

## 3. 架构

```
┌──────────────────────────────────────────────────────────────┐
│                         Popup / SidePanel UI                  │
│  ┌─────────────┐ ┌────────────────┐ ┌────────────────────┐  │
│  │ 单页保存     │ │ 批量保存（全部） │ │ 选择性保存（子树） │  │
│  └─────────────┘ └────────────────┘ └────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  进度面板: 已完成 12/45 页  [████████░░░░] 27%        │    │
│  └──────────────────────────────────────────────────────┘    │
└────────────────────────────┬─────────────────────────────────┘
                             │ chrome.runtime.sendMessage
┌────────────────────────────▼─────────────────────────────────┐
│                   Background Service Worker                    │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ TaskScheduler │  │ NetworkProxy │  │  OutputManager    │  │
│  │              │  │              │  │                   │  │
│  │ - URL 队列   │  │ - CORS 代理  │  │ - 合并 HTML       │  │
│  │ - 并发控制   │  │ - 资源缓存   │  │ - 目录结构打包    │  │
│  │ - 重试逻辑   │  │ - 请求去重   │  │ - ZIP 导出        │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
└────────────────────────────┬─────────────────────────────────┘
                             │ chrome.tabs / scripting API
┌────────────────────────────▼─────────────────────────────────┐
│                     Content Script                             │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  NavDiscovery (导航发现)                                │   │
│  │                                                         │   │
│  │  策略链（按优先级尝试）:                                  │   │
│  │  1. SitemapStrategy    — fetch /sitemap.xml             │   │
│  │  2. ConfigStrategy     — 提取框架内嵌配置               │   │
│  │  3. DOMStrategy        — 解析 sidebar DOM 树           │   │
│  │  4. APIInterceptStrategy — 监听 fetch 响应             │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  TreeExpander (树展开)                                  │   │
│  │                                                         │   │
│  │  - BFS 遍历 sidebar 节点                                │   │
│  │  - 点击折叠按钮 → 等待子节点渲染                         │   │
│  │  - 记录展开路径避免死循环                                │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  SPARouter (SPA 路由监控)                               │   │
│  │                                                         │   │
│  │  - 拦截 history.pushState / replaceState               │   │
│  │  - 监听 popstate / hashchange                          │   │
│  │  - 内容就绪检测 (selector + networkidle)               │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  PageCapture (页面捕获引擎)                             │   │
│  │                                                         │   │
│  │  基于 single-file-core:                                 │   │
│  │  - DOM 快照 + 资源内联 + 序列化                         │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  SiteAdapter (站点适配器，可插拔)                       │   │
│  │                                                         │   │
│  │  interface SiteAdapter {                                │   │
│  │    detect(): boolean                                    │   │
│  │    getNavTree(): Promise<NavNode[]>                     │   │
│  │    navigateTo(url: string): Promise<void>              │   │
│  │    getContentSelector(): string                         │   │
│  │    waitForReady(): Promise<void>                        │   │
│  │  }                                                      │   │
│  └───────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

## 4. 核心模块设计

### 4.1 NavDiscovery — 导航发现

发现页面完整导航树，返回 `NavNode[]` 结构。

```typescript
interface NavNode {
  url: string;
  title: string;
  depth: number;
  children: NavNode[];
  isExpandable: boolean; // 是否有折叠子项
}
```

**策略链** (按成本从低到高排列，命中即停):

| # | 策略 | 适用场景 | 实现要点 |
|---|------|---------|---------|
| 1 | Sitemap | SSG 站点 (VitePress/Docusaurus/MkDocs) | `fetch('/sitemap.xml')` 解析 `<url><loc>` |
| 2 | Config | 已知框架站点 | 提取 `window.__VP_SITE_DATA__` / `__docusaurus` / 页面内 JSON |
| 3 | DOM | 通用 | 查询 `nav, aside, [role=navigation]` 中所有 `<a href>` |
| 4 | API Intercept | AJAX 加载型 (Confluence/Notion) | 监听 `fetch` 响应，匹配页面树 JSON |

### 4.2 TreeExpander — 树节点展开

对 DOM 策略的补充：处理折叠的导航节点。

```
算法: BFS

queue = [root sidebar element]
visited = Set<Element>()

while queue not empty:
    node = queue.dequeue()
    if node in visited: continue
    visited.add(node)

    expandButton = findExpandToggle(node)
    if expandButton and not isExpanded(node):
        click(expandButton)
        await waitForChildrenRendered(node)

    childLinks = node.querySelectorAll(':scope > ul > li > a')
    childGroups = node.querySelectorAll(':scope > ul > li')
    queue.enqueue(...childGroups)
```

**展开按钮识别启发式:**
- `button[aria-expanded]`
- `.toggle`, `.expand`, `.collapse` 类名
- `svg` / `icon` 元素紧邻无 href 的 `<span>` / `<div>`
- `[data-toggle]` 属性

**安全措施:**
- 最大展开深度限制 (默认 10 层)
- 单次操作超时 3s
- 已访问节点去重
- 总 URL 数上限 (默认 2000)

### 4.3 SPARouter — SPA 路由监控

```javascript
// 在 page load 前注入 (via chrome.scripting.executeScript, world: 'MAIN')
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
  originalPushState.apply(this, args);
  window.dispatchEvent(new CustomEvent('__saveit_navigate', {
    detail: { url: location.href, type: 'pushState' }
  }));
};

history.replaceState = function(...args) {
  originalReplaceState.apply(this, args);
  window.dispatchEvent(new CustomEvent('__saveit_navigate', {
    detail: { url: location.href, type: 'replaceState' }
  }));
};

window.addEventListener('popstate', () => {
  window.dispatchEvent(new CustomEvent('__saveit_navigate', {
    detail: { url: location.href, type: 'popstate' }
  }));
});
```

**内容就绪检测:**

```javascript
async function waitForContentReady(contentSelector, timeout = 10000) {
  // 1. 等待目标选择器元素出现
  await waitForSelector(contentSelector, timeout);

  // 2. 等待网络静默 (500ms 无新请求)
  await waitForNetworkIdle(500);

  // 3. 等待 DOM 稳定 (200ms 无 mutation)
  await waitForDOMStable(200);
}
```

### 4.4 PageCapture — 页面捕获

直接集成 `single-file-core`，复用其完整的资源内联能力。

```javascript
import { initialize, getPageData } from 'single-file-core';

async function capturePage(options) {
  const pageData = await getPageData({
    removeScripts: true,
    removeHiddenElements: false,
    compressHTML: true,
    includeInfobar: true,
    ...options
  });
  return {
    html: pageData.content,
    title: pageData.title,
    url: pageData.url,
    size: pageData.content.length
  };
}
```

### 4.5 SiteAdapter — 站点适配器

为已知站点提供优化路径，绕过通用启发式的不确定性。

**内置适配器:**

| 适配器 | 检测条件 | 优化 |
|--------|---------|------|
| VitePressAdapter | `window.__VP_SITE_DATA__` 存在 | 直接从配置提取完整 sidebar |
| DocusaurusAdapter | `window.__docusaurus` 存在 | 从 React 内部状态提取路由表 |
| GitBookAdapter | `meta[name="generator"][content*="GitBook"]` | 从 `__NEXT_DATA__` 提取 |
| ConfluenceAdapter | URL 匹配 `/wiki/spaces/` | 调用 REST API 获取页面树 |
| NotionAdapter | URL 匹配 `notion.so` / `notion.site` | 监听 block API 响应 |
| GenericAdapter | 兜底 | DOM 启发式 + BFS 展开 |

**适配器接口:**

```typescript
interface SiteAdapter {
  name: string;
  detect(): boolean;
  getNavTree(): Promise<NavNode[]>;
  navigateTo(url: string): Promise<void>;
  getContentSelector(): string;
  waitForReady(): Promise<void>;
}
```

### 4.6 TaskScheduler — 任务调度

运行在 Background Service Worker，管理多页保存的执行流程。

```typescript
interface CrawlTask {
  id: string;
  urls: string[];          // 待处理 URL 队列
  completed: string[];     // 已完成
  failed: Map<string, { error: string; retries: number }>;
  concurrency: number;     // 并发 tab 数 (默认 2)
  status: 'running' | 'paused' | 'done' | 'error';
}
```

**执行流程:**
1. NavDiscovery 返回 URL 列表
2. 创建 CrawlTask，URL 入队
3. 按并发度打开 tab，注入 content script
4. 每个 tab: navigateTo → waitForReady → capturePage → 报告完成
5. 失败重试 (最多 3 次)
6. 全部完成 → OutputManager 组装输出

### 4.7 OutputManager — 输出管理

```typescript
type OutputMode = 'single-merged' | 'directory' | 'zip';

interface OutputOptions {
  mode: OutputMode;
  filename: string;         // 模板: {site}-{date}
  includeIndex: boolean;    // 是否生成目录 index.html
  maxSingleFileSize: number; // 超过此大小自动切换为 zip
}
```

| 输出模式 | 格式 | 适用场景 |
|----------|------|---------|
| `single-merged` | 单 HTML + 内部锚点目录 | 小型文档 (<50 页) |
| `directory` | 文件夹结构 + index.html | 大型站点 |
| `zip` | ZIP 压缩包 | 便于传输 |

**合并 HTML 结构:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{site-title} - SaveIt Archive</title>
  <meta name="saveit-version" content="1.0">
  <meta name="saveit-date" content="2026-06-08">
  <meta name="saveit-source" content="{root-url}">
  <style>/* 导航样式 + 页面隔离样式 */</style>
</head>
<body>
  <nav id="saveit-toc">
    <!-- 自动生成的目录树 -->
    <ul>
      <li><a href="#page-1">Getting Started</a></li>
      <li><a href="#page-2">Configuration</a>
        <ul>
          <li><a href="#page-3">Basic</a></li>
          <li><a href="#page-4">Advanced</a></li>
        </ul>
      </li>
    </ul>
  </nav>
  <main>
    <article id="page-1" class="saveit-page" data-url="...">
      <!-- page 1 content -->
    </article>
    <article id="page-2" class="saveit-page" data-url="...">
      <!-- page 2 content -->
    </article>
  </main>
</body>
</html>
```

## 5. 多级展开核心流程

```
用户点击 [保存全部页面]
         │
         ▼
┌─ Background: 创建 CrawlTask ─┐
│                                │
│  ┌─────────────────────┐      │
│  │ 1. 导航发现          │      │
│  │    sitemap?          │──yes──→ 解析 sitemap.xml
│  │    │ no              │      │
│  │    ▼                 │      │
│  │    框架配置?          │──yes──→ 提取 JS 全局变量
│  │    │ no              │      │
│  │    ▼                 │      │
│  │    DOM 侧边栏?       │──yes──→ BFS 展开 + 收集 href
│  │    │ no              │      │
│  │    ▼                 │      │
│  │    API 拦截          │──────→ 监听 fetch 响应
│  └─────────────────────┘      │
│           │                    │
│           ▼                    │
│  URL 列表去重 + 排序           │
│  (按导航树顺序)                │
│           │                    │
│           ▼                    │
│  ┌─────────────────────┐      │
│  │ 2. 逐页捕获          │      │
│  │                      │      │
│  │  for url in queue:   │      │
│  │    tab.navigate(url) │      │
│  │    waitForReady()    │      │
│  │    capturePage()     │      │
│  │    reportProgress()  │      │
│  └─────────────────────┘      │
│           │                    │
│           ▼                    │
│  ┌─────────────────────┐      │
│  │ 3. 组装输出          │      │
│  │                      │      │
│  │  mode = single?      │      │
│  │    → merge all pages │      │
│  │  mode = zip?         │      │
│  │    → pack as zip     │      │
│  └─────────────────────┘      │
│           │                    │
│           ▼                    │
│  chrome.downloads.download()  │
└────────────────────────────────┘
```

## 6. 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 扩展框架 | Chrome Extension Manifest V3 | 现代标准，Service Worker 持久化 |
| 语言 | TypeScript | 类型安全，适配器接口约束 |
| 构建 | Vite + CRXJS | HMR 开发体验，自动 manifest 处理 |
| 页面捕获 | single-file-core | MIT，久经考验，直接集成 |
| CSS 解析 | css-tree (single-file 内置) | 完整 CSS 解析能力 |
| ZIP 打包 | fflate | 轻量，纯 JS，browser-native |
| UI 框架 | Solid.js | 轻量 (7KB)，响应式，适合 popup |
| 状态 | chrome.storage.session + local | session 存进度，local 存配置 |
| 测试 | Vitest + Playwright | 单元测试 + E2E 扩展测试 |

## 7. 与 SingleFile 的关系

```
┌─────────────────────────────────────────────────────┐
│                    SaveIt                             │
│                                                      │
│  ┌─ 新增层 ─────────────────────────────────────┐   │
│  │  NavDiscovery | TreeExpander | SPARouter      │   │
│  │  SiteAdapter  | TaskScheduler | OutputManager │   │
│  └──────────────────────────────────────────────┘   │
│                      │ 调用                          │
│  ┌─ 复用层 ─────────▼──────────────────────────┐   │
│  │           single-file-core                    │   │
│  │  (资源内联 · CSS处理 · 帧树 · 序列化)          │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

| 维度 | SingleFile | SaveIt |
|------|-----------|--------|
| 捕获范围 | 当前页 | 当前页 + 整站多页 |
| 导航感知 | 无 | 自动识别 sidebar，支持多级展开 |
| SPA 路由 | 不处理 | 拦截 pushState，等待内容就绪 |
| 输出格式 | 单 HTML | 合并 HTML / 目录 / ZIP |
| 站点适配 | 通用 DOM 序列化 | 通用 + 专用适配器 (VitePress/Docusaurus/...) |
| 进度反馈 | 当前页百分比 | 全局进度 (N/M 页) + 单页进度 |
| 断点续传 | 无 | 支持暂停/恢复 |

## 8. 开发阶段规划

| 阶段 | 内容 | 产出 |
|------|------|------|
| P0 | 单页保存 (集成 single-file-core) | MVP：等价 SingleFile 基础功能 |
| P1 | NavDiscovery + GenericAdapter | 通用站点多页保存 |
| P2 | VitePress / Docusaurus 适配器 | SSG 文档站快速保存 |
| P3 | 合并 HTML + ZIP 输出 | 完整输出能力 |
| P4 | Confluence / Notion 适配器 | 知识库支持 |
| P5 | Side Panel UI + 断点续传 | 生产级体验 |

## 9. 关键风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| MV3 Service Worker 休眠 | 长时间批量保存中断 | 使用 `chrome.alarms` + offscreen document 保活 |
| 大站点内存溢出 | 数千页同时在内存 | 流式处理：每页保存后释放 |
| 反爬检测 | 快速导航触发限流 | 每页间隔随机 1-3s，尊重 robots.txt |
| SPA 路由不可预测 | hash/pushState/自定义方案 | 多策略检测 + 用户可配置选择器 |
| CSS 作用域污染 | 合并 HTML 中样式冲突 | 每个 page article 加 scoped class 前缀 |

## 10. 配置项设计

```json
{
  "output": {
    "mode": "single-merged | directory | zip",
    "filename": "{title}-{date}",
    "maxPages": 2000,
    "maxSingleFileSize": "50MB"
  },
  "capture": {
    "removeScripts": true,
    "removeHiddenElements": false,
    "compressHTML": true,
    "includeMetadata": true,
    "lazyLoadTimeout": 5000
  },
  "navigation": {
    "maxDepth": 10,
    "expandTimeout": 3000,
    "concurrency": 2,
    "pageDelay": 1500,
    "respectRobots": true
  },
  "adapters": {
    "enabled": ["vitepress", "docusaurus", "gitbook", "confluence", "generic"],
    "custom": []
  }
}
```
