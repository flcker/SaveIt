# SaveIt

将网页保存为单个自包含 HTML 文件的浏览器扩展，支持多级导航站点整站保存。

## 功能

- **单页保存**：将当前页面（含 CSS、图片、字体）保存为一个 HTML 文件
- **整站保存**：自动发现侧边栏导航，批量爬取所有页面合并为可导航的单文件
- **多平台适配**：VitePress、Docusaurus、GitBook（新旧版本）、MkDocs、Confluence
- **CSS 隔离**：合并输出使用 `@scope` 防止页面间样式污染
- **内置导航**：合并文件包含侧边栏目录，支持深色/浅色模式

## 环境要求

- Node.js >= 18
- npm >= 9
- Firefox >= 115 或 Chrome >= 118

## 安装依赖

```bash
npm install
```

## 构建

```bash
# Firefox 版本（输出到 dist/）
npm run build

# Chrome/Edge 版本（输出到 dist-chrome/）
npm run build:chrome

# 同时构建两个版本
npm run build:all
```

## 开发模式

```bash
# 监听文件变化自动重新构建（Firefox）
npm run dev
```

## 生成图标

```bash
npm run icons
```

## 在浏览器中加载

### Firefox

1. 地址栏输入 `about:debugging#/runtime/this-firefox`
2. 点击 **"临时载入附加组件..."**
3. 选择 `dist/manifest.json`

### Chrome / Edge

1. 地址栏输入 `chrome://extensions`
2. 开启右上角 **"开发者模式"**
3. 点击 **"加载已解压的扩展程序"**
4. 选择 `dist-chrome/` 文件夹

## 使用方式

1. 点击工具栏 SaveIt 图标
2. **保存页面**：点击"保存当前页面"按钮，下载单页 HTML
3. **保存站点**：
   - 切换到"保存站点"标签
   - 点击"发现页面结构"
   - 在树形列表中勾选/取消需要的页面
   - 点击"保存选中页面"
4. 点击标题栏 ⧉ 按钮可将弹窗转为独立窗口（防止失焦关闭）

## 项目结构

```
src/
├── background/          # 后台页面（Firefox）/ Service Worker（Chrome）
│   ├── index.ts         # 消息路由、爬取循环
│   ├── page-capture.ts  # 资源内联引擎
│   ├── output-assembler.ts  # 多页合并 + CSS 隔离
│   ├── task-scheduler.ts    # 爬取状态机
│   ├── tab-manager.ts       # 后台标签页管理
│   └── robots-txt.ts        # robots.txt 解析
├── content/             # Content Script
│   ├── index.ts         # DOM 快照 + 消息处理
│   ├── nav-discovery.ts # 导航发现策略链
│   ├── tree-expander.ts # BFS 侧边栏展开
│   ├── strategies/      # 发现策略（sitemap/config/dom）
│   └── adapters/        # 站点适配器
├── injected/            # MAIN world 注入脚本
│   └── spa-hooks.ts     # pushState/fetch 拦截
├── offscreen/           # Chrome Offscreen Document
├── options/             # 选项页面
├── popup/               # 弹窗 UI（Solid.js）
└── shared/              # 共享类型和工具
```

## 调试

发现导航失败时，展开 popup 底部的"调试信息"面板查看每个适配器的检测结果。

在浏览器控制台手动检查导航结构：

```js
// 检查页面有哪些导航元素
document.querySelectorAll('nav, aside, [role="navigation"], .book-summary')

// 检查侧边栏中的链接
document.querySelectorAll('nav a[href], aside a[href], .book-summary a[href]')

// 检查框架特有全局变量
window.__VP_SITE_DATA__   // VitePress
window.__NEXT_DATA__      // GitBook (new) / Next.js
window.__docusaurus       // Docusaurus
```

## 所有命令

| 命令 | 说明 |
|------|------|
| `npm run build` | 构建 Firefox 版本 → `dist/` |
| `npm run build:chrome` | 构建 Chrome/Edge 版本 → `dist-chrome/` |
| `npm run build:all` | 同时构建两个版本 |
| `npm run dev` | 监听模式构建（Firefox） |
| `npm run start:firefox` | 启动 web-ext 临时加载（需本地 Firefox） |
| `npm run icons` | 生成占位图标 |
| `npm run test` | 运行测试 |
| `npm run lint` | TypeScript 类型检查 |

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
