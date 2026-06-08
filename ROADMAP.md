# SaveIt 开发路线图

## 进度总览

| 阶段 | 状态 | 描述 |
|------|------|------|
| 阶段一 | ✅ 完成 | 项目初始化 + 单页保存（Firefox） |
| 阶段二 | ✅ 完成 | 导航发现 + 树形预览 |
| 阶段三 | ✅ 完成 | 多页顺序爬取引擎 |
| 阶段四 | ✅ 完成 | 合并 HTML 输出 |
| 阶段五 | ✅ 完成 | 更多适配器 + 鲁棒性 |
| 阶段六 | ✅ 完成 | Chromium（Chrome/Edge）移植 |

---

## 阶段一：项目初始化 + 单页保存 ✅

- [x] 初始化项目：Vite + TypeScript + Solid.js + web-ext
- [x] 编写 Firefox MV2 manifest.json
- [x] 实现页面捕获引擎（CSS/图片/字体/favicon 内联）
- [x] 后台页面：消息路由 + 资源获取 + 下载
- [x] Content script：DOM 快照序列化
- [x] Popup UI："保存页面"按钮 + 状态反馈
- [x] 构建系统配置正确，web-ext lint 通过

## 阶段二：导航发现 + 树形预览 ✅

- [x] MAIN world 注入脚本（pushState 钩子 + 网络计数 + 全局变量提取）
- [x] SitemapStrategy：/sitemap.xml 解析
- [x] ConfigStrategy：JS 全局变量（__VP_SITE_DATA__ 等）
- [x] DOMStrategy：nav/aside DOM 查询
- [x] TreeExpander：BFS 侧边栏展开
- [x] VitePress 适配器
- [x] Docusaurus 适配器
- [x] Generic 通用适配器
- [x] NavTreePreview 组件（复选框树）
- [x] Popup 集成：发现按钮 → 树形预览

## 阶段三：多页顺序爬取引擎 ✅

- [x] TaskScheduler：状态机 + 队列 + 持久化
- [x] TabManager：后台标签页导航与等待
- [x] ReadinessDetector：内容选择器 + DOM 稳定检测
- [x] 顺序爬取循环：重试 + 指数退避
- [x] 进度上报 + ProgressPanel
- [x] 暂停/恢复/取消
- [x] 随机延迟（1-3s）防反爬

## 阶段四：合并 HTML 输出 ✅

- [x] OutputAssembler：CSS @scope 隔离
- [x] data:URI 去重 → CSS 变量
- [x] 内置侧边栏目录 + 导航 JS
- [x] 深色/浅色模式 + 响应式布局

## 阶段五：更多适配器 + 鲁棒性 ✅

- [x] GitBook 适配器
- [x] MkDocs 适配器
- [x] Confluence 适配器
- [x] robots.txt 解析与过滤
- [x] HTTP 429 指数退避
- [x] Options 选项页面（捕获/爬取/输出设置）

## 阶段六：Chromium（Chrome/Edge）移植 ✅

- [x] MV3 manifest.json：service_worker + offscreen + alarms 权限
- [x] Offscreen Document：页面捕获 + 输出组装（提供 DOM 环境）
- [x] 双目标构建：`npm run build`（Firefox）/ `npm run build:chrome`（Chrome）
- [x] 浏览器 API 兼容层（`browser.*` / `chrome.*` 统一为 `api.*`）
- [x] Chrome 类型支持（@types/chrome）
- [x] dist-chrome/ 输出目录独立于 dist/

---

## 未来规划（v0.2+）

- [ ] 替换自实现捕获引擎为完整 single-file-core（iframe、Shadow DOM、canvas）
- [ ] ZIP 输出模式（fflate）
- [ ] Chrome alarms 保活 + 自动恢复中断的爬取
- [ ] 文件名模板（`{site}-{date}-{title}`）
- [ ] 内存优化：IndexedDB 流式存储
- [ ] 批量导出为 PDF
- [ ] 定时自动保存（监控页面更新）
- [ ] 导入/导出保存历史
- [ ] Firefox Android 支持
- [ ] Safari 支持

---

## 构建命令

| 命令 | 说明 |
|------|------|
| `npm run build` | 构建 Firefox 版本 → `dist/` |
| `npm run build:chrome` | 构建 Chrome/Edge 版本 → `dist-chrome/` |
| `npm run build:all` | 同时构建两个版本 |
| `npm run start:firefox` | 启动 Firefox 临时加载扩展 |
| `npm run dev` | 监听模式构建（Firefox） |

## 验证方式

| 浏览器 | 步骤 |
|--------|------|
| Firefox | `about:debugging` → 临时加载 → 选择 `dist/manifest.json` |
| Chrome | `chrome://extensions` → 开发者模式 → 加载已解压 → 选择 `dist-chrome/` |

## 技术栈

| 组件 | 技术 |
|------|------|
| 语言 | TypeScript 5.x |
| 构建 | Vite 6 + web-ext + cross-env |
| UI | Solid.js 1.x |
| 页面捕获 | 自实现（计划升级为 single-file-core） |
| 测试 | Vitest + Playwright（计划中） |
| Firefox | MV2, 持久后台页面, 最低 115 |
| Chrome | MV3, Service Worker + Offscreen Document, 最低 118 |
