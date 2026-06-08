# SingleFile 技术分析

> 源码: https://github.com/nickthedude/nickthedude-SingleFile (MIT License)
> 官网: https://www.getsinglefile.com/

## 1. 产品定位

SingleFile 是一个跨浏览器扩展（Chrome / Firefox / Edge / Safari / Opera），将当前网页完整保存为**单个自包含 HTML 文件**，所有外部资源内联编码，离线可完整浏览。

## 2. 核心功能

| 功能 | 说明 |
|------|------|
| 完整页面快照 | 保存当前渲染状态的完整 DOM |
| 资源内联 | CSS、图片、字体、SVG、favicon 全部 base64 编码内联 |
| iframe 递归处理 | 递归序列化嵌套 iframe 内容 |
| Shadow DOM | 支持 open shadow root 序列化 |
| Canvas/Video 帧 | Canvas 导出为 data URL，视频取当前帧海报图 |
| 表单状态保留 | 保存输入框/选择框的当前值 |
| 滚动位置保留 | 记录滚动偏移量并写入 HTML |
| 自动去除脚本 | 默认移除 `<script>` 保证安全性 |
| 批注功能 | 保存前可高亮、标注内容 |

## 3. 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    Browser Extension                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Popup UI  │  │  Background  │  │ Content Script │  │
│  │            │  │  (Service    │  │                │  │
│  │ - 触发保存  │  │   Worker)   │  │ - DOM 捕获     │  │
│  │ - 配置选项  │  │              │  │ - 资源收集     │  │
│  │ - 进度展示  │  │ - 消息路由   │  │ - 序列化       │  │
│  └────────────┘  │ - 网络代理   │  └────────────────┘  │
│                  │ - 文件保存   │                       │
│                  └──────────────┘                       │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │           single-file-core (核心引擎)              │   │
│  │                                                    │   │
│  │  Processor → FrameTree → ResourceLoader →         │   │
│  │  Serializer → OutputGenerator                     │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 4. 核心模块详解

### 4.1 Content Script 层

Content Script 注入到目标页面，执行以下任务：

1. **页面冻结** — 克隆当前 `document`，防止后续 DOM 变动影响捕获
2. **Lazy-load 触发** — 滚动页面强制加载所有 lazy 图片
3. **帧树构建** — 枚举所有 iframe，建立帧层次结构
4. **Shadow DOM 展开** — 遍历所有 shadow root 并序列化到占位标签

### 4.2 single-file-core 引擎

这是与浏览器无关的纯 JS 核心，可独立于扩展运行（CLI / WebExtension / Deno）。

#### 处理流水线

```
1. Initialize
   └─ 注入 helper frames、采集页面元信息

2. loadPage
   └─ 等待 DOMContentLoaded + 自定义就绪信号

3. getPageData
   ├─ resolveFrames()     — 递归处理 iframe
   ├─ resolveStylesheets() — 解析所有 CSS，处理 @import 链
   ├─ resolveImages()      — 收集 <img>、srcset、CSS background
   ├─ resolveFonts()       — 收集 @font-face 资源
   ├─ resolveSVGs()        — 内联外部 SVG 引用
   └─ serialize()          — 组装最终 HTML

4. Output
   └─ 返回 { content: string, title, url, stats }
```

#### 资源获取策略

| 资源类型 | 获取方式 | 内联格式 |
|----------|---------|---------|
| CSS 文件 | `fetch()` / background 代理 | `<style>` 内联 |
| 图片 | `fetch()` → ArrayBuffer → base64 | `data:image/...;base64,...` |
| 字体 | `fetch()` → ArrayBuffer → base64 | `data:font/...;base64,...` |
| SVG | `fetch()` → text | 内联 `<svg>` 或 data URI |
| Canvas | `canvas.toDataURL()` | `<img src="data:...">` 替换 |
| iframe | 递归调用 getPageData | `srcdoc="..."` 属性 |

#### CORS 处理

Content Script 的 `fetch()` 受同源策略限制。解决方案：
- 通过 `chrome.runtime.sendMessage()` 请求 Background Script 代理获取
- Background Script 使用 `fetch()` (不受 CORS 限制) 获取资源
- 返回 ArrayBuffer 或 base64 字符串给 Content Script

### 4.3 Background Service Worker

- **消息路由** — content script ↔ popup 通信
- **网络代理** — 代替 content script 获取跨域资源
- **自动保存调度** — 定时 / 页面卸载时触发
- **文件保存** — `chrome.downloads.download()` 或 Filesystem API

### 4.4 Popup UI

- 保存按钮 + 进度条
- 配置面板（移除脚本 / 隐藏元素 / 压缩 HTML / 自定义文件名模板）
- 批量保存选定标签页

## 5. 关键技术实现

### 5.1 CSS 完整处理

```javascript
// 伪代码展示 CSS 处理链
async function resolveStylesheet(cssText, baseURL) {
  // 1. 解析 @import 递归加载
  cssText = await resolveImports(cssText, baseURL);
  // 2. 替换 url() 中的外部资源为 data URI
  cssText = await resolveURLs(cssText, baseURL);
  // 3. 替换 @font-face src 为内联
  cssText = await resolveFontFaces(cssText, baseURL);
  return cssText;
}
```

### 5.2 Lazy-load 处理

许多现代网站使用 `loading="lazy"` 或 IntersectionObserver。SingleFile 的处理：

1. 将所有 `<img loading="lazy">` 改为 `loading="eager"`
2. 通过 `window.scrollTo()` 滚动到页面底部
3. 等待所有图片 `complete` 属性为 true
4. 移除 `data-src` 等延迟加载属性

### 5.3 输出优化

- **压缩 HTML** — 移除多余空白、注释
- **移除隐藏元素** — 可选移除 `display:none` 元素
- **内联样式去重** — 相同的 data URI 只出现一次
- **信息头注入** — 在 HTML 头部注入保存时间、原始 URL 等元数据

## 6. 运行模式

| 模式 | 平台 | 说明 |
|------|------|------|
| WebExtension | Chrome/Firefox/Edge | 主要使用方式 |
| CLI | Node.js + Puppeteer | `single-file-cli` 包 |
| Deno | Deno runtime | 无需 Node.js |
| BookMarklet | 任何浏览器 | 简化版，不支持跨域资源 |
| Web | 网页端 | 输入 URL，服务端渲染保存 |

## 7. 文件结构 (核心目录)

```
nickthedude-SingleFile/
├── src/
│   ├── core/              # single-file-core 引擎
│   │   ├── single-file.js       # 主入口
│   │   ├── modules/
│   │   │   ├── css-fonts.js     # @font-face 处理
│   │   │   ├── css-medias.js    # @media 规则
│   │   │   ├── css-rules.js     # CSS 规则解析
│   │   │   ├── frame-tree.js    # iframe 帧树
│   │   │   ├── html-images.js   # 图片处理
│   │   │   └── html-serializer.js # HTML 序列化
│   │   └── vendor/              # 第三方库 (css-tree 等)
│   ├── extension/         # 浏览器扩展壳
│   │   ├── core/
│   │   │   ├── bg/              # background scripts
│   │   │   ├── content/         # content scripts
│   │   │   └── common/          # 共享工具
│   │   └── ui/                  # popup / options 页面
│   └── lib/               # 共享库 (fetch, zip 等)
├── cli/                   # Node.js CLI 入口
└── manifest.json          # MV3 扩展清单
```

## 8. 局限性分析

| 局限 | 详情 | 对 SaveIt 的启示 |
|------|------|-----------------|
| 单页捕获 | 一次只保存一个页面状态 | 需要多页批量能力 |
| 不处理 SPA 导航 | 无法感知 pushState 切换 | 需要路由监控模块 |
| 不展开侧边栏 | 折叠的导航树不会被展开 | 需要导航树发现与展开 |
| 不跟踪链接 | 不会访问页面中的其他链接 | 需要 URL 队列与爬取调度 |
| 大文件问题 | 资源密集页面生成 50MB+ HTML | 需要分页/增量策略 |
| 动态内容 | 只保存当前瞬间 DOM 状态 | 需要等待内容加载就绪 |
| 登录态 | 依赖当前 session cookies | 可复用浏览器登录态 |

## 9. 可复用组件

SingleFile 的 `single-file-core` 以 MIT 协议开源，可直接作为 SaveIt 的页面序列化引擎：

- ✅ 资源内联 (CSS/图片/字体/SVG)
- ✅ iframe 递归处理
- ✅ CSS 解析与重写
- ✅ 输出压缩与优化
- ✅ 元数据注入

SaveIt 只需在其上层构建：导航发现、多页编排、SPA 路由处理。
