#!/usr/bin/env node

/**
 * 版本号自动更新脚本
 * 用于同步更新 package.json 和 cdn-server-info.user.js 中的版本号
 */

const fs = require('fs');
const path = require('path');

// 文件路径
const PROJECT_ROOT = path.join(__dirname, '../../..');
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');
const USERSCRIPT_PATH = path.join(PROJECT_ROOT, 'cdn-server-info.user.js');

// ANSI 颜色代码
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
};

/**
 * 打印彩色消息
 */
function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 验证版本号格式
 */
function isValidVersion(version) {
    return /^\d+\.\d+\.\d+$/.test(version);
}

/**
 * 解析版本号
 */
function parseVersion(version) {
    const [major, minor, patch] = version.split('.').map(Number);
    return { major, minor, patch };
}

/**
 * 递增版本号
 */
function incrementVersion(currentVersion, type) {
    const { major, minor, patch } = parseVersion(currentVersion);

    switch (type) {
        case 'major':
            return `${major + 1}.0.0`;
        case 'minor':
            return `${major}.${minor + 1}.0`;
        case 'patch':
            return `${major}.${minor}.${patch + 1}`;
        default:
            throw new Error(`未知的版本类型: ${type}`);
    }
}

/**
 * 获取当前版本号
 */
function getCurrentVersions() {
    // 从 package.json 读取
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    const packageVersion = packageJson.version;

    // 从 userscript 读取
    const userscriptContent = fs.readFileSync(USERSCRIPT_PATH, 'utf8');
    const versionMatch = userscriptContent.match(/@version\s+(\d+\.\d+\.\d+)/);
    const userscriptVersion = versionMatch ? versionMatch[1] : null;

    return { packageVersion, userscriptVersion };
}

/**
 * 更新 package.json 中的版本号
 */
function updatePackageJson(newVersion) {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
    const oldVersion = packageJson.version;
    packageJson.version = newVersion;

    fs.writeFileSync(
        PACKAGE_JSON_PATH,
        JSON.stringify(packageJson, null, 4) + '\n',
        'utf8'
    );

    log(`✓ package.json: ${oldVersion} → ${newVersion}`, 'green');
}

/**
 * 更新 userscript 中的版本号
 */
function updateUserscript(newVersion) {
    let content = fs.readFileSync(USERSCRIPT_PATH, 'utf8');
    const lines = content.split('\n');
    let updatedCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 更新 @version
        if (line.includes('@version')) {
            const oldVersionMatch = line.match(/(\d+\.\d+\.\d+)/);
            if (oldVersionMatch) {
                lines[i] = line.replace(/\d+\.\d+\.\d+/, newVersion);
                updatedCount++;
                log(`  - @version: ${oldVersionMatch[1]} → ${newVersion}`, 'cyan');
            }
        }

        // 更新 @description 中的版本引用
        if (line.includes('@description') && line.includes('[v')) {
            const oldVersionMatch = line.match(/\[v(\d+\.\d+\.\d+)\]/);
            if (oldVersionMatch) {
                lines[i] = line.replace(/\[v\d+\.\d+\.\d+\]/, `[v${newVersion}]`);
                updatedCount++;
                log(`  - @description: [v${oldVersionMatch[1]}] → [v${newVersion}]`, 'cyan');
            }
        }

        // 更新 @resource 中的版本参数
        if (line.includes('@resource') && line.includes('?v=')) {
            const oldVersionMatch = line.match(/\?v=(\d+\.\d+\.\d+)/);
            if (oldVersionMatch) {
                lines[i] = line.replace(/\?v=\d+\.\d+\.\d+/, `?v=${newVersion}`);
                updatedCount++;
                log(`  - @resource: ?v=${oldVersionMatch[1]} → ?v=${newVersion}`, 'cyan');
            }
        }
    }

    fs.writeFileSync(USERSCRIPT_PATH, lines.join('\n'), 'utf8');
    log(`✓ cdn-server-info.user.js: 已更新 ${updatedCount} 处`, 'green');
}

/**
 * 主函数
 */
function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        log('错误: 请提供版本号或版本类型 (major/minor/patch)', 'red');
        log('\n使用方法:', 'yellow');
        log('  node update-version.js 7.55.0', 'cyan');
        log('  node update-version.js patch', 'cyan');
        log('  node update-version.js minor', 'cyan');
        log('  node update-version.js major', 'cyan');
        process.exit(1);
    }

    const input = args[0];
    const { packageVersion, userscriptVersion } = getCurrentVersions();

    log('\n当前版本号:', 'bright');
    log(`  package.json: ${packageVersion}`, 'yellow');
    log(`  userscript:   ${userscriptVersion}`, 'yellow');

    // 确定新版本号
    let newVersion;
    if (['major', 'minor', 'patch'].includes(input)) {
        // 使用 userscript 的版本作为基准 (因为它是实际发布的版本)
        const baseVersion = userscriptVersion || packageVersion;
        newVersion = incrementVersion(baseVersion, input);
        log(`\n递增类型: ${input}`, 'cyan');
    } else if (isValidVersion(input)) {
        newVersion = input;
    } else {
        log(`\n错误: 无效的版本号格式 "${input}"`, 'red');
        log('版本号必须符合 x.y.z 格式 (例如: 7.55.0)', 'yellow');
        process.exit(1);
    }

    log(`\n新版本号: ${newVersion}`, 'bright');
    log('\n开始更新...', 'cyan');

    try {
        // 更新文件
        updatePackageJson(newVersion);
        updateUserscript(newVersion);

        log('\n✓ 版本号更新完成!', 'green');
        log('\n下一步:', 'yellow');
        log('  1. 检查更改: git diff', 'cyan');
        log('  2. 运行测试: npm run lint', 'cyan');
        log(`  3. 提交更改: git commit -m "chore: bump version to ${newVersion}"`, 'cyan');
        log('  4. 推送代码: git push', 'cyan');
    } catch (error) {
        log(`\n错误: ${error.message}`, 'red');
        process.exit(1);
    }
}

// 运行主函数
main();
