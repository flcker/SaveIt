# Changelog

## [0.1.1] - 2026-06-10

### Fixed

- **弹窗失焦消失**：标题栏添加 ⧉ 按钮可弹出独立窗口，URL 参数绑定目标 tab
- **独立窗口无法发现站点**：改为 `windows.getAll({ windowTypes: ['normal'] })` 查找目标 tab
- **独立窗口显示目标 tab 名称**：标题栏下方显示 `目标：{页面标题}`
- **侧栏面板替代弹窗**：Firefox `sidebar_action` + Chrome `side_panel`，与 tab 天然关联不丢焦
- **工具栏图标打开侧栏**：移除 blank popup，点击直接 `sidebarAction.toggle()`
- **合并输出背景色不一致**：SaveIt UI CSS 不再覆盖 body 的 background/font-family，页面样式由 @scope 控制
- **合并输出内部链接不可点击**：已捕获页面之间的链接自动改写为 `#page-{slug}`，content 内链接也可导航
- **CSP 拦截 MAIN world 脚本**：外部脚本加载失败时回退到 inline 注入
- **Generic 适配器发现少**：TreeExpander 优先展开再收集；新增 Ant Design / Element UI toggle 选择器
- **未来云 SPA 内容为空**：`waitForReady` 检测 loading mask 消失 + body 内容 >50 字符才视为就绪

### Added

- **TAL Cloud 适配器**：识别 Semi Design 文档平台（`aside.semi-layout-sider` + `[class*="tocs_wrap"]`）
- **页面结构探测脚本**：When all adapters fail, inject JS into page for heuristic nav analysis
- **robots.txt 解析**：自动遵守 Crawl-delay 和 Disallow 规则
- **HTTP 429 指数退避**：最大 30s
- **Options 选项页面**：捕获设置、爬取参数、输出格式
- **Chromium MV3 双目标构建**：`npm run build:chrome` → `dist-chrome/`
- **调试信息面板**：popup 底部显示每个适配器的检测结果

### Changed

- **README 精简**，构建指南独立到 `docs/build.md`
- **npm scripts 增加** `build:chrome`、`build:all`、`dev`、`lint`、`icons`
- **sidebar 替代 popup 作为主要交互方式**

---

## [0.1.0] - 2026-06-08

### Added

- **项目初始化**：Vite + TypeScript + Solid.js + web-ext 构建链
- **单页保存**：捕获当前页面为自包含 HTML 文件（CSS/图片/字体/favicon 内联为 data:URI）
- **导航发现**：策略链自动检测页面侧边栏结构
  - VitePress 适配器（`__VP_SITE_DATA__` 全局变量解析）
  - Docusaurus 适配器（DOM 侧边栏解析）
  - GitBook 适配器（`__NEXT_DATA__` 解析 + DOM 回退）
  - MkDocs 适配器（静态 nav 解析）
  - Confluence 适配器（REST API + DOM 回退）
  - Generic 通用适配器（DOM 选择器 + TreeExpander）
- **Sitemap 策略**：自动发现 `/sitemap.xml` 提取页面列表
- **侧边栏展开**：BFS 点击 `aria-expanded`/`summary`/toggle 按钮，展开折叠节点
- **SPA 钩子**：MAIN world 注入脚本，拦截 pushState/replaceState/fetch/XHR
- **多页爬取引擎**：TaskScheduler 状态机 + TabManager 顺序爬取
  - 自动重试（3 次）+ 指数退避
  - 随机延迟（1-3s）防反爬
  - 持久化到 `browser.storage.local`，支持恢复
  - 暂停/恢复/取消
- **合并 HTML 输出**：多页合并为单文件
  - `@scope` CSS 隔离防止页面间样式泄漏
  - `data:URI` 去重（相同资源用 CSS 变量引用）
  - 内置侧边栏目录 + 导航 JS
  - 深色/浅色模式支持
  - 响应式布局（移动端侧边栏可收起）
- **Popup UI**：双模式（保存页面/保存站点）、树形预览、进度面板
- **Firefox MV2 支持**：持久后台页面架构

### Phase 5 Completion

- robots.txt 解析器：自动检测并过滤被禁止的 URL
- HTTP 429 指数退避（最大 30s）
- Crawl-delay 指令遵守
- Options 选项页面（捕获设置、爬取参数、输出格式）

### Phase 6: Chrome/Edge (MV3) Support

- Chrome Manifest V3 with Service Worker + Offscreen Document
- Offscreen Document 提供 DOMParser（SW 没有 DOM）
- 双目标构建系统：`npm run build` / `npm run build:chrome`
- 浏览器 API 兼容层（browser.* / chrome.* → 统一 api.*）
- @types/chrome 类型支持

### Technical

- Firefox 构建：content.js 27.7KB / background.js 21.4KB / popup.js 34.3KB
- Chrome 构建：额外 offscreen.js 1.2KB
- web-ext lint 0 errors（Firefox）
- 最低版本：Firefox 115 / Chrome 118
