#!/usr/bin/env node
// Regression tests for response parsing, cache semantics and provider roles.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const rulesPath = new URL('../cdn_rules.json', import.meta.url);

globalThis.GM_getResourceText = (name) => {
    if (name !== 'cdn_rules') throw new Error(`Unexpected resource: ${name}`);
    return fs.readFileSync(rulesPath, 'utf8');
};

const {
    parseInfo,
    getCacheStatus,
    getProviderRole,
    escapeHtml,
    loadRules,
} = require('../cdn-server-info.user.js');

loadRules();

function makeHeaders(values = {}) {
    const map = new Map(
        Object.entries(values).map(([name, value]) => [name.toLowerCase(), String(value)])
    );
    return {
        get(name) {
            return map.get(name.toLowerCase()) ?? null;
        },
        entries() {
            return map.entries();
        },
    };
}

function makeResponse(values = {}, url = 'https://example.com/') {
    return { url, headers: makeHeaders(values) };
}

function parse(values, url) {
    const originalLog = console.log;
    console.log = () => {};
    try {
        return parseInfo(makeResponse(values, url));
    } finally {
        console.log = originalLog;
    }
}

let failures = 0;
let checks = 0;

function check(name, callback) {
    checks++;
    try {
        callback();
    } catch (error) {
        failures++;
        console.error(`FAIL ${name}: ${error.message}`);
    }
}

check('Cloudflare headers and POP', () => {
    const result = parse({
        'cf-cache-status': 'HIT',
        'cf-ray': '8f1234567890-SJC',
    });
    assert.equal(result.provider, 'Cloudflare');
    assert.equal(result.cache, 'HIT');
    assert.equal(result.pop, 'SJC');
});

check('Akamai headers and POP', () => {
    const result = parse({
        server: 'AkamaiGHost',
        'x-ak-cache': 'HIT',
        'x-served-by': 'cache-lga1234-lga',
    });
    assert.equal(result.provider, 'Akamai');
    assert.equal(result.cache, 'HIT');
    assert.equal(result.pop, 'LGA');
    assert.equal(result.server, 'AkamaiGHost');
});

check('Vercel headers and POP', () => {
    const result = parse({
        'x-vercel-id': 'iad1::abc123',
        'x-vercel-cache': 'MISS',
    });
    assert.equal(result.provider, 'Vercel');
    assert.equal(result.cache, 'MISS');
    assert.equal(result.pop, 'IAD');
});

check('Caddy is treated as a web server', () => {
    const result = parse({ server: 'Caddy' });
    assert.equal(result.provider, 'Caddy');
    assert.equal(result.cache, 'N/A');
    assert.equal(getProviderRole(result.provider, result.server), 'WEB SERVER');
});

check('Unknown response falls back safely', () => {
    const result = parse({});
    assert.equal(result.provider, 'Unknown');
    assert.equal(result.cache, 'N/A');
    assert.equal(result.pop, 'N/A');
});

check('NOHIT is not classified as HIT', () => {
    assert.equal(getCacheStatus(makeHeaders({ 'x-cache': 'NOHIT' })), 'N/A');
});

check('STALE is treated as HIT', () => {
    assert.equal(getCacheStatus(makeHeaders({ 'x-cache': 'STALE' })), 'HIT');
});

check('REVALIDATED is treated as MISS', () => {
    assert.equal(getCacheStatus(makeHeaders({ 'x-cache': 'REVALIDATED' })), 'MISS');
});

check('Header values are HTML-escaped', () => {
    assert.equal(
        escapeHtml('<script>alert("x")</script>'),
        '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
});

console.log(`detection checks: ${checks}`);
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
