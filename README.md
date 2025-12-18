# CDN & Server Info Displayer

<div align="center">

![Version](https://img.shields.io/badge/version-7.5.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Compatible-orange.svg)

一个优雅的用户脚本，用于实时显示网站的 CDN 提供商、服务器信息和缓存状态。

[安装](#安装) • [功能特性](#功能特性) • [使用方法](#使用方法) • [更新日志](#版本更新)

</div>

---

## ✨ 功能特性

### 🌐 CDN 检测

自动识别 **30+ 主流 CDN 提供商**，包括：

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

- **iOS 风格设计**：采用玻璃拟态 (Glassmorphism) 效果
- **响应式布局**：完美适配桌面和移动设备
- **主题切换**：支持浅色/深色主题
- **可拖拽**：自由调整面板位置
- **CDN 水印**：优雅的 CDN 图标背景水印
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
┌─────────────────────────┐
│  CDN & SERVER INFO      │
│                         │
│  Server    Cloudflare   │
│  Cache     HIT          │
│  POP       SJC          │
└─────────────────────────┘
```

### 交互操作

- **拖拽移动**：点击并拖动面板到任意位置
- **切换主题**：点击面板上的 ☀️/🌙 图标
- **关闭面板**：点击 × 按钮

### 自定义设置

脚本会自动保存您的偏好设置：

- 主题选择（浅色/深色）
- 面板位置

---

## 📋 版本更新

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
