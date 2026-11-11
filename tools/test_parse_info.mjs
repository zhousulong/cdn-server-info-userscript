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
    createLatency,
    formatLatency,
    formatProtocol,
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

check('Alibaba preserves the reported numeric edge node code', () => {
    const result = parse({
        eagleid: '3ad80e2617943607821885547e',
        server: 'Tengine',
        via: 'cache18.cn3842[4,0]',
        'x-cache': 'MISS TCP_MISS',
    });
    assert.equal(result.provider, 'Alibaba Cloud CDN');
    assert.equal(result.pop, 'CN3842');
    assert.equal(result.popKind, 'node-code');
});

check('Alibaba preserves multi-layer and numeric node suffixes', () => {
    const result = parse({
        eagleid: 'test',
        via: 'cache53.l2ea120-5[57,57,200-0,M], cache19.l2ea120-5[59,0], ens-cache11.cn9604[96,95,200-0,M], ens-cache15.cn9604[98,0]',
    });
    assert.equal(result.pop, 'CN9604');
});

check('Alibaba does not invent a POP from unrelated Via formats', () => {
    const result = parse({ eagleid: 'test', via: '1.1 example.proxy' });
    assert.equal(result.pop, 'N/A');
});

check('Tencent does not confuse a request UUID with a POP', () => {
    const result = parse({
        'eo-cache-status': 'HIT',
        'eo-log-uuid': '8905593979387011449',
    });
    assert.equal(result.provider, 'Tencent Cloud CDN');
    assert.equal(result.pop, 'N/A');
});

check('ByteDance parses its city-bearing Via node code', () => {
    const result = parse({
        'x-tt-trace-tag': 'id=03;cdn-cache=hit;type=static',
        via: 'cache17.jswuxi-ct32[0,0]',
    });
    assert.equal(result.provider, 'ByteDance CDN');
    assert.equal(result.pop, 'JSWUXI');
    assert.equal(result.popKind, 'node-code');
});

check('ByteDance retains opaque numeric node IDs', () => {
    const result = parse({
        'x-tt-trace-tag': 'id=03;cdn-cache=miss;type=dyn',
        via: 'live4.cn7594[899,0]',
    });
    assert.equal(result.pop, 'CN7594');
});

check('Baidu exposes the reported cache node', () => {
    const result = parse({
        'x-logserver': 'yunjiasu-nginx',
        'ohc-cache-hit': '1 from bjct3',
    });
    assert.equal(result.provider, 'Baidu Cloud CDN');
    assert.equal(result.pop, 'BJCT3');
});

check('Huawei matches lowercase Via node codes', () => {
    const result = parse({
        'dl-from': 'HWCDN',
        via: 'HCDN-hdzj1',
    });
    assert.equal(result.provider, 'Huawei Cloud CDN');
    assert.equal(result.pop, 'HD-ZJ');
});

check('UpYun parses the documented Via node format', () => {
    const result = parse({
        server: 'marco/2.9',
        'x-upyun-width': '100',
        via: 'T.200.M, V.mix-hb-wuxi-084, T.61.1',
    });
    assert.equal(result.provider, 'UpYun');
    assert.equal(result.pop, 'MIX-HB-WUXI-084');
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

check('Latency reports HTTP TTFB without claiming ICMP ping', () => {
    const result = createLatency(100, 135.6);
    assert.equal(result.value, '36 ms');
    assert.equal(result.ttfbMs, 36);
    assert.equal(result.method, 'HEAD');
    assert.equal(result.networkMs, null);
});

check('GET fallback records its own request and network timing', () => {
    const result = createLatency(500, 1780, 'GET', 1200.4);
    assert.equal(result.value, '1.28 s');
    assert.equal(result.method, 'GET');
    assert.equal(result.networkMs, 1200);
});

check('Invalid latency stays unavailable', () => {
    assert.equal(formatLatency(null), 'N/A');
    assert.equal(formatLatency(-1), 'N/A');
    assert.equal(formatLatency(Infinity), 'N/A');
});

check('Protocol names are normalized for display', () => {
    assert.equal(formatProtocol('h2'), 'HTTP/2');
    assert.equal(formatProtocol('h3'), 'HTTP/3');
    assert.equal(formatProtocol('http/1.1'), 'HTTP/1.1');
    assert.equal(formatProtocol(''), null);
    assert.equal(formatProtocol(null), null);
});

console.log(`detection checks: ${checks}`);
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
