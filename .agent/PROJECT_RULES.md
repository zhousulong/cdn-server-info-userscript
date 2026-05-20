# CDN Server Info Userscript - AI 协作规则

## 🎯 项目核心原则

这是一个用于检测和显示 CDN/服务器信息的 Tampermonkey 用户脚本。在修改代码前，**必须**先理解以下关键原则。

---

## 📋 CDN 检测规则 (`cdn_rules.json`)

### ✅ DO - 正确做法

1. **使用 CDN 专有头**

    ```json
    {
        "Cloudflare": {
            "headers": {
                "cf-ray": null, // ✅ Cloudflare 专有
                "cf-cache-status": null // ✅ Cloudflare 专有
            }
        }
    }
    ```

2. **使用带值匹配的通用头**

    ```json
    {
        "SwiftServe CDN": {
            "headers": {
                "x-cache": "swiftserve" // ✅ 匹配特定值
            }
        },
        "Kingsoft Cloud": {
            "headers": {
                "x-cache-status": "KS-CLOUD-" // ✅ 匹配特定前缀
            }
        }
    }
    ```

3. **使用正则模式匹配**

    ```json
    {
        "AWS CloudFront": {
            "via": "cloudfront\\.net" // ✅ 特定域名模式
        }
    }
    ```

4. **组合多个独特头**
    ```json
    {
        "Akamai": {
            "headers": {
                "x-akamai-transformed": null,
                "x-akamai-request-id": null,
                "server-timing": "ak_p"
            }
        }
    }
    ```

### ❌ DON'T - 错误做法

1. **禁止使用超级通用头**

    ```json
    // ❌ 错误示例
    {
        "HiNet CDN": {
            "headers": {
                "x-request-id": null, // ❌ 几乎所有服务器都有
                "x-cache": null // ❌ 太通用，很多 CDN 都用
            }
        }
    }
    ```

2. **禁止使用无特征的通用头**
    ```json
    // ❌ 错误示例
    {
        "Gcore": {
            "headers": {
                "cache": null, // ❌ 太通用
                "x-id": null // ❌ 太通用
            }
        }
    }
    ```

### 🚨 高风险通用头列表（避免使用）

- `x-request-id` - 几乎所有服务器都用
- `x-cache` - 除非有值匹配（如 `"x-cache": "swiftserve"`）
- `cache` - 太通用
- `x-id` - 太通用
- `x-served-by` - Akamai 和 Fastly 都用，需谨慎
- `x-link-via` - 多个 CDN 使用

### 📊 优先级指南

- **15+**: 有多个独特头的高可信度 CDN
- **12-14**: 有特定头组合的 CDN
- **10-11**: 标准 CDN（大多数）
- **8-9**: 次要 CDN 或有冲突风险的
- **5-7**: 通用服务器（Nginx, Apache, LiteSpeed）

**重要**: 调整优先级**不能**解决头冲突问题，只有**更精确的规则**才能！

---

## 🎨 CDN Logo 规则 (`cdnIcons` in JS)

### ✅ DO - 正确做法

1. **使用 `fill="currentColor"`**

    ```svg
    <svg viewBox="0 0 100 100">
      <path fill="currentColor" d="..."/>
      <circle fill="currentColor" fill-opacity="0.7" cx="50" cy="50" r="20"/>
    </svg>
    ```

2. **使用 `fill-opacity` 保持层次**

    ```svg
    <path fill="currentColor" fill-opacity="1.0" d="..."/>    <!-- 主要元素 -->
    <path fill="currentColor" fill-opacity="0.7" d="..."/>    <!-- 次要元素 -->
    <path fill="currentColor" fill-opacity="0.5" d="..."/>    <!-- 装饰元素 -->
    ```

3. **移除内联样式和 `<defs>`**

    ```svg
    <!-- ❌ 错误 -->
    <svg>
      <defs>
        <style>.cls-1{fill:#004097}</style>
      </defs>
      <path class="cls-1" d="..."/>
    </svg>

    <!-- ✅ 正确 -->
    <svg>
      <path fill="currentColor" d="..."/>
    </svg>
    ```

### ❌ DON'T - 错误做法

1. **不要使用固定颜色**

    ```svg
    <!-- ❌ 错误 -->
    <path fill="#004097" d="..."/>
    <circle fill="rgb(236, 28, 36)" cx="50" cy="50" r="20"/>
    ```

2. **不要使用 CSS 类名**
    ```svg
    <!-- ❌ 错误 -->
    <style>.cls-1{fill:#004097}</style>
    <path class="cls-1" d="..."/>
    ```

### 🎯 Logo 添加位置

在 `cdn-server-info.user.js` 的 `cdnIcons` 对象中（约第 822 行）:

```javascript
const cdnIcons = {
    Cloudflare: `<svg>...</svg>`,
    Akamai: `<svg>...</svg>`,
    'Your CDN': `<svg>...</svg>`, // 添加在这里
};
```

---

## 🔍 缓存状态检测规则

### 添加新的缓存头

在 `getCacheStatus` 函数的 `headersToCheck` 数组中添加（约第 66 行）:

```javascript
const headersToCheck = [
    h.get('eo-cache-status'), // 优先检查特定头
    h.get('hascache'), // Kestrel
    h.get('x-cache'), // 通用头放后面
    // ... 其他头
];
```

**原则**:

- ✅ 特定的、独特的头放在**前面**
- ✅ 通用的头放在**后面**
- ✅ 检测逻辑会自动提取 HIT/MISS/BYPASS/DYNAMIC

---

## 🐛 常见错误与修复

### 错误 1: 误识别问题

**症状**: CDN A 被识别成 CDN B

**原因**: 使用了通用头

**修复**:

1. 检查两个 CDN 的 `headers` 配置
2. 移除通用头，只保留专有头
3. 如果必须用通用头，添加值匹配

### 错误 2: Logo 颜色不适配主题

**症状**: Logo 在深色/浅色主题下不可见

**原因**: 使用了固定颜色而不是 `currentColor`

**修复**:

1. 将所有 `fill="#xxx"` 改为 `fill="currentColor"`
2. 移除 `<defs><style>` 部分
3. 使用 `fill-opacity` 保持层次

### 错误 3: 优先级调整无效

**症状**: 调整了优先级但仍然误识别

**原因**: 优先级不能解决头冲突

**修复**:

1. **不要**通过调整优先级解决冲突
2. 修改规则，使用更精确的头
3. 添加值匹配或正则模式

---

## 📝 版本更新规范

### 版本号规则

- **Major (x.0.0)**: 重大架构变更
- **Minor (7.x.0)**: 新功能、新 CDN 支持
- **Patch (7.27.x)**: Bug 修复、小优化

### 更新位置

需要同时更新 3 个地方:

1. **`cdn-server-info.user.js`** (第 5-7 行):

    ```javascript
    // @version      7.27.0
    // @description  [v7.27.0] 更新说明
    ```

2. **`cdn-server-info.user.js`** (第 17 行):

    ```javascript
    // @resource     cdn_rules https://...?v=7.27.0
    ```

3. **版本说明**: 简洁描述主要变更

---

## 🔧 自定义处理器规则

### 何时需要自定义处理器

当 CDN 的缓存状态或 POP 提取逻辑**无法用通用规则处理**时:

```javascript
const customHandlers = {
    'SwiftServe CDN': {
        getInfo: (h, rule) => {
            // 从 "HIT from da010.vn17.swiftserve.com" 提取
            const xCache = h.get('x-cache');
            const match = xCache.match(/from\s+([a-z0-9]+)\.([a-z0-9]+)\.swiftserve\.com/i);
            const pop = match ? match[2].toUpperCase() : 'N/A';

            return {
                provider: 'SwiftServe CDN',
                cache: getCacheStatus(h),
                pop: pop,
                extra: 'Detected via x-cache header',
            };
        },
    },
};
```

### 何时不需要

如果只是简单的头匹配，用 JSON 规则就够了:

```json
{
    "Simple CDN": {
        "headers": {
            "x-simple-cdn": null
        },
        "pop_header": "x-cdn-pop",
        "id_header": "x-request-id"
    }
}
```

---

## 📚 修改前必读清单

在修改代码前，**必须**检查:

- [ ] 是否查看了 `cdn_rules.json` 中已有的规则？
- [ ] 新增的头是否是 CDN 专有的？
- [ ] 是否避免了使用通用头（`x-request-id`, `cache`, `x-id`）？
- [ ] 如果使用通用头，是否添加了值匹配？
- [ ] Logo 是否使用了 `fill="currentColor"`？
- [ ] 是否移除了 Logo 中的固定颜色和 CSS 类？
- [ ] 是否同时更新了版本号的 3 个位置？
- [ ] 是否理解优先级不能解决头冲突？

---

## 🎓 学习资源

### 理解项目结构

1. **`cdn_rules.json`**: CDN 检测规则（JSON 配置）
2. **`customHandlers`**: 复杂逻辑处理器（JavaScript）
3. **`cdnIcons`**: CDN Logo SVG（JavaScript 对象）
4. **`getCacheStatus`**: 缓存状态检测函数

### 调试技巧

1. 查看浏览器控制台的 Network 标签
2. 检查响应头中的特征字段
3. 在 `parseInfo` 函数中添加 `console.log` 调试
4. 测试多个使用该 CDN 的网站

---

## ⚠️ 特别注意

1. **永远不要**假设一个头是独特的，先搜索 `cdn_rules.json` 确认
2. **永远不要**通过提高优先级来"修复"误识别
3. **永远不要**在 Logo SVG 中使用固定颜色
4. **永远记住**：精确的规则 > 优先级调整

---

_最后更新: 2025-12-19_
_版本: v7.27.0_
