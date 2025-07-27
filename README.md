# CDN & 服务器信息显示器

## 功能特性

### CDN检测
- 自动识别多种CDN提供商：
  * Tencent EdgeOne（腾讯云EdgeOne）
  * Cloudflare
  * AWS CloudFront
  * Fastly
  * Akamai
  * ByteDance CDN（字节跳动CDN）
  * Alibaba Cloud CDN（阿里云CDN）
  * BunnyCDN
  * JD Cloud CDN（京东云CDN）
  * QUIC.cloud
  * Vercel
- 检测缓存状态（HIT、MISS、BYPASS、DYNAMIC）
- 显示POP位置信息（边缘节点位置）

### 用户界面
- 在页面右下角显示一个美观的信息面板
- 面板可拖拽移动位置
- 提供关闭按钮
- 根据缓存状态使用不同颜色显示（HIT为绿色，MISS为粉色等）
- 支持深色/浅色主题切换
- 可自定义面板位置（左上、右上、左下、右下）

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

### v5.8.0 增强版
- 模块化CDN检测规则
- 添加设置面板，支持自定义配置
- 增强UI，支持深色/浅色主题切换
- 可自定义面板位置

### v5.7.2 规则增强
- 再次增强腾讯云 EdgeOne 的识别规则
- 新增对 `eo-` 前缀头（如 eo-cache-status, eo-log-uuid）的检测