---
description: 版本号更新工作流 - 在提交前自动更新版本号
---

# 版本号更新工作流

此工作流用于在提交代码前更新项目版本号,确保 `package.json` 和 `cdn-server-info.user.js` 中的版本号保持一致。

## 使用方法

在准备提交代码时,运行此工作流来更新版本号。

## 工作流步骤

### 1. 查看当前版本号

首先查看两个文件中的当前版本号:

```bash
# 查看 package.json 中的版本
grep '"version"' package.json

# 查看 userscript 中的版本
grep '@version' cdn-server-info.user.js
```

### 2. 确定新版本号

根据语义化版本规范 (Semantic Versioning) 确定新版本号:
- **主版本号 (Major)**: 不兼容的 API 修改
- **次版本号 (Minor)**: 向下兼容的功能性新增
- **修订号 (Patch)**: 向下兼容的问题修正

例如: `7.54.0` → `7.55.0` (新功能) 或 `7.54.1` (bug修复)

### 3. 运行版本更新脚本

// turbo
```bash
node .agent/workflows/scripts/update-version.js <新版本号>
```

例如:
```bash
node .agent/workflows/scripts/update-version.js 7.55.0
```

### 4. 验证更新结果

// turbo
```bash
# 验证两个文件的版本号已更新
grep '"version"' package.json
grep '@version' cdn-server-info.user.js
grep '@resource' cdn-server-info.user.js
```

### 5. 提交更改

```bash
git add .
git commit -m "chore: bump version to <新版本号>"
git push
```

## 注意事项

1. **版本号格式**: 必须遵循 `x.y.z` 格式 (例如: `7.55.0`)
2. **同步更新**: 脚本会自动更新以下位置的版本号:
   - `package.json` 中的 `version` 字段
   - `cdn-server-info.user.js` 中的 `@version` 标签
   - `cdn-server-info.user.js` 中的 `@description` 和 `@description:en` (版本号引用)
   - `cdn-server-info.user.js` 中的 `@resource` URL 参数
3. **提交前检查**: 建议在提交前运行 `npm run lint` 确保代码质量

## 快速命令

如果只想快速更新补丁版本 (patch):

```bash
# 自动递增补丁版本号
node .agent/workflows/scripts/update-version.js patch
```

如果想更新次版本号 (minor):

```bash
# 自动递增次版本号
node .agent/workflows/scripts/update-version.js minor
```

如果想更新主版本号 (major):

```bash
# 自动递增主版本号
node .agent/workflows/scripts/update-version.js major
```
