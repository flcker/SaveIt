# 构建指南

## 环境要求

- Node.js >= 18
- npm >= 9
- Firefox >= 115 或 Chrome >= 118

## 安装依赖

```bash
npm install
```

## 构建命令

| 命令 | 说明 | 产物 |
|------|------|------|
| `npm run build` | 构建 Firefox 版本 | `dist/` |
| `npm run build:chrome` | 构建 Chrome/Edge 版本 | `dist-chrome/` |
| `npm run build:all` | 同时构建两个版本 | `dist/` + `dist-chrome/` |
| `npm run dev` | 监听模式自动重建（Firefox） | `dist/` |
| `npm run icons` | 生成占位图标 | `src/icons/` |
| `npm run test` | 运行测试 | — |
| `npm run lint` | TypeScript 类型检查 | — |
| `npm run start:firefox` | 启动 web-ext 临时加载 | — |

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

## 开发流程

```bash
# 1. 安装依赖
npm install

# 2. 生成图标（首次）
npm run icons

# 3. 监听模式开发
npm run dev

# 4. 另一个终端启动 Firefox（需要本地安装）
npm run start:firefox
```

修改源码后 Vite 自动重建 `dist/`，在 Firefox `about:debugging` 页面点击"重新加载"即可看到更新。

## 生产构建

```bash
# 构建两个平台的正式版本
npm run build:all
```

产物大小（gzip）：

| 文件 | Firefox | Chrome |
|------|---------|--------|
| background.js | ~6 KB | ~5 KB |
| content.js | ~6 KB | ~6 KB |
| popup.js | ~9 KB | ~9 KB |
| offscreen.js | — | ~0.5 KB |
| options.js | ~0.8 KB | ~0.8 KB |

## 双平台差异

| | Firefox (MV2) | Chrome (MV3) |
|---|---|---|
| 后台 | 持久 background page | Service Worker（可能挂起） |
| DOM 处理 | 直接在后台页面 | Offscreen Document |
| 保活 | 无需 | chrome.alarms 24s 心跳 |
| API | `browser.*` (Promise) | `chrome.*` (Promise, MV3) |
| 最低版本 | 115 | 118 |

代码中通过 `const api = (typeof browser !== 'undefined' ? browser : chrome)` 统一调用。

## 故障排除

### 构建失败

```bash
# 清除缓存重新安装
rm -rf node_modules dist dist-chrome
npm install
npm run build
```

### web-ext lint 报错

```bash
npx web-ext lint --source-dir dist
```

常见警告 `UNSAFE_VAR_ASSIGNMENT (innerHTML)` 来自 Solid.js 内部，可安全忽略。

### Firefox 找不到

`npm run start:firefox` 需要 Firefox 在系统 PATH 中，或配置 `web-ext.config.ts`：

```ts
export default {
  run: {
    firefox: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
  },
};
```
