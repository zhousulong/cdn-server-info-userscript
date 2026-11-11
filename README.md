# CDN & Server Info Displayer

<div align="center">

![Version](https://img.shields.io/badge/version-7.61.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Compatible-orange.svg)

一个优雅的用户脚本，用于实时显示网站的 CDN 提供商、边缘节点、HTTP 首字节延迟和缓存状态。

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
    - 腾讯云 EdgeOne、阿里云 CDN、字节跳动 / 火山引擎 CDN
    - 百度智能云、华为云、金山云、七牛云、又拍云
    - 京东云、天翼云、网宿、EdgeNext

- **Web 服务器**
    - LiteSpeed
    - OpenResty
    - Apache
    - Nginx

</details>

### 📊 信息展示

- **缓存状态检测**：实时显示 HIT、MISS、BYPASS、DYNAMIC 状态
- **POP / 节点码**：国际厂商显示机场码；国内厂商有明确节点标识时保留原始节点码，并标明不是已验证的城市位置
- **HTTP TTFB**：显示本次检测请求的首字节耗时，包含网络与服务端处理时间，不冒充 ICMP Ping
- **协议与建连**：显示本次请求协商的 HTTP 协议（HTTP/2、HTTP/3 等）和 TCP+TLS 建连耗时；连接复用时显示 `reused`。建连耗时是浏览器里最接近网络往返（ping）的指标
- **服务器信息**：识别 Web 服务器类型和版本
- **颜色编码**：
    - 🟢 **绿色** - 缓存命中 (HIT)
    - 🔴 **红色** - 缓存未命中 (MISS)
    - 🔵 **蓝色** - 缓存绕过 (BYPASS/DYNAMIC)

### 🎨 用户界面

- **晨光 / 夜光主题**：银白陶瓷与深色仪器两种风格，并支持跟随页面与系统
- **品牌徽章**：大尺寸 CDN Logo；无 Logo 时自动生成厂商字母缩写
- **响应式布局**：完美适配桌面和移动设备
- **状态圆钮**：折叠时保留品牌图标与缓存状态灯
- **设置面板**：主题、DNS、站点隐藏、位置重置和详情复制集中管理
- **可拖拽**：拖动徽章或底部手柄调整位置
- **Shadow DOM 隔离**：确保样式不受网站影响

### 🔒 安全与隐私

- ✅ 自动排除敏感页面（登录、支付等）
- ✅ 仅读取 HTTP 响应头，不修改页面内容
- ✅ 无账号、无统计埋点、不收集浏览历史
- ⚙️ DNS 查询会把当前域名发送给 `dns.google` 或 `dns.alidns.com`；可在设置中完全关闭
- ⚙️ 地区判断会访问 `1.1.1.1/cdn-cgi/trace`，关闭 DNS 查询时不会发起
- ⚙️ 检测规则由用户脚本管理器从本项目 GitHub 资源地址获取

### ⚡ 技术特性

- 使用 HEAD 请求获取响应头并测一次 TTFB（最小化网络开销），不后台轮询 Ping
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

安装后，脚本会在网页右下角显示一个状态圆钮；展开后显示信息面板：

```
┌──────────────────────────┐
│         Cloudflare       │
│                        × │
│  CACHE       POP    TTFB │
│  ● HIT       SJC    36ms │
│  SERVER      nginx       │
│  PROTOCOL    HTTP/3      │
│  CONNECT     reused      │
│  NETWORK MONITOR      ⌃  │
└──────────────────────────┘
```

### 交互操作

- **展开 / 缩小**：点击状态圆钮展开，点击面板左上角的“—”按钮回到圆钮
- **收起详情**：点击“Less”只隐藏服务器、协议与 DNS 明细，不缩小整个面板
- **拖拽移动**：拖动折叠圆钮或底部拖拽手柄
- **切换主题**：点击面板上的 ☀️/🌙 图标固定切换亮色 / 暗色
- **打开设置**：点击面板右上角的滑杆按钮
- **关闭面板**：点击 × 按钮
- **恢复隐藏站点**：在当前网站使用用户脚本管理器的“Enable CDN panel on this site”菜单

### POP 与 TTFB 怎么读

| 面板字段 | 示例         | 含义                                                            |
| -------- | ------------ | --------------------------------------------------------------- |
| `POP`    | `SJC`        | Cloudflare 等国际厂商公开的边缘节点 / 机场码                    |
| `POP`    | `CN3842`     | 国内厂商返回的边缘节点码，不代表已验证的城市或地理位置          |
| `POP`    | `L2-EA120-5` | 上层缓存节点码；阿里系响应中优先显示非 L2 节点，没有时才显示 L2 |
| `POP`    | `—`          | 响应未提供可靠节点信息，不使用请求 UUID、CNAME 或访问者位置猜测 |
| `TTFB`   | `36 ms`      | 当前检测请求从发起到收到首个响应字节的实测耗时                  |

国内 CDN 节点码目前覆盖：

| 厂商                | 识别来源                        | 示例                   |
| ------------------- | ------------------------------- | ---------------------- |
| 阿里云 CDN          | `Via` 中的 L1 / L2 节点         | `CN3842`、`L2-EA120-5` |
| 字节跳动 / 火山引擎 | `Via` 中的缓存节点              | `JSWUXI`、`CN7594`     |
| 百度智能云          | `Ohc-Cache-Hit`                 | `BJCT3`                |
| 金山云              | `X-Cache-Status` / `X-Link-Via` | `YANC`                 |
| 华为云              | `Via` 中的 `HCDN` / `CHN` 节点  | `HD-ZJ`                |
| 天翼云              | `Ctl-Cache-Status`              | `ZJ-WENZHOU`           |
| 网宿 / CDNetworks   | `Via` / `X-Px`                  | `FOC`                  |
| 又拍云              | `Via` 中的 `V.mix-*` 节点       | `MIX-HB-WUXI-084`      |

`TTFB` **不是 ICMP Ping**：它还会受到 TCP/TLS 握手、HTTP 协议、请求排队、CDN 缓存状态及源站处理时间影响，适合比较同一浏览器访问同一 URL 的响应变化，不等同于网络带宽。脚本复用原有 HEAD 检测请求，HEAD 返回 403 / 405 时改用 GET；不会额外发送持续 Ping。

将鼠标悬停在 `TTFB` 数值上可查看请求方法和精确毫秒。设置的 **Copy details** 会导出结构化数据，例如：

```json
{
    "provider": "Alibaba Cloud CDN",
    "cache": "MISS",
    "pop": "CN3842",
    "popType": "node-code",
    "latency": {
        "value": "61 ms",
        "ttfbMs": 61,
        "networkMs": null,
        "method": "HEAD",
        "protocol": "h2",
        "connectMs": 42,
        "reused": false
    }
}
```

### 自定义设置

脚本会自动保存您的偏好设置：

- 主题选择（Auto / Light / Dark）
- DNS 查询开关（关闭后不会向 DoH 服务发送域名）
- 在指定站点永久隐藏面板
- 面板位置、展开状态与右下角锚点

---

## 📋 版本更新

### v7.61.0 (2026-11-11) - 速度指标聚焦

#### ⚡ 新增速度指标

- **Protocol**：显示本次探测实际协商的协议（HTTP/2、HTTP/3 等），来自浏览器 Resource Timing，零额外请求。
- **Connect**：显示 TCP + TLS 建连耗时，是浏览器里最接近网络往返（ping）的指标；连接复用时显示 `reused`，悬停可查看说明。

#### 🧹 面板精简

- **移除重复的 Response 行**：与主网格的 TTFB 列完全重复。
- **移除 Content 行**：内容类型与速度无关；原 Transport 行只显示 HTTPS/HTTP，由真实协议数据替代。
- **复制详情**：`latency` 中新增 `protocol`、`connectMs`、`reused`；移除 `transport`、`contentType` 字段。

#### 🧪 工程

- 新增协议名归一化测试（`h2`/`h3`/`http/1.1`）。

### v7.60.0 (2026-11-11) - 国内 CDN 节点码与 HTTP 延迟

#### 🌐 国内节点识别

- **阿里云 / 火山引擎**：从 `Via` 解析 `cn3842`、`l2ea120-5` 等节点码，优先显示非 L2 节点并保留层级和数字后缀；不再把数字节点误显示成 `CN` 国家码。
- **百度 / 金山 / 华为 / 天翼云 / 网宿**：补齐已有节点分支的节点码标记，修正华为小写 `Via` 节点与省市代码解析。
- **又拍云**：支持 `Via: V.mix-hb-wuxi-084` 这类明确节点格式。
- **准确性边界**：国内 `POP` 列显示的是厂商返回的节点码，不声称已验证城市；腾讯 EdgeOne 等仅返回 UUID 的响应继续显示未知，不反推位置。

#### ⚡ 连接速度

- **TTFB 指标**：复用检测用的 HEAD 请求测量 HTTP 首字节耗时；HEAD 被拒并改用 GET 时只记录最终请求。
- **零额外探测**：不做持续 Ping 或新增测速请求；悬停可查看请求方法、精确毫秒和可用的浏览器网络时序。
- **清晰语义**：TTFB 包含网络、排队与服务端处理时间，不等于 ICMP RTT，也不是下载带宽。
- **详情复制**：复制结果新增延迟数值、请求方法以及 POP 的节点码类型。
- **厂商名一致**：修复腾讯 EdgeOne 自定义处理器名称，统一显示 `Tencent Cloud CDN`，正确保留其缓存状态。

#### 🧪 工程

- 增加国内节点码、腾讯不误报、阿里多节点、又拍云和延迟格式化回归测试。

### v7.59.0 (2026-11-11) - 设置中心与发布校验

#### 🆕 设置与隐私

- **面板设置中心**：新增主题、DNS、站点隐藏、位置重置和详情复制。
- **真正的 Auto 主题**：优先跟随页面主题，无法判断时再跟随系统主题。
- **DNS 隐私开关**：关闭后不再请求 Google / AliDNS DoH，也会跳过 `1.1.1.1` 地区判断。
- **按站点隐藏**：持久隐藏当前 hostname，不再在当前网站显示面板。
- **恢复入口**：通过用户脚本管理器菜单可在隐藏站点重新启用面板。
- **复制详情**：将 URL、厂商、角色、缓存、POP、Server、传输协议、内容类型和 DNS 结果复制为 JSON。

#### 🎨 面板体验

- **源站识别**：Web Server 且无缓存头时显示 `ORIGIN RESPONSE`，不再展示两个无意义的 `—`。
- **详情补全**：增加 Transport 与 Content 信息，并随“Less”一起收起。
- **排版校正**：拉开顶部功能按钮与品牌 Logo 的距离，并统一 Server / 详情行的标签与值基线。
- **移动端设置态**：自动增高面板，保留 44px 触控热区，小屏仍可滚动兜底。
- **焦点与键盘**：设置对话框支持 Esc 关闭、Tab 循环和焦点返回。

#### 🧪 工程

- **检测回归测试**：覆盖 Cloudflare、Akamai、Vercel、源站、未知响应、缓存语义与 HTML 转义。
- **发布版本校验**：校验 `package.json`、`package-lock.json`、userscript 版本 / 资源参数 / 描述、README 徽章与更新日志。
- **CI 校验**：GitHub Actions 执行语法、版本、Lint、测试与格式检查。

### v7.58.1 (2026-11-11) - 缩小状态修复

#### 🐛 修复

- **默认状态**：首次加载恢复为状态圆钮，不再在桌面端自动展开整个面板。
- **最小化入口**：展开后新增左上角“—”按钮，可随时缩回品牌圆钮。
- **状态持久化**：缩回圆钮后会记住状态，刷新页面仍保持圆钮。
- **右下角锚定**：展开时向左上生长，缩回时回到同一个右下角；拖动后也以面板右下角为固定锚点。
- **详情收起**：明确区分“Less（收起详情）”与“最小化到圆钮”两种操作。

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

国内 CDN 通常没有 Cloudflare `CF-RAY` 这类公开机场码。脚本的厂商专用解析器会从 `Via`、缓存状态等明确字段提取节点码；`popKind: node-code` 用于区分它与已验证的地理位置。没有可靠字段时不推断城市。

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

# 2. 更新 README 版本说明
git diff

# 3. 运行完整检查
npm run lint
npm test
npm run release:check
npm run format:check

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
# 语法检查
node --check cdn-server-info.user.js

# 运行 ESLint 检查
npm run lint

# CNAME / 响应头解析回归测试
npm test

# 发布版本号与文档一致性检查
npm run release:check

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
