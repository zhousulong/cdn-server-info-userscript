#!/usr/bin/env node
// Verify that every release-facing version reference points at the same version.
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');

const packageJson = JSON.parse(read('package.json'));
const packageLock = JSON.parse(read('package-lock.json'));
const source = read('cdn-server-info.user.js');
const readme = read('README.md');
const version = packageJson.version;
const failures = [];

function expect(name, condition, detail) {
    if (!condition) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

expect('package.json version', /^\d+\.\d+\.\d+$/.test(version), version);
expect('package-lock.json version', packageLock.version === version, packageLock.version);
expect(
    'package-lock.json root package version',
    packageLock.packages?.['']?.version === version,
    packageLock.packages?.['']?.version
);

const userscriptVersion = source.match(/^\/\/\s*@version\s+(\d+\.\d+\.\d+)\s*$/m)?.[1];
expect('userscript @version', userscriptVersion === version, userscriptVersion);

const resourceVersion = source.match(
    /^\/\/\s*@resource\s+cdn_rules\s+\S+\?v=(\d+\.\d+\.\d+)\s*$/m
)?.[1];
expect('userscript @resource version', resourceVersion === version, resourceVersion);

const descriptionVersions = [
    ...source.matchAll(/^\/\/\s*@description(?::en)?\s+\[v(\d+\.\d+\.\d+)\]/gm),
].map((match) => match[1]);
expect(
    'userscript @description versions',
    descriptionVersions.length === 2 && descriptionVersions.every((value) => value === version),
    descriptionVersions.join(', ')
);

const badge = `badge/version-${version}-blue.svg`;
expect('README version badge', readme.includes(badge));
expect(`README v${version} changelog`, readme.includes(`### v${version} `));

if (failures.length > 0) {
    console.error('Release version check failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
}

console.log(`release version: ${version}`);
console.log('ALL CHECKS PASSED');
