# 快速参考 - CDN Server Info 项目

## 🚨 修改前必查

### 添加新 CDN 检测规则

```json
// ✅ 正确 - 使用专有头
{
  "Cloudflare": {
    "headers": {
      "cf-ray": null              // CDN 专有头
    }
  }
}

// ✅ 正确 - 通用头 + 值匹配
{
  "SwiftServe": {
    "headers": {
      "x-cache": "swiftserve"     // 匹配特定值
    }
  }
}

// ❌ 错误 - 使用超级通用头
{
  "Bad CDN": {
    "headers": {
      "x-request-id": null,       // ❌ 所有服务器都有
      "cache": null               // ❌ 太通用
    }
  }
}
```

### 禁用头列表

**永远不要单独使用这些头**:

- `x-request-id`
- `cache`
- `x-id`
- `x-cache` (除非有值匹配)

---

## 🎨 添加 CDN Logo

```javascript
// ✅ 正确
'CDN Name': `<svg viewBox="0 0 100 100">
  <path fill="currentColor" d="..."/>
  <circle fill="currentColor" fill-opacity="0.7" cx="50" cy="50" r="20"/>
</svg>`

// ❌ 错误
'CDN Name': `<svg>
  <defs><style>.cls-1{fill:#004097}</style></defs>
  <path class="cls-1" d="..."/>
  <path fill="#FF0000" d="..."/>
</svg>`
```

**规则**:

1. 使用 `fill="currentColor"`
2. 移除所有固定颜色
3. 移除 `<defs>` 和 `<style>`
4. 使用 `fill-opacity` 保持层次

---

## 🔧 版本更新

**版本号由脚本统一同步**:

1. Line 5-7: `// @version 7.57.0`
2. Line 17: `?v=7.57.0`
3. 描述信息
4. `package.json` / `package-lock.json`
5. README 版本徽章

```bash
npm run version:minor
npm run release:check
```

---

## ⚠️ 常见错误

| 错误        | 原因       | 修复                 |
| ----------- | ---------- | -------------------- |
| 误识别      | 使用通用头 | 改用专有头或值匹配   |
| Logo 不显示 | 固定颜色   | 改用 `currentColor`  |
| 优先级无效  | 头冲突     | 修改规则，不是优先级 |

---

## 📋 检查清单

- [ ] 头是否专有？
- [ ] 避免了通用头？
- [ ] Logo 用了 `currentColor`？
- [ ] 运行了 `npm run release:check`？
- [ ] 理解优先级不能解决冲突？
