# CDN & Server Info Displayer

<div align="center">

![Version](https://img.shields.io/badge/version-7.58.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Compatible-orange.svg)

一个优雅的用户脚本，用于实时显示网站的 CDN 提供商、服务器信息和缓存状态。

[安装](#安装) • [功能特性](#功能特性) • [使用方法](#使用方法) • [更新日志](#版本更新)

</div>

---

## ✨ 功能特性

### 🌐 CDN 检测

自动识别 **127 家 CDN / WAF / GSLB 厂商**（其中 115 家可通过 CNAME 识别），包括：

<details>
<summary>点击查看完整列表</summary>

- **国际 CDN**
    - Cloudflare
    - AWS CloudFront
    - Fastly
    - Akamai
    - Vercel
    - BunnyCDN
    - KeyCDN
    - CDN77
    - StackPath
    - QUIC.cloud
    - Medianova
    - CacheFly
    - BytePlus CDN (TikTok)

- **国内 CDN**
    - 腾讯云 EdgeOne
    - 阿里云 CDN
    - 字节跳动 CDN
    - 京东云 CDN
    - EdgeNext

- **Web 服务器**
    - LiteSpeed
    - OpenResty
    - Apache
    - Nginx

</details>

### 📊 信息展示

- **缓存状态检测**：实时显示 HIT、MISS、BYPASS、DYNAMIC 状态
- **POP 位置**：显示边缘节点地理位置
- **服务器信息**：识别 Web 服务器类型和版本
- **颜色编码**：
    - 🟢 **绿色** - 缓存命中 (HIT)
    - 🔴 **红色** - 缓存未命中 (MISS)
    - 🔵 **蓝色** - 缓存绕过 (BYPASS/DYNAMIC)

### 🎨 用户界面

- **晨光 / 夜光双主题**：银白陶瓷与深色仪器两种风格
- **品牌徽章**：大尺寸 CDN Logo；无 Logo 时自动生成厂商字母缩写
- **响应式布局**：完美适配桌面和移动设备
- **状态圆钮**：折叠时保留品牌图标与缓存状态灯
- **可拖拽**：拖动徽章或底部手柄调整位置
- **Shadow DOM 隔离**：确保样式不受网站影响

### 🔒 安全与隐私

- ✅ 自动排除敏感页面（登录、支付等）
- ✅ 仅读取 HTTP 响应头，不修改页面内容
- ✅ 不收集或发送任何用户数据
- ✅ 完全本地运行，无外部依赖

### ⚡ 技术特性

- 使用 HEAD 请求获取响应头（最小化网络开销）
- 支持单页应用 (SPA) 的 URL 变化检测
- 智能重试机制处理网络请求失败
- 模块化 CDN 检测规则，易于扩展
- 优先级系统确保准确识别（CDN > 服务器）

---

## 📦 安装

### 前置要求

安装用户脚本管理器（任选其一）：

- [Tampermonkey](https://www.tampermonkey.net/) - 推荐，支持所有主流浏览器
- [Violentmonkey](https://violentmonkey.github.io/) - 开源替代方案
- [Greasemonkey](https://www.greasespot.net/) - Firefox 专用

### 安装脚本

点击下方链接安装：

**[📥 安装 CDN & Server Info Displayer](https://raw.githubusercontent.com/zhousulong/cdn-server-info-userscript/main/cdn-server-info.user.js)**

或者手动安装：

1. 复制 [cdn-server-info.user.js](https://raw.githubusercontent.com/zhousulong/cdn-server-info-userscript/main/cdn-server-info.user.js) 的内容
2. 在 Tampermonkey 中创建新脚本
3. 粘贴代码并保存

---

## 🚀 使用方法

### 基本使用

安装后，脚本会自动在网页右下角显示一个信息面板：

```
┌──────────────────────────┐
│         Cloudflare       │
│                        × │
│  CACHE            POP    │
│  ● HIT       SJC         │
│  SERVER      nginx       │
│  NETWORK MONITOR      ⌃  │
└──────────────────────────┘
```

### 交互操作

- **展开 / 折叠**：点击折叠圆钮展开，点击圆钮区域或“Less”收起
- **拖拽移动**：拖动折叠圆钮或底部拖拽手柄
- **切换主题**：点击面板上的 ☀️/🌙 图标
- **关闭面板**：点击 × 按钮

### 自定义设置

脚本会自动保存您的偏好设置：

- 主题选择（浅色/深色）
- 面板位置与展开状态

---

## 📋 版本更新

### v7.58.0 (2026-11-11) - 仪器面板重构与折叠位置修复

#### 🎨 界面

- **晨光仪器**：银白陶瓷、苔绿色状态灯与更大的品牌视觉。
- **夜光仪器**：深色金属外壳、暖橙 Logo 与低亮度数据层级。
- **无图标兜底**：自动生成 `CA`、`EN` 等厂商字母徽章，不再退回通用雷达图。
- **交互重构**：状态灯圆钮折叠、独立拖拽手柄、详情收起和 44px 移动端触控热区。
- **主题持久化**：手动选择的浅色/深色主题不再被网页主题覆盖。

#### 🐛 修复

- **右下角折叠漂移**：移除展开时冲突的位置校正，保持 `right` / `bottom` 锚点，折叠圆钮返回原位置。
- **拖动后定位**：验证拖动后的展开方向及折叠位置，面板不再落在展开内容的左上角。
- **DNS 二次校正**：只更新厂商名称与徽章，避免误写缓存状态字段。

### v7.57.1 (2026-11-10) - 安全与稳定性修复

#### 🔒 安全

- **修复 XSS**：响应头 `Server` 值、POP、缓存状态及 DNS CNAME 值此前未经转义直接写入 `innerHTML`，可被恶意/被篡改的响应头或 DNS 应答注入执行脚本；现统一 `escapeHtml()` / `textContent` 处理。

#### 🔧 检测准确性

- **移除通用头无值匹配**：`VergeCloud`、`Gcore`、`BytePlus`、`Fastly`、`StackCDN` 等 9 处 `x-request-id` / `x-cache-status` / `x-served-by` / `x-id` 通用头改为专有信号，避免误识别（符合 PROJECT_RULES 禁用通用头原则）。
- **通用 `id_header` 降级**：`x-request-id` / `x-served-by` 等通用头不再加 +50 分，仅 +10。
- **修复 Akamai POP 正则**：`/cache-([a-z0-9]+)-/` 会把 `lga1234` 整段捕获，改为只取 3 字母机场码。
- **缓存状态解析**：改用词边界匹配，避免 `NOHIT` 误判为 `HIT`，并支持 `STALE` / `REVALIDATED` 与 Kestrel `hascache`。
- **Cookie 匹配**：按 `name=value` 精确匹配，不再对整个 `Set-Cookie` 串做子串匹配。
- **优先级收敛**：`ByteDance CDN` 26→18、`BytePlus CDN` 25→17，避免头部分被异常抬高。

#### 🐛 稳定性

- **SPA DNS 竞态**：DNS 异步结果回调增加 token 校验，过期请求不再覆盖新页面面板。
- **DNS 请求超时**：DoH 增加 4s 超时；不再永久缓存负结果；用户地区增加 10 分钟缓存。
- **滚动监听生命周期**：改用 `AbortController`，面板移除时自动解绑；修复拖动后误触发折叠。
- **展开视口约束**：接线 `adjustPanelPosition`，展开时自动回弹避免溢出；拖动边界按展开尺寸计算。
- **存储弹窗越界**：拖动 clamp 使用展开尺寸。

#### 🧹 工程与体验

- 删除死代码 `createSettingsPanel`；移除失效的 `.eslintrc.json`。
- `npm test` 接入真实回归套件；ESLint 配置补全 globals，`npm run lint` 转绿。
- 面板补充 `prefers-reduced-motion` 与 `:focus-visible` 焦点样式、按钮 `aria-label`。
- 同步工具 `sync_ip438_cnames.py` 的 glob 正则与运行时一致（`*` 只在单标签展开）。

### v7.57.0 (2026-10-28) - CDN 规则库同步 ip438 CNAME 对照表

#### 🆕 新增功能

- **CNAME 规则支持通配符**：`"kunlun*.com"`、`"tdnsv*.com"` 这类带 `*` 的后缀可直接写进 `cdn_rules.json`，`*` 只在单个标签内展开
- **73 个仅靠 CNAME 识别的厂商**：网宿 CDN、蓝汛 ChinaCache、360 云 CDN、天翼云 CTYun、世纪互联、帝联/快网/新浪云/网易云/美团云、Bilibili、Azure App Service / Traffic Manager、GitHub & GitLab Pages、Heroku、Sangfor、奇安信/绿盟/安恒 WAF 等
- **CNAME 规则从 137 条增至 387 条**，来源为 ip438 对照表 + 线上 DoH 抽样校验

#### 🔧 改进优化

- 网宿系后缀（`lxdns` / `wscdns` / `wsdvs` / `chinanetcenter` / `cdn20` / `wswebcdn` / `wsglb0`）从 CDNetworks 迁出，独立成 `Wangsu CDN`
- 修正错误归属：`hwcdn.net` 归还 StackPath(Highwinds)、`azurewebsites.net` 归还 Azure App Service、`ccgslb` / `chinacache` 归还蓝汛
- DNS 匹配逻辑抽出 `cnameMatchesPattern()`，不再在 provider/pattern 双层循环里重复 split
- 新增规则库维护与回归工具：`tools/sync_ip438_cnames.py`、`tools/test_cname_matching.mjs`

### v7.5.0 (2025-12-17) - 缓存检测和样式隔离增强

#### 🆕 新增功能

- **增强 LiteSpeed 缓存检测**：添加了对 `x-litespeed-cache` 和 `x-lsadc-cache` 响应头的支持
- **新增服务器检测**：支持 LiteSpeed、OpenResty、Apache、Nginx 的检测和图标显示

#### 🔧 改进优化

- **CSS 样式隔离**：优化 Shadow DOM 样式隔离机制，确保面板在不同网站上的渲染一致性
- **图标匹配算法**：改进模糊匹配逻辑，修复 QUIC.cloud、LiteSpeed 等提供商的图标显示问题
- **面板宽度调整**：优化为 252px，在使用 border-box 布局模型后保持原有视觉宽度

#### 🗑️ 移除功能

- 移除了无实际作用的右键菜单功能，简化用户交互

<details>
<summary>查看历史版本</summary>

### v7.4.0 - 服务器检测和图标优化

- 添加 LiteSpeed/OpenResty/Apache/Nginx 检测
- 改进图标匹配算法
- 修复水印显示问题

### v6.1.1 - 显示优化

- 优化字体大小和面板宽度
- 更好地显示长 CDN 名称

### v6.1.0 - UI 重新设计

- 采用 iOS 风格玻璃效果
- 简化信息显示
- 优化移动端体验

### v6.0.0 - 重大更新

- 新增 5 个 CDN 提供商
- 扩展信息显示
- 增加自定义选项

### v5.8.5 - 功能增强

- 添加 Wovn.io 检测
- 改进 Akamai 检测规则
- 增强 POP 位置解析

### v5.8.0 - 模块化重构

- 模块化 CDN 检测规则
- 添加设置面板
- 支持主题切换

</details>

---

## 🛠️ 技术架构

### 核心技术

- **检测机制**：基于 HTTP 响应头分析
- **UI 框架**：原生 JavaScript + Shadow DOM
- **样式系统**：CSS3 + Glassmorphism
- **存储方案**：GM_setValue/GM_getValue

### 检测规则

CDN 检测规则存储在 [`cdn_rules.json`](./cdn_rules.json) 中，支持：

- 响应头匹配
- 服务器名称匹配
- Via 头解析
- CNAME 后缀 / 标签 / 通配符匹配（DNS 兜底识别）
- 优先级系统

示例规则：

```json
{
    "Cloudflare": {
        "headers": ["cf-ray", "cf-cache-status"],
        "pop_header": "cf-ray",
        "pop_regex": "^[0-9a-f]+-([A-Z]{3})",
        "priority": 10
    }
}
```

#### CNAME 规则的三种写法

| 写法            | 含义                               | 命中示例                        |
| --------------- | ---------------------------------- | ------------------------------- |
| `"akadns"`      | 完整标签匹配                       | `a.akadns.net` / `a.akadns.com` |
| `"dnsv1.com"`   | 域名后缀匹配                       | `shop.cdn.dnsv1.com`            |
| `"kunlun*.com"` | 通配符匹配，`*` 只在单个标签内展开 | `shop.kunlunaq.com`             |

只有 `cnames` + `priority` 的规则不会进入响应头打分，只在 DNS 检测阶段生效，因此新增厂商不会引入误识别。

#### 规则库维护工具

```bash
python3 tools/sync_ip438_cnames.py --dry-run   # 预览 ip438 CNAME 对照表的合并结果
python3 tools/sync_ip438_cnames.py             # 合并进 cdn_rules.json（可重复执行）
node tools/test_cname_matching.mjs             # 用脚本内真实的匹配函数做冲突 + 样例回归
```

数据来源快照：[`tools/ip438_cdnfinder_cnames.json`](./tools/ip438_cdnfinder_cnames.json)（[ip438 CDN 厂商查询](https://www.ip438.com/tool/cdnfinder/)）。

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 添加新的 CDN 检测规则

1. Fork 本仓库
2. 编辑 `cdn_rules.json` 添加新规则
3. 在 `cdn-server-info.user.js` 中添加对应的 SVG 图标（可选）
4. 提交 PR 并说明新增的 CDN 提供商

### 报告问题

如果发现 CDN 检测不准确或有其他问题，请[提交 Issue](https://github.com/zhousulong/cdn-server-info-userscript/issues)，并提供：

- 网站 URL
- 期望检测到的 CDN
- 实际显示的结果
- 浏览器控制台的响应头信息

---

## 👨‍💻 开发者指南

### 版本管理工作流

本项目使用自动化脚本管理版本号,确保 `package.json` 和 `cdn-server-info.user.js` 中的版本号保持同步。

#### 快速使用

```bash
# 补丁版本 (bug修复): 7.54.0 → 7.54.1
npm run version:patch

# 次版本 (新功能): 7.54.0 → 7.55.0
npm run version:minor

# 主版本 (重大更新): 7.54.0 → 8.0.0
npm run version:major
```

#### 完整提交流程

```bash
# 1. 更新版本号
npm run version:minor

# 2. 检查更改
git diff

# 3. 运行代码检查
npm run lint

# 4. 提交更改
git add .
git commit -m "chore: bump version to 7.55.0"
git push
```

#### 语义化版本规范

- **主版本号 (Major)**: 不兼容的 API 修改
- **次版本号 (Minor)**: 向下兼容的功能性新增
- **修订号 (Patch)**: 向下兼容的问题修正

详细说明请查看 [版本更新指南](.agent/VERSION_UPDATE_GUIDE.md)

### 代码质量检查

```bash
# 运行 ESLint 检查
npm run lint

# 自动修复 ESLint 问题
npm run lint:fix

# 检查代码格式
npm run format:check

# 自动格式化代码
npm run format
```

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 开源协议。

---

## 👨‍💻 作者

**Zhou Sulong**

- GitHub: [@zhousulong](https://github.com/zhousulong)

---

## ⭐ Star History

如果这个项目对你有帮助，请给个 Star ⭐️

---

<div align="center">

Made with ❤️ by Zhou Sulong

</div>
