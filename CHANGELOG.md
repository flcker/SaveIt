# Changelog

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

### Technical

- 构建产物：content.js 27.6KB / background.js 18.3KB / popup.js 35.5KB
- web-ext lint 0 errors
- 最低 Firefox 版本：115
