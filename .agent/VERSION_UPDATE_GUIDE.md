# 版本更新快速指南

## 🚀 快速使用

### 方式一: 自动递增版本号 (推荐)

```bash
# 补丁版本 (bug修复): 7.54.0 → 7.54.1
node .agent/workflows/scripts/update-version.js patch

# 次版本 (新功能): 7.54.0 → 7.55.0
node .agent/workflows/scripts/update-version.js minor

# 主版本 (重大更新): 7.54.0 → 8.0.0
node .agent/workflows/scripts/update-version.js major
```

### 方式二: 指定具体版本号

```bash
# 指定版本号
node .agent/workflows/scripts/update-version.js 7.55.0
```

## 📋 完整提交流程

```bash
# 1. 更新版本号 (选择合适的类型)
node .agent/workflows/scripts/update-version.js minor

# 2. 检查更改
git diff

# 3. 运行代码检查
npm run lint

# 4. 暂存所有更改
git add .

# 5. 提交 (版本号会自动填入提示)
git commit -m "chore: bump version to 7.55.0"

# 6. 推送到远程仓库
git push
```

## 🎯 语义化版本规范

- **主版本号 (Major)**: 不兼容的 API 修改
    - 例如: 重大架构调整、删除功能
- **次版本号 (Minor)**: 向下兼容的功能性新增
    - 例如: 新增 CDN 支持、新增配置选项
- **修订号 (Patch)**: 向下兼容的问题修正
    - 例如: bug修复、性能优化、文档更新

## 📝 自动更新的内容

脚本会自动更新以下位置:

1. ✅ `package.json` → `"version": "x.y.z"`
2. ✅ `cdn-server-info.user.js` → `// @version x.y.z`
3. ✅ `cdn-server-info.user.js` → `// @description [vx.y.z] ...`
4. ✅ `cdn-server-info.user.js` → `// @resource ... ?v=x.y.z`

## ⚠️ 注意事项

- 版本号必须遵循 `x.y.z` 格式
- 提交前务必运行 `npm run lint` 检查代码质量
- 推荐使用自动递增方式,避免手动输入错误
