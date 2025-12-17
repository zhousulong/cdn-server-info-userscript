# CDN & 服务器信息显示器

## 功能特性

### CDN检测

- 自动识别多种CDN提供商：
    - Tencent EdgeOne（腾讯云EdgeOne）
    - Cloudflare
    - AWS CloudFront
    - Fastly
    - Akamai
    - ByteDance CDN（字节跳动CDN）
    - Alibaba Cloud CDN（阿里云CDN）
    - BunnyCDN
    - JD Cloud CDN（京东云CDN）
    - QUIC.cloud
    - Vercel
    - Wovn.io
    - KeyCDN
    - CDN77
    - StackPath
    - ChinaCache
- 检测缓存状态（HIT、MISS、BYPASS、DYNAMIC）
- 显示POP位置信息（边缘节点位置）

### 用户界面

- 采用iOS风格的玻璃效果设计
- 在页面角落显示简洁的信息面板
- 面板可拖拽移动位置
- 提供关闭按钮
- 根据缓存状态使用不同颜色显示（HIT为绿色，MISS为红色等）
- 支持深色/浅色主题切换
- 可自定义面板位置（左上、右上、左下、右下）
- 针对移动端优化的简洁布局
- 优化字体大小以适应长CDN名称

### 技术特性

- 使用HEAD请求获取响应头信息进行分析
- 支持单页应用（SPA）的URL变化检测
- 具有重试机制处理网络请求失败
- 排除特定页面（如登录页、支付页等）

### 安全与隐私

- 排除敏感页面（登录、支付等）
- 使用Shadow DOM隔离样式
- 不收集或发送任何用户数据

## 版本更新

### v7.5.0 缓存检测和样式隔离增强

- **增强 LiteSpeed 缓存检测**：添加了对 `x-litespeed-cache` 和 `x-lsadc-cache` 响应头的支持，现在可以正确显示 LiteSpeed 服务器的缓存状态（HIT/MISS）
- **改进 CSS 样式隔离**：优化了 Shadow DOM 的样式隔离机制，确保面板在不同网站上的渲染一致性，防止网站全局样式影响面板高度和布局
- **新增服务器检测**：添加了对以下 Web 服务器的检测和图标支持：
  - LiteSpeed (优先级 7)
  - OpenResty (优先级 6)
  - Apache (优先级 5)
  - Nginx (优先级 5)
- **改进图标匹配**：优化了 CDN 图标的模糊匹配算法，修复了 QUIC.cloud、LiteSpeed 等提供商的图标显示问题
- **移除无用功能**：移除了右键菜单功能，简化用户交互
- **宽度优化**：调整面板宽度为 252px，在使用 border-box 布局模型后保持原有的视觉宽度

### v6.1.1 作者和显示优化

- 更新了脚本作者名字
- 优化了字体大小和面板宽度以更好地显示长CDN名称

### v6.1.0 UI重新设计

- 重新设计了UI，采用iOS风格的玻璃效果
- 简化了信息显示，优化了移动端体验
- 保留了增强的CDN检测能力

### v6.0.0 重大更新

- 增强CDN检测能力，添加5个新的CDN提供商（KeyCDN、CDN77、StackPath、ChinaCache等）
- 扩展信息显示，包括服务器信息、连接类型和内容类型
- 改进了UI并增加了更多自定义选项

### v5.8.5 增强版

- 添加了对Wovn.io的检测支持
- 改进了Akamai检测规则
- 增加了对`x-served-by`头的解析以获取Akamai的POP位置
- 修复了一些bug

### v5.8.0 增强版

- 模块化CDN检测规则
- 添加设置面板，支持自定义配置
- 增强UI，支持深色/浅色主题切换
- 可自定义面板位置

### v5.7.2 规则增强

- 再次增强腾讯云 EdgeOne 的识别规则
- 新增对 `eo-` 前缀头（如 eo-cache-status, eo-log-uuid）的检测

## 安装

1. 安装用户脚本管理器，如[Tampermonkey](https://www.tampermonkey.net/)或[Greasemonkey](https://www.greasespot.net/)。
2. 点击[这里](https://raw.githubusercontent.com/zhousulong/cdn-server-info-userscript/main/cdn-server-info.user.js)安装脚本。

## 使用方法

安装后，脚本会自动在大多数网页的角落显示一个小面板，显示检测到的CDN和缓存信息。右键单击面板可以打开设置进行自定义。
