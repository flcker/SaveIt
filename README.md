# SaveIt

将网页保存为单个自包含 HTML 文件的浏览器扩展，支持多级导航站点整站保存。

## 功能

- **单页保存**：将当前页面（含 CSS、图片、字体）保存为一个 HTML 文件
- **整站保存**：自动发现侧边栏导航，批量爬取所有页面合并为可导航的单文件
- **多平台适配**：VitePress、Docusaurus、GitBook（新旧版本）、MkDocs、Confluence
- **CSS 隔离**：合并输出使用 `@scope` 防止页面间样式污染
- **内置导航**：合并文件包含侧边栏目录，支持深色/浅色模式

## 快速开始

```bash
npm install
npm run build
```

然后在 Firefox 中加载 `dist/manifest.json`，详见 [构建指南](docs/build.md)。

## 使用方式

1. 点击工具栏 SaveIt 图标
2. **保存页面**：点击"保存当前页面"，下载单页 HTML
3. **保存站点**：切换到"保存站点" → "发现页面结构" → 勾选页面 → "保存选中页面"
4. 点击标题栏 ⧉ 按钮可将弹窗转为独立窗口（防止失焦关闭）

## 文档

- [构建指南](docs/build.md) — 环境配置、构建命令、浏览器加载、开发流程、故障排除
- [技术设计](docs/saveit-technical-design.md) — 架构设计、模块职责、核心算法
- [SingleFile 分析](docs/singlefile-analysis.md) — 参考项目的技术分析
- [路线图](ROADMAP.md) — 开发阶段与完成进度
- [更新日志](CHANGELOG.md)

## 项目结构

```
src/
├── background/          # 后台页面 / Service Worker
├── content/             # Content Script + 适配器 + 策略
├── injected/            # MAIN world 注入脚本
├── offscreen/           # Chrome Offscreen Document
├── options/             # 选项页面
├── popup/               # 弹窗 UI（Solid.js）
└── shared/              # 共享类型和工具
```

## 调试

发现导航失败时，展开 popup 底部的"调试信息"面板查看适配器检测结果。

## 协议

AGPL-3.0
