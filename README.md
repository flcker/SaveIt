# SaveIt

将网页保存为单个自包含 HTML 文件的浏览器扩展，支持多级导航站点整站保存。

## 功能

- **单页保存**：将当前页面（含 CSS、图片、字体）保存为一个 HTML 文件
- **整站保存**：自动发现侧边栏导航，批量爬取所有页面合并为可导航的单文件
- **Sidebar 面板**：浏览器侧边栏，随 tab 切换，不丢焦点（Firefox sidebar_action / Chrome side_panel）
- **多平台适配**：VitePress、Docusaurus、GitBook、MkDocs、Confluence、TAL Cloud（未来云）
- **智能发现**：专用适配器 → 通用策略 → sitemap → 页面注入探测，多层回退
- **CSS 隔离**：合并输出使用 `@scope` 防止页面间样式污染，保留原页面样式
- **内部链接改写**：已捕获页面之间的链接自动转为页内锚点导航
- **深色模式**：合并输出跟随系统深色/浅色主题

## 快速开始

```bash
npm install
npm run build
```

Firefox `about:debugging#/runtime/this-firefox` → 加载临时附加组件 → 选择 `dist/manifest.json`

详见 [构建指南](docs/build.md)。

## 使用方式

1. 点击工具栏 SaveIt 图标打开侧栏
2. **保存页面**：点击"保存当前页面"，下载单页 HTML
3. **保存站点**：切换到"保存站点" → "发现页面结构" → 勾选页面 → "保存选中页面"

## 支持的浏览器

| 浏览器 | 版本 | 方式 |
|--------|------|------|
| Firefox | ≥115 | 侧栏 |
| Chrome / Edge | ≥118 | 侧边面板 |
| 其他 Chromium | ≥118 | 侧边面板 |

## 文档

- [构建指南](docs/build.md) — 环境配置、构建命令、浏览器加载、开发流程、故障排除
- [技术设计](docs/saveit-technical-design.md) — 架构设计、模块职责、核心算法
- [SingleFile 分析](docs/singlefile-analysis.md) — 参考项目技术分析
- [路线图](ROADMAP.md) — 开发阶段与完成进度
- [更新日志](CHANGELOG.md)

## 调试

发现导航失败时，展开侧栏底部的"调试信息"面板查看每个适配器的检测结果。

在浏览器控制台手动检查页面导航结构：

```js
document.querySelectorAll('aside a, nav a, [role="navigation"] a').length
document.querySelectorAll('[aria-expanded="false"]').length
```

## 常见问题

**Q: 保存的合并文件只有导航没有内容？**
A: SPA 页面需要等 JS 渲染完成。已针对未来云做了 loading mask 等待处理。其他平台如遇类似问题，请在 Issue 中提交页面 URL。

**Q: 内部文档站点发现不到页面？**
A: 可能导航不在标准 DOM 中。请在页面运行 `probe` 探测脚本（见调试信息面板），或提 Issue 附侧栏 HTML 结构。

## 技术栈

| 组件 | 选择 |
|------|------|
| 语言 | TypeScript 5 |
| 构建 | Vite 6 + cross-env |
| UI | Solid.js |
| Firefox | MV2, 持久后台页面 |
| Chrome | MV3, Service Worker + Offscreen Document |

## 协议

AGPL-3.0
