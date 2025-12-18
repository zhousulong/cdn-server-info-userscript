// ==UserScript==
// @name         CDN & Server Info Displayer (UI Overhaul)
// @name:en      CDN & Server Info Displayer (UI Overhaul)
// @namespace    http://tampermonkey.net/
// @version      7.14.3
// @description  [v7.14.3] Reverted design (11px font, 16px padding). Increased value width to prevent truncation.
// @description:en [v7.14.3] Reverted design (11px font, 16px padding). Increased value width to prevent truncation.
// @author       Zhou Sulong
// @license      MIT
// @match        *://*/*
// @downloadURL  https://raw.githubusercontent.com/zhousulong/cdn-server-info-userscript/main/cdn-server-info.user.js
// @updateURL    https://raw.githubusercontent.com/zhousulong/cdn-server-info-userscript/main/cdn-server-info.user.js
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_getResourceText
// @resource     cdn_rules https://raw.githubusercontent.com/zhousulong/cdn-server-info-userscript/main/cdn_rules.json?v=7.14.3
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    // --- Configuration ---
    const config = {
        initialPosition: { bottom: '20px', right: '20px' },
        initial_delay: 2500,
        retry_delay: 7000,
        max_retries: 4,
        excludePatterns: [
            /\/wp-admin/i,
            /\/wp-login\.php/i,
            /(\/|&)pay(pal|ment)/i,
            /\/checkout|\/billing/i,
            /\/login|\/signin|\/auth/i,
            /\/phpmyadmin/i,
            /(\/ads\/|ad_id=|advertisement)/i,
            /doubleclick\.net/i,
        ],
        // Default settings
        settings: {
            theme: 'auto', // 'auto', 'dark' or 'light'
            panelPosition: 'bottom-right', // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
            showExtraInfo: true,
            excludedUrls: [],
        },
        // Initial position for custom placement
        initialPosition: {
            bottom: '20px',
            right: '20px'
        }
    };

    window.cdnScriptStatus = window.cdnScriptStatus || {};

    // --- Core Info Parsing Functions ---
    function getCacheStatus(h) {
        // 1. Check server-timing first as it's often the most accurate
        const serverTiming = h.get('server-timing');
        if (serverTiming) {
            if (serverTiming.includes('cdn-cache; desc=HIT')) return 'HIT';
            if (serverTiming.includes('cdn-cache; desc=MISS')) return 'MISS';
        }

        const headersToCheck = [
            h.get('eo-cache-status'), // Prioritize specific headers
            h.get('x-cache'),
            h.get('x-bdcdn-cache-status'),
            h.get('x-response-cache'),
            h.get('x-qc-cache'),
            h.get('x-cache-lookup'),
            h.get('cache-status'),
            h.get('x-cache-status'),
            h.get('x-edge-cache-status'),
            h.get('x-sucuri-cache'),
            h.get('x-vercel-cache'),
            h.get('cf-cache-status'),
            h.get('cdn-cache'),
            h.get('bunny-cache-state'),
            h.get('x-site-cache-status'),
            h.get('x-litespeed-cache'),
            h.get('x-lsadc-cache'),
        ];
        for (const value of headersToCheck) {
            if (!value) continue;
            const firstValue = value.split(',')[0].trim();
            const upperVal = firstValue.toUpperCase();
            if (upperVal.includes('HIT')) return 'HIT';
            if (upperVal.includes('MISS')) return 'MISS';
            if (upperVal.includes('BYPASS')) return 'BYPASS';
            if (upperVal.includes('DYNAMIC')) return 'DYNAMIC';
        }
        if (parseInt(h.get('age'), 10) > 0) return 'HIT (inferred)';
        return 'N/A';
    }

    // CDN Providers Configuration
    // --- Rule Loading & Custom Handlers ---
    let cdnRules = {};

    // Custom handlers for complex extraction logic that can't be easily JSON-ified
    const customHandlers = {
        'Akamai': {
            getInfo: (h, rule) => {
                let pop = 'N/A';
                const servedBy = h.get('x-served-by');
                if (servedBy) {
                    const match = servedBy.match(/cache-([a-z0-9]+)-/i);
                    if (match && match[1]) pop = match[1].toUpperCase();
                }
                return {
                    provider: 'Akamai',
                    cache: getCacheStatus(h),
                    pop: pop,
                    extra: 'Detected via Akamai header/cookie',
                };
            }
        },
        'Tencent Cloud': { // Updated name
            getInfo: (h, rule) => {
                let cache = 'N/A';
                const eoCache = h.get('eo-cache-status');
                const nwsLookup = h.get('x-cache-lookup');
                if (eoCache) {
                    cache = eoCache.toUpperCase();
                } else if (nwsLookup) {
                    const firstPart = nwsLookup.split(',')[0].trim();
                    cache = firstPart.replace('Cache ', '').toUpperCase();
                } else {
                    cache = getCacheStatus(h);
                }
                const logUuid = h.get('eo-log-uuid') || h.get('x-nws-log-uuid') || 'N/A';
                return {
                    provider: 'Tencent Cloud',
                    cache: cache,
                    pop: 'N/A',
                    extra: `Log-UUID: ${logUuid}`,
                };
            }
        },
        'Kingsoft Cloud': {
            getInfo: (h, rule) => {
                let cache = 'N/A';
                const cacheStatus = h.get('x-cache-status');
                if (cacheStatus) {
                    const match = cacheStatus.match(/^([A-Z]+)\s+from/i);
                    if (match) cache = match[1].toUpperCase();
                }
                if (cache === 'N/A') cache = getCacheStatus(h);

                let pop = 'N/A';
                if (cacheStatus) {
                    // Extract from "KS-CLOUD-YANC-MP-16-05" -> "YANC"
                    const match = cacheStatus.match(/KS-CLOUD-([A-Z]{2,6})-\w+/i);
                    if (match) {
                        pop = match[1].toUpperCase();
                    }
                }

                if (pop === 'N/A') {
                    const via = h.get('x-link-via');
                    if (via) {
                        // Extract from "ntct13:443;yancmp16:80;" -> "NTCT13"
                        const match = via.match(/([^:;]+):/);
                        if (match) pop = match[1].toUpperCase();
                    }
                }

                const requestId = h.get('x-cdn-request-id') || h.get('x-kss-request-id') || 'N/A';

                return {
                    provider: 'Kingsoft Cloud',
                    cache: cache,
                    pop: pop,
                    extra: `Req-ID: ${requestId}`,
                };
            }
        },
        'Gcore': {
            getInfo: (h, rule) => {
                let cache = h.get('cache') || 'N/A';
                if (cache === 'N/A') cache = getCacheStatus(h);
                else cache = cache.toUpperCase();

                const traceparent = h.get('traceparent') || h.get('x-id') || 'N/A';

                return {
                    provider: 'Gcore',
                    cache: cache,
                    pop: 'N/A',
                    extra: `ID: ${traceparent.split('-')[1] || traceparent}`,
                };
            }
        },
        'BytePlus CDN': {
            getInfo: (h, rule) => {
                let cache = 'N/A';
                // Parse from server-timing: cdn-cache;desc=miss
                const serverTiming = h.get('server-timing');
                if (serverTiming) {
                    const match = serverTiming.match(/cdn-cache;desc=([^,]+)/);
                    if (match) cache = match[1].toUpperCase();
                }
                if (cache === 'N/A') cache = getCacheStatus(h);

                // BytePlus CDN doesn't have standard airport codes, skip POP
                let pop = 'N/A';

                const requestId = h.get('x-cdn-request-id') || h.get('x-tt-trace-id') || 'N/A';

                return {
                    provider: 'BytePlus CDN',
                    cache: cache,
                    pop: pop,
                    extra: `Req-ID: ${requestId}`,
                };
            }
        },
        'CDNetworks (ChinaNetCenter)': {
            getInfo: (h, rule) => {
                let cache = getCacheStatus(h);

                let pop = 'N/A';
                const via = h.get('via') || h.get('x-via');
                if (via) {
                    // Extract from "1.1 PS-NTG-010GD53:6" -> "NTG"
                    const match = via.match(/PS-([A-Z0-9]{3})-/);
                    if (match) {
                        pop = match[1].toUpperCase();
                    }
                }

                // If not found in via, try x-px header or x-ws-request-id
                if (pop === 'N/A') {
                    const altHeaders = [h.get('x-px'), h.get('x-ws-request-id')];
                    for (const val of altHeaders) {
                        if (val) {
                            const match = val.match(/PS-([A-Z0-9]{3})-/);
                            if (match) {
                                pop = match[1].toUpperCase();
                                break;
                            }
                        }
                    }
                }

                const requestId = h.get('x-ws-request-id') || 'N/A';

                return {
                    provider: 'CDNetworks (ChinaNetCenter)',
                    cache: cache,
                    pop: pop,
                    extra: `Req-ID: ${requestId}`,
                };
            }
        },
        'State Cloud': {
            getInfo: (h, rule) => {
                let cache = 'N/A';
                const ctlStatus = h.get('ctl-cache-status');
                if (ctlStatus) {
                    const match = ctlStatus.match(/^(HIT|MISS|EXPIRED|UPDATING)/i);
                    if (match) cache = match[0].toUpperCase();
                }
                if (cache === 'N/A') cache = getCacheStatus(h);

                let pop = 'N/A';
                if (ctlStatus) {
                    // Extract from "HIT from zj-wenzhou8-ca08" -> "ZJ-WENZHOU"
                    const match = ctlStatus.match(/from ([a-z0-9-]+)/i);
                    if (match) {
                        const parts = match[1].split('-');
                        pop = (parts[0] + (parts[1] ? '-' + parts[1].replace(/\d+$/, '') : '')).toUpperCase();
                    }
                }

                const requestId = h.get('x-ct-request-id') || h.get('request-id') || 'N/A';

                return {
                    provider: 'State Cloud',
                    cache: cache,
                    pop: pop,
                    extra: `Req-ID: ${requestId}`,
                };
            }
        },
        'Adobe Experience Manager (AEM)': {
            getInfo: (h, rule) => {
                let cache = getCacheStatus(h);
                let pop = 'N/A';
                const dispatcher = h.get('x-dispatcher');
                if (dispatcher) {
                    // Extract region like "euwest1" from "dispatcher2euwest1-b80"
                    const match = dispatcher.match(/dispatcher\d+([a-z0-9]+)-/i);
                    if (match) pop = match[1].toUpperCase();
                }
                const vhost = h.get('x-vhost') || 'N/A';
                return {
                    provider: 'Adobe Experience Manager (AEM)',
                    cache: cache,
                    pop: pop,
                    extra: `Vhost: ${vhost}`,
                };
            }
        },
        'Huawei Cloud': {
            getInfo: (h, rule) => {
                let cache = 'N/A';
                if (h.get('nginx-hit') === '1' || h.get('ohc-cache-hit') === 'HIT') cache = 'HIT';
                if (cache === 'N/A') cache = getCacheStatus(h);

                let pop = 'N/A';
                const via = h.get('via');
                if (via) {
                    // Extract from "CHN-JSyangzhou-CT3" -> JSyangzhou -> "JS-YANGZHOU"
                    // Extract from "CHN-SH-GLOBAL" -> SH -> "SH"
                    const match = via.match(/CHN-([a-zA-Z0-9]+)/);
                    if (match) {
                        const loc = match[1];
                        // If compound name like JSyangzhou -> JS-YANGZHOU
                        const compound = loc.match(/^([A-Z]{2})([a-z]+)/);
                        if (compound) {
                            pop = (compound[1] + '-' + compound[2]).toUpperCase();
                        } else {
                            pop = loc.toUpperCase();
                        }
                    }
                }

                const requestId = h.get('x-obs-request-id') || 'N/A';

                return {
                    provider: 'Huawei Cloud',
                    cache: cache,
                    pop: pop,
                    extra: `Req-ID: ${requestId}`,
                };
            }
        },
        'ByteDance CDN': {
            getInfo: (h, rule) => {
                let cache = 'N/A';
                // Parse from server-timing: cdn-cache;desc=MISS
                const serverTiming = h.get('server-timing');
                if (serverTiming) {
                    const match = serverTiming.match(/cdn-cache;desc=([^,]+)/);
                    if (match) cache = match[1].toUpperCase();
                }
                if (cache === 'N/A') {
                    const ttTrace = h.get('x-tt-trace-tag');
                    if (ttTrace) {
                        const match = ttTrace.match(/cdn-cache=([^;]+)/);
                        if (match) cache = match[1].toUpperCase();
                    }
                }
                if (cache === 'N/A') cache = getCacheStatus(h);

                let pop = 'N/A';
                // Extract from via: "live4.cn7594[899,0]" or "ens-live7.cn8685" -> "CN"
                const viaHeader = h.get('via');
                if (viaHeader) {
                    const match = viaHeader.match(/(?:ens-)?live\d+\.(cn\d+)/i);
                    if (match && match[1]) {
                        pop = 'CN'; // Simplified, just show CN for China
                    }
                }

                const traceId = h.get('x-tt-trace-id') || h.get('x-tt-logid') || h.get('eagleid') || 'N/A';

                return {
                    provider: 'ByteDance CDN',
                    cache: cache,
                    pop: pop,
                    extra: `Trace-ID: ${traceId}`,
                };
            }
        },
        'Netlify': {
            getInfo: (h, rule) => {
                let pop = 'N/A';
                const serverTiming = h.get('server-timing');
                if (serverTiming) {
                    const match = serverTiming.match(/dc;desc="?([^",]+)"?/);
                    if (match && match[1]) {
                        pop = match[1].toUpperCase();
                    }
                }
                return {
                    provider: 'Netlify',
                    cache: getCacheStatus(h),
                    pop: pop,
                    extra: `Req-ID: ${h.get('x-nf-request-id') || 'N/A'}`,
                };
            }
        },
        'BunnyCDN': {
            getInfo: (h, rule) => {
                let cache = 'N/A';
                const cdnCache = h.get('cdn-cache');
                if (cdnCache) {
                    cache = cdnCache.toUpperCase();
                } else {
                    cache = getCacheStatus(h);
                }

                let pop = 'N/A';
                const server = h.get('server');
                if (server) {
                    // Extract POP from server header like "BunnyCDN-LA1-912" -> "LA1"
                    const match = server.match(/BunnyCDN-([A-Z0-9]+)-/i);
                    if (match && match[1]) {
                        pop = match[1].toUpperCase();
                    }
                }

                const requestId = h.get('cdn-requestid') || 'N/A';

                return {
                    provider: 'BunnyCDN',
                    cache: cache,
                    pop: pop,
                    extra: `Req-ID: ${requestId}`,
                };
            }
        },
        'Medianova': {
            getInfo: (h, rule) => {
                let cache = 'N/A';
                const cacheStatus = h.get('x-cache-status');
                if (cacheStatus) {
                    // Parse format like "Edge : HIT," or "Edge : MISS,"
                    const match = cacheStatus.match(/Edge\s*:\s*([A-Z]+)/i);
                    if (match && match[1]) {
                        cache = match[1].toUpperCase();
                    }
                } else {
                    cache = getCacheStatus(h);
                }

                let pop = 'N/A';
                const edgeLocation = h.get('x-edge-location');
                if (edgeLocation) {
                    // Extract POP from format like "SG-378" -> "SG"
                    const match = edgeLocation.match(/^([A-Z]{2,3})-/i);
                    if (match && match[1]) {
                        pop = match[1].toUpperCase();
                    }
                }

                const requestId = h.get('x-mnrequest-id') || 'N/A';

                return {
                    provider: 'Medianova',
                    cache: cache,
                    pop: pop,
                    extra: `Req-ID: ${requestId}`,
                };
            }
        },
        'CacheFly': {
            getInfo: (h, rule) => {
                let cache = 'N/A';
                // x-cf3: H = HIT, M = MISS
                const cf3 = h.get('x-cf3');
                if (cf3) {
                    if (cf3.toUpperCase() === 'H') {
                        cache = 'HIT';
                    } else if (cf3.toUpperCase() === 'M') {
                        cache = 'MISS';
                    }
                } else {
                    cache = getCacheStatus(h);
                }

                let pop = 'N/A';
                const cf1 = h.get('x-cf1');
                if (cf1) {
                    // Extract POP from format like "28787:fP.tko2:co:1765918716:cacheN.tko2-01:M"
                    // Looking for pattern like "tko2" or "cache location"
                    const match = cf1.match(/\.([a-z]{3,4}\d*)[:\-\.]/i);
                    if (match && match[1]) {
                        pop = match[1].toUpperCase();
                    }
                }

                const requestId = h.get('x-cf-reqid') || 'N/A';
                const age = h.get('cf4age') || 'N/A';

                return {
                    provider: 'CacheFly',
                    cache: cache,
                    pop: pop,
                    extra: `Req-ID: ${requestId}, Age: ${age}s`,
                };
            }
        }
    };

    function loadRules() {
        try {
            const rulesText = GM_getResourceText('cdn_rules');
            if (rulesText) {
                cdnRules = JSON.parse(rulesText);
                console.log('[CDN Info] Loaded rules from resource');
            } else {
                console.warn('[CDN Info] No cdn_rules resource found');
            }
        } catch (e) {
            console.error('[CDN Info] Failed to load rules:', e);
        }
    }

    // Generic Info Extractor
    function genericGetInfo(h, rule, providerName) {
        let pop = 'N/A';
        if (rule.pop_header) {
            const val = h.get(rule.pop_header);
            if (val) {
                if (rule.pop_regex) {
                    const match = val.match(new RegExp(rule.pop_regex, 'i'));
                    if (match && match[1]) pop = match[1].toUpperCase();
                } else {
                    // Default heuristic - extract airport code from value
                    // First try to match letters at the start
                    const letterMatch = val.trim().match(/^([A-Z]+)/i);
                    if (letterMatch && letterMatch[1].length >= 3) {
                        // If we have 3+ letters at start, use first 3-4
                        pop = letterMatch[1].substring(0, Math.min(4, letterMatch[1].length)).toUpperCase();
                    } else {
                        // For hyphenated formats like "AS-JP-HND-HYBRID", find the 3-4 letter part
                        const parts = val.trim().split(/[-_]/);
                        for (const part of parts) {
                            const partMatch = part.match(/^([A-Z]+)$/i);
                            if (partMatch && partMatch[1].length >= 3 && partMatch[1].length <= 4) {
                                pop = partMatch[1].toUpperCase();
                                break;
                            }
                        }
                        // If still not found, use first part
                        if (pop === 'N/A' && parts.length > 0) {
                            pop = parts[0].toUpperCase();
                        }
                    }
                }
            }
        }

        let extra = 'N/A';
        if (rule.id_header) {
            extra = `${rule.id_header}: ${h.get(rule.id_header) || 'N/A'}`;
        }

        return {
            provider: providerName,
            cache: getCacheStatus(h),
            pop: pop,
            extra: extra
        };
    }

    // --- Extended Information Functions ---
    function getServerInfo(h) {
        const server = h.get('server');
        if (!server) return 'N/A';

        // Clean up server string
        return server.split(';')[0].trim(); // Remove additional info after semicolon
    }

    function getConnectionInfo(response) {
        // Get TLS version from response if available
        // Note: This is not directly available in fetch API, but we can infer from other headers
        const protocol = response.url.startsWith('https') ? 'HTTPS' : 'HTTP';
        return protocol;
    }

    function getAdditionalInfo(h) {
        // Get content type
        const contentType = h.get('content-type');
        if (!contentType) return '';

        // Extract just the MIME type
        const mimeType = contentType.split(';')[0].trim();
        return `Type: ${mimeType}`;
    }

    // Enhanced parseInfo function to include extended information
    function parseInfo(response) {
        if (Object.keys(cdnRules).length === 0) loadRules();

        const h = response.headers;
        const lowerCaseHeaders = new Map();
        for (const [key, value] of h.entries()) {
            lowerCaseHeaders.set(key.toLowerCase(), value);
        }
        const detectedProviders = [];

        for (const [name, rule] of Object.entries(cdnRules)) {
            let isMatch = false;

            // Header Check
            if (rule.headers) {
                for (const [header, val] of Object.entries(rule.headers)) {
                    if (lowerCaseHeaders.has(header)) {
                        if (val === null) {
                            isMatch = true;
                        } else {
                            // Regex or value check
                            const headerVal = lowerCaseHeaders.get(header);
                            if (new RegExp(val, 'i').test(headerVal)) {
                                isMatch = true;
                            }
                        }
                    }
                }
            }

            // Server Header Check
            if (!isMatch && rule.server) {
                const server = lowerCaseHeaders.get('server');
                if (server && new RegExp(rule.server, 'i').test(server)) {
                    isMatch = true;
                }
            }

            // Via Header Check
            if (!isMatch && rule.via) {
                const via = lowerCaseHeaders.get('via');
                if (via && new RegExp(rule.via, 'i').test(via)) {
                    isMatch = true;
                }
            }

            // Cookie Check
            if (!isMatch && rule.cookies) {
                const cookie = lowerCaseHeaders.get('set-cookie') || '';
                for (const [cName, cVal] of Object.entries(rule.cookies)) {
                    if (cookie.includes(cName)) {
                        if (cVal === null || cookie.includes(cVal)) {
                            isMatch = true;
                        }
                    }
                }
            }

            // Custom Logic Check (e.g. BaishanCloud mimicking AWS)
            if (!isMatch && rule.custom_check_logic === 'check_aws_compat') {
                // Example: Check for X-Amz-Cf-Id but NOT AWS/CloudFront specific Via
                if (lowerCaseHeaders.has('x-amz-cf-id')) {
                    const via = lowerCaseHeaders.get('via') || '';
                    if (!via.includes('cloudfront.net')) {
                        isMatch = true;
                    }
                }
            }

            if (isMatch) {
                const handler = customHandlers[name] ? customHandlers[name].getInfo : genericGetInfo;
                detectedProviders.push({
                    ...handler(lowerCaseHeaders, rule, name),
                    priority: rule.priority || 5,
                });
            }
        }
        if (detectedProviders.length > 0) {
            detectedProviders.sort((a, b) => b.priority - a.priority);
            const result = detectedProviders[0];

            // Add extended information
            result.server = getServerInfo(lowerCaseHeaders);
            result.connection = getConnectionInfo(response);
            result.additional = getAdditionalInfo(lowerCaseHeaders);

            return result;
        }
        const server = lowerCaseHeaders.get('server');
        if (server) {
            const result = {
                provider: server,
                cache: getCacheStatus(lowerCaseHeaders),
                pop: 'N/A',
                extra: 'No CDN detected',
                server: getServerInfo(lowerCaseHeaders),
                connection: getConnectionInfo(response),
                additional: getAdditionalInfo(lowerCaseHeaders),
            };
            return result;
        }
        return null;
    }

    // --- Icons & Assets ---
    const cdnIcons = {
        'CDNetworks (ChinaNetCenter)': `<svg viewBox="0 0 41.6 42.65"><path fill="currentColor" fill-opacity="0.8" d="M32.28,17.54c-.04,1.27-.26,2.53-.65,3.74-.74,2.28-1.92,4.39-3.47,6.21-.19.23-.39.46-.59.66-3.22,3.49-7.22,5.4-10.62,5.3-1.53,0-3.01-.53-4.2-1.5-1.63-1.49-2.51-3.63-2.4-5.83,3.66-.82,6.93-2.87,9.26-5.81,1.58-1.86,2.78-4.01,3.53-6.33.15-.72.85-1.19,1.57-1.04.21.04.41.13.57.27.44.26,1.91,1.17,3.6,2.22.3-1.47.36-2.98.17-4.47.3.17.58.36.84.58,1.67,1.53,2.55,3.74,2.39,6"/><path fill="currentColor" fill-opacity="0.4" d="M14.48,16.01c4.4-5.24,10.67-7.34,14.57-5.05.19,1.49.13,3-.17,4.47-1.69-1.05-3.16-2-3.6-2.22-.57-.46-1.41-.37-1.87.2-.13.17-.23.36-.27.57-.75,2.32-1.95,4.47-3.53,6.33-2.33,2.94-5.6,4.99-9.26,5.81.19-3.74,1.64-7.31,4.13-10.11"/><path fill="currentColor" fill-opacity="0.3" d="M.04,24.46H.04c-.12,5.42,2.2,10.61,6.31,14.15,7.66,6.43,19.6,5,27.69-2.93.54-.48.59-1.31.11-1.85-.09-.1-.2-.19-.32-.26-.28-.24-1.46-1.3-2.76-2.43s-3-2.63-3.42-2.95h-.05c-.8-.7-2.01-.64-2.75.12-2.25,2.23-4.93,3.99-7.87,5.18-4.81,1.88-9.66,1.64-13-1.17C.99,29.84-.21,25.76.29,21.33c0-.09,0-.19,0-.28v-.05l.12-.76c-.27,1.39-.41,2.8-.41,4.22h.04Z"/><path fill="currentColor" fill-opacity="0.5" d="M23.78,0c-2.98.04-5.92.68-8.64,1.9h-.08c-.26.12-.51.23-.76.36s-.63.31-.94.48c-.31.17-.46.25-.7.38l-.37.23c-.24.14-.49.3-.74.47-.46.3-.92.61-1.36,1-.24.17-.46.36-.69.54-.47.38-.93.79-1.39,1.22-.18.16-.36.34-.53.51-.13.12-.25.25-.36.38C12.91,1.77,20.85.3,25.62,4.3c1.97,1.7,3.2,4.1,3.43,6.69.19,1.49.13,3-.17,4.47-.11.66-.26,1.31-.46,1.94-.24.94.17,1.92,1,2.41l2.18,1.5c1.22.84,2.73,1.84,4,2.72s2.44,1.63,2.79,1.85c1.17.71,1.85,0,2-.47,2.64-7.93.96-16.34-5.04-21.38C32.16,1.42,28.16,0,24.04.03l-.26-.03Z"/></svg>`,
        'Kingsoft Cloud': `<svg viewBox="0 0 1545 1542"><path fill="currentColor" fill-rule="evenodd" d="M1083.4,683.3c-6.27-.67-12.67-1-19.2-1-39,0-74.4,14.3-102,38,13.3-27.6,20.7-58.7,20.7-91.2-.33-13.13-1.67-25.93-4-38.4-18.2-97.6-103.9-171.5-206.9-171.5s-188.7,73.9-206.9,171.5c-2,12.3-3.5,25.1-3.5,38.4,0,32.5,7.4,63.6,20.7,91.2-27.6-23.7-63.5-38-102.5-38-6.53,0-12.77.33-18.7,1-78.3,9.4-138.9,75.9-138.9,156.2,0,87.2,70.4,157.6,157.6,157.6,56.2,0,105.5-29.5,133.6-73.9,3.27-5.27,6.2-10.83,8.8-16.7,9.9-20.2,15.3-42.9,15.3-67,0-16.8-3-33-7.9-48.3,16.8,6.4,31.1,17.2,41.4,31l3.9,5.9c12.4-17.7,29.1-32,48.3-41.3,16.8-7.9,35-12.4,54.7-12.4,40.4,0,75.9,19.3,99,48.8l6.9,9.9c28.1,39.9,77.9,110.8,78.4,111.8,21.2,29.1,55.2,49.3,94.1,51.7l7.9.5h0c87.2,0,157.6-70.4,157.6-157.6,0-80.3-60.1-146.8-138.4-156.2Z"/><path fill="currentColor" fill-rule="evenodd" d="M772.2.5C345.4.5.4,344.9.4,771s345,770.5,771.8,770.5h0c426.9,0,771.9-344.4,771.9-770.5S1199.1.5,772.2.5ZM1074.5,1102.6l-10.3.4c-73.4,0-139.5-34.9-181.3-88.6l-116.8-166.5c-11.8-14.3-29.1-23.2-48.8-23.2-13.8,0-26.1,4.4-36.4,11.3l184.7,264.1c17.3,24.1,45.3,39.4,76.9,39.4,13.8,0,27.1-3,39.4-8.4-21.7,25.2-52.2,42.9-86.7,48.8-7.93,1.33-16.17,2-24.7,2-48.7,0-92.1-24.2-119.2-61.1l-74.4-106.4c-48.3,54.2-118.7,88.6-197.1,88.6-145.3,0-263.6-117.7-263.6-263.5s107.4-252.3,243.9-262.1c24.7-150.3,155.2-264.6,311.9-264.6s287.2,114.3,311.9,264.6h0c136.5,9.8,244.4,123.6,244.4,262.1s-112.9,257.6-253.8,263.1Z"/></svg>`,
        'State Cloud': `<svg viewBox="0 0 44.54 27"><path fill="currentColor" fill-rule="evenodd" d="M28.78,3.64c3.49-.7,7.01,1.15,8.33,4.4h0c4.27,1.06,7.43,4.84,7.43,9.34,0,5.32-4.41,9.63-9.86,9.63-4.11,0-7.62-2.46-9.1-5.94-.45-1.06-.72-2.22-.74-3.43h-2.49c-.17,0-.26-.21-.14-.32l5.07-4.95c.09-.09.25-.09.34,0l5.07,4.96c.12.12.04.32-.14.32h-2.63c.09.61.28,1.21.6,1.78,1.44,2.55,4.75,3.45,7.34,1.96,2.26-1.3,3.21-4.12,2.18-6.48-1.08-2.47-3.81-3.63-6.28-2.97.51-1.61-.17-3.4-1.74-4.26-1.56-.86-3.49-.49-4.62.78h0s0,0,0,0c-1.26-2.93-4.38-4.83-7.78-4.43-3.66.42-6.39,3.37-6.59,6.84-1.83-.96-4.13-.99-6.08.24-2.17,1.37-3.2,4.03-2.48,6.46.78,2.65,3.2,4.24,5.74,4.24h13.28c.1,0,.19.06.23.16.62,1.42,1.52,2.69,2.63,3.76.1.09.03.26-.1.26H10.23s0,0,0,0h0C4.57,25.95,0,21.47,0,15.96,0,10.45,4.58,5.98,10.22,5.98h.02C12.14,2.43,15.96,0,20.35,0c3.34,0,6.35,1.41,8.44,3.64Z"/></svg>`,
        'Adobe Experience Manager (AEM)': `<svg viewBox="0 0 24 22"><path fill="currentColor" d="M14.2353 21.6209L12.4925 16.7699H8.11657L11.7945 7.51237L17.3741 21.6209H24L15.1548 0.379395H8.90929L0 21.6209H14.2353Z" /></svg>`,
        'Huawei Cloud': `<svg viewBox="0 0 36.45 27.36"><path fill="currentColor" fill-rule="evenodd" d="M4.47,14.49c2.78,2.7,9.51,6.11,11.07,6.88.02,0,.1.04.15-.03,0,0,.06-.05.03-.13h0C11.44,11.89,5.58,4.82,5.58,4.82c0,0-3.19,3.01-2.96,6.03.12,2.28,1.85,3.63,1.85,3.63Z"/><path fill="currentColor" fill-rule="evenodd" d="M14.65,23.65c-.03-.1-.14-.1-.14-.1h0l-11.21.39c1.22,2.16,3.26,3.84,5.4,3.32,1.47-.37,4.81-2.68,5.9-3.46h0c.09-.08.05-.14.05-.14Z"/><path fill="currentColor" fill-rule="evenodd" d="M4.16,22.26c1.08.44,2.14.47,2.14.47.17.03,6.66,0,8.4,0,.07,0,.12-.07.12-.07.05-.09-.04-.17-.04-.17h0C9.86,19.17.32,14.09.32,14.09c-.87,2.67.3,4.82.3,4.82,1.21,2.56,3.53,3.34,3.53,3.34Z"/><path fill="currentColor" fill-rule="evenodd" d="M33.14,23.94l-11.22-.39h0s-.1,0-.13.09c0,0-.03.1.04.15h0c1.08.76,4.32,3.03,5.89,3.47,0,0,2.9.98,5.41-3.33Z"/><path fill="currentColor" fill-rule="evenodd" d="M20.74,21.16s-.05.11.03.18c0,0,.08.05.15,0h0c1.6-.8,8.28-4.18,11.05-6.86,0,0,1.75-1.4,1.85-3.65.2-3.13-2.96-6.02-2.96-6.02,0,0-5.84,7.04-10.12,16.33h0Z"/><path fill="currentColor" fill-rule="evenodd" d="M19.18,20.32c0,.1.09.13.09.13.11.04.16-.06.16-.06h0c1.08-1.55,5.92-8.7,6.9-13.05,0,0,.54-2.11.02-3.54,0,0-.74-2.73-3.7-3.44,0,0-.85-.22-1.77-.34h0s-3.32,4.25-1.7,20.32h0Z"/><path fill="currentColor" fill-rule="evenodd" d="M17.01,20.4c.07.07.13.04.13.04.12-.04.11-.14.11-.14h0C18.87,4.25,15.56,0,15.56,0c-.48.04-1.8.34-1.8.34-2.97.76-3.67,3.44-3.67,3.44-.54,1.69.02,3.54.02,3.54.99,4.38,5.85,11.57,6.9,13.08Z"/><path fill="currentColor" fill-rule="evenodd" d="M36.13,14.08s-9.52,5.09-14.44,8.4h0s-.09.05-.05.16c0,0,.04.08.12.08h0c1.77,0,8.44,0,8.61-.02,0,0,.86-.04,1.93-.44,0,0,2.38-.75,3.6-3.43,0,0,1.09-2.2.24-4.75Z"/></svg>`,
        'Gcore': `<svg viewBox="0 0 100.15 116"><path fill="currentColor" fill-rule="evenodd" d="M100.15,57.6c0,31.81-25.79,57.6-57.6,57.6-12.35.02-24.38-3.95-34.3-11.32,1.64.92,3.33,1.75,5.07,2.5,6.59,2.84,13.69,4.31,20.87,4.31,27.72-.01,50.76-21.36,52.88-49,.14-1.26.22-2.52.24-3.78,0-1.61-.13-3.47-.3-5.17-.01-.16-.02-.33-.03-.49,0-.19-.01-.38-.03-.56l-.05.05c-.24-2.21-.49-3.91-.49-3.91h-41.8l-3.25,6.08-7.46,14.1h31.58c-1.17,3.49-2.91,6.77-5.17,9.68-6.22,8.15-15.89,12.92-26.14,12.92-3.87,0-7.71-.7-11.34-2.04C9.85,83.81,1.2,71.44,1.19,57.6c0-18.23,14.77-33,33-33.01,6.99-.01,13.81,2.21,19.45,6.34l4.33-8.11,5.16-9.75c-8.61-5.61-18.67-8.59-28.95-8.58-9.02,0-17.88,2.3-25.76,6.68C17.98,4.16,29.78,0,42.55,0c31.81,0,57.6,25.79,57.6,57.6h0Z"/></svg>`,
        'Cloudflare': `<svg viewBox="0 0 256 116" preserveAspectRatio="xMidYMid"><path fill="currentColor" d="m202.357 49.394-5.311-2.124C172.085 103.434 72.786 69.289 66.81 85.997c-.996 11.286 54.227 2.146 93.706 4.059 12.039.583 18.076 9.671 12.964 24.484l10.069.031c11.615-36.209 48.683-17.73 50.232-29.68-2.545-7.857-42.601 0-31.425-35.497Z"/><path fill="currentColor" d="M176.332 108.348c1.593-5.31 1.062-10.622-1.593-13.809-2.656-3.187-6.374-5.31-11.154-5.842L71.17 87.634c-.531 0-1.062-.53-1.593-.53-.531-.532-.531-1.063 0-1.594.531-1.062 1.062-1.594 2.124-1.594l92.946-1.062c11.154-.53 22.839-9.56 27.087-20.182l5.312-13.809c0-.532.531-1.063 0-1.594C191.203 20.182 166.772 0 138.091 0 111.535 0 88.697 16.995 80.73 40.896c-5.311-3.718-11.684-5.843-19.12-5.31-12.747 1.061-22.838 11.683-24.432 24.43-.531 3.187 0 6.374.532 9.56C16.996 70.107 0 87.103 0 108.348c0 2.124 0 3.718.531 5.842 0 1.063 1.062 1.594 1.594 1.594h170.489c1.062 0 2.125-.53 2.125-1.594l1.593-5.842Z"/><path fill="currentColor" d="M205.544 48.863h-2.656c-.531 0-1.062.53-1.593 1.062l-3.718 12.747c-1.593 5.31-1.062 10.623 1.594 13.809 2.655 3.187 6.373 5.31 11.153 5.843l19.652 1.062c.53 0 1.062.53 1.593.53.53.532.53 1.063 0 1.594-.531 1.063-1.062 1.594-2.125 1.594l-20.182 1.062c-11.154.53-22.838 9.56-27.087 20.182l-1.063 4.78c-.531.532 0 1.594 1.063 1.594h70.108c1.062 0 1.593-.531 1.593-1.593 1.062-4.25 2.124-9.03 2.124-13.81 0-27.618-22.838-50.456-50.456-50.456"/></svg>`,
        'Vercel': `<svg viewBox="0 0 256 222" preserveAspectRatio="xMidYMid"><path fill="currentColor" d="m128 0 128 221.705H0z"/></svg>`,
        'CloudFront': `<svg xml:space="preserve" viewBox="0 0 304 182"><path fill="currentColor" d="m86 66 2 9c0 3 1 5 3 8v2l-1 3-7 4-2 1-3-1-4-5-3-6c-8 9-18 14-29 14-9 0-16-3-20-8-5-4-8-11-8-19s3-15 9-20c6-6 14-8 25-8a79 79 0 0 1 22 3v-7c0-8-2-13-5-16-3-4-8-5-16-5l-11 1a80 80 0 0 0-14 5h-2c-1 0-2-1-2-3v-5l1-3c0-1 1-2 3-2l12-5 16-2c12 0 20 3 26 8 5 6 8 14 8 25v32zM46 82l10-2c4-1 7-4 10-7l3-6 1-9v-4a84 84 0 0 0-19-2c-6 0-11 1-15 4-3 2-4 6-4 11s1 8 3 11c3 2 6 4 11 4zm80 10-4-1-2-3-23-78-1-4 2-2h10l4 1 2 4 17 66 15-66 2-4 4-1h8l4 1 2 4 16 67 17-67 2-4 4-1h9c2 0 3 1 3 2v2l-1 2-24 78-2 4-4 1h-9l-4-1-1-4-16-65-15 64-2 4-4 1h-9zm129 3a66 66 0 0 1-27-6l-3-3-1-2v-5c0-2 1-3 2-3h2l3 1a54 54 0 0 0 23 5c6 0 11-2 14-4 4-2 5-5 5-9l-2-7-10-5-15-5c-7-2-13-6-16-10a24 24 0 0 1 5-34l10-5a44 44 0 0 1 20-2 110 110 0 0 1 12 3l4 2 3 2 1 4v4c0 3-1 4-2 4l-4-2c-6-2-12-3-19-3-6 0-11 0-14 2s-4 5-4 9c0 3 1 5 3 7s5 4 11 6l14 4c7 3 12 6 15 10s5 9 5 14l-3 12-7 8c-3 3-7 5-11 6l-14 2z"/><path d="M274 144A220 220 0 0 1 4 124c-4-3-1-6 2-4a300 300 0 0 0 263 16c5-2 10 4 5 8z" fill="currentColor" fill-opacity="0.5"/><path d="M287 128c-4-5-28-3-38-1-4 0-4-3-1-5 19-13 50-9 53-5 4 5-1 36-18 51-3 2-6 1-5-2 5-10 13-33 9-38z" fill="currentColor" fill-opacity="0.5"/></svg>`,
        'Netlify': `<svg viewBox="0 0 256 226" preserveAspectRatio="xMidYMid"><path fill="currentColor" d="M69.181 188.087h-2.417l-12.065-12.065v-2.417l18.444-18.444h12.778l1.704 1.704v12.778zM54.699 51.628v-2.417l12.065-12.065h2.417L87.625 55.59v12.778l-1.704 1.704H73.143z"/><path fill="currentColor" d="M160.906 149.198h-17.552l-1.466-1.466v-41.089c0-7.31-2.873-12.976-11.689-13.174-4.537-.119-9.727 0-15.274.218l-.833.852v53.173l-1.466 1.466H95.074l-1.466-1.466v-70.19l1.466-1.467h39.503c15.354 0 27.795 12.441 27.795 27.795v43.882l-1.466 1.466Z"/><path fill="currentColor" d="M71.677 122.889H1.466L0 121.423V103.83l1.466-1.466h70.211l1.466 1.466v17.593zM254.534 122.889h-70.211l-1.466-1.466V103.83l1.466-1.466h70.211L256 103.83v17.593zM117.876 54.124V1.466L119.342 0h17.593l1.466 1.466v52.658l-1.466 1.466h-17.593zM117.876 223.787v-52.658l1.466-1.466h17.593l1.466 1.466v52.658l-1.466 1.465h-17.593z"/></svg>`,
        'Nginx': `<svg viewBox="0 0 32 32"><path fill="currentColor" d="M15.948 2h.065a10.418 10.418 0 0 1 .972.528Q22.414 5.65 27.843 8.774a.792.792 0 0 1 .414.788c-.008 4.389 0 8.777-.005 13.164a.813.813 0 0 1-.356.507q-5.773 3.324-11.547 6.644a.587.587 0 0 1-.657.037Q9.912 26.6 4.143 23.274a.7.7 0 0 1-.4-.666q0-6.582 0-13.163a.693.693 0 0 1 .387-.67Q9.552 5.657 14.974 2.535c.322-.184.638-.379.974-.535"/><path fill="currentColor" fill-opacity="0.9" d="M8.767 10.538q0 5.429 0 10.859a1.509 1.509 0 0 0 .427 1.087 1.647 1.647 0 0 0 2.06.206 1.564 1.564 0 0 0 .685-1.293c0-2.62-.005-5.24 0-7.86q3.583 4.29 7.181 8.568a2.833 2.833 0 0 0 2.6.782 1.561 1.561 0 0 0 1.251-1.371q.008-5.541 0-11.081a1.582 1.582 0 0 0-3.152 0c0 2.662-.016 5.321 0 7.982-2.346-2.766-4.663-5.556-7-8.332A2.817 2.817 0 0 0 10.17 9.033 1.579 1.579 0 0 0 8.767 10.538Z"/></svg>`,
        'Akamai': `<svg viewBox="0 0 123 50" preserveAspectRatio="xMidYMid"><path fill="currentColor" d="M122.973 25.89C122.973 27.3307 121.802 28.4952 120.363 28.4952C118.925 28.4952 117.752 27.3307 117.752 25.89C117.752 24.4493 118.921 23.2865 120.363 23.2865C121.806 23.2865 122.973 24.4527 122.973 25.89Z"/><path fill="currentColor" d="M37.6953 40.5306L38.0029 44.0087H43.5222L41.6648 23.7673H33.444L23.0513 44.0087H28.6748L30.4194 40.5306H37.6953ZM37.4527 36.587H32.4136L36.7504 27.8183H36.8L37.4527 36.587Z"/><path fill="currentColor" d="M51.2201 35.1582H52.0283L55.979 29.8387H61.0933L55.6355 36.6415L58.9847 44.0087H53.5525L51.3722 38.2578H50.5588L49.3302 44.0087H44.6841L48.9919 23.7673H53.6465L51.2201 35.1582Z"/><path fill="currentColor" d="M68.3453 44.0088H72.9948L74.8796 35.1582C75.9134 30.2701 74.0406 29.6768 69.2834 29.6768C65.9615 29.6768 62.7474 29.6478 61.8075 34.05H66.4622C66.7254 32.7781 67.5148 32.5155 68.6802 32.5155C70.7034 32.5155 70.6145 33.3527 70.3291 34.6689L69.8575 36.9144H69.6422C69.4662 35.2946 67.4311 35.3168 66.1102 35.3168C62.7525 35.3168 60.7515 36.3705 60.0202 39.7753C59.2547 43.3864 60.9771 44.1707 64.222 44.1707C65.8488 44.1707 68.024 43.8502 68.793 41.898H68.9519L68.347 44.0088H68.3453ZM67.0483 38.1522C68.5657 38.1522 69.5653 38.2562 69.3141 39.4463C68.9946 40.9296 68.3521 41.1768 66.4058 41.1768C65.6967 41.1768 64.3792 41.1768 64.7039 39.6372C64.9807 38.3363 65.9069 38.1522 67.0483 38.1522Z"/><path fill="currentColor" d="M82.3845 29.8386L81.959 31.8369H82.1487C83.0714 30.1626 84.9083 29.6784 86.5026 29.6784C88.5053 29.6784 90.4823 30.0262 90.2072 32.4592H90.4242C91.106 30.4388 93.1805 29.6784 94.9661 29.6784C98.2435 29.6784 99.631 31.0287 98.9304 34.3261L96.8594 44.0104H92.2116L93.9614 35.8043C94.1886 34.3261 94.4552 33.2418 92.6388 33.2418C90.8224 33.2418 90.2226 34.4455 89.8996 35.9646L88.1823 44.0104H83.5311L85.3595 35.4292C85.5833 34.1318 85.6893 33.2418 84.0676 33.2418C82.147 33.2418 81.5763 34.2682 81.2243 35.9646L79.5035 44.0104H74.8506L77.8768 29.8386H82.3845Z"/><path fill="currentColor" d="M107.543 44.0088H112.192L114.079 35.1582C115.118 30.2701 113.25 29.6768 108.491 29.6768C105.157 29.6768 101.938 29.6478 101.01 34.05H105.665C105.928 32.7781 106.724 32.5155 107.874 32.5155C109.908 32.5155 109.807 33.3527 109.54 34.6689L109.055 36.9144H108.838C108.665 35.2946 106.632 35.3168 105.311 35.3168C101.957 35.3168 99.9455 36.3705 99.2227 39.7753C98.4554 43.3864 100.18 44.1707 103.425 44.1707C105.05 44.1707 107.225 43.8502 107.995 41.898H108.154L107.541 44.0088H107.543ZM106.254 38.1522C107.761 38.1522 108.768 38.2562 108.518 39.4463C108.206 40.9296 107.558 41.1768 105.605 41.1768C104.901 41.1768 103.577 41.1768 103.905 39.6372C104.183 38.3363 105.113 38.1522 106.253 38.1522"/><path fill="currentColor" d="M118.896 44.0087H114.253L117.262 29.8387H121.917L118.896 44.0087Z"/><path fill="currentColor" d="M25.4195 48.8969C26.5969 49.2566 26.5456 50 25.2521 50C11.3086 50.0017 0 38.8052 0 25.0017C0 11.1983 11.3086 0 25.2521 0C26.5439 0 26.8275 0.693923 25.7544 1.00764C15.2644 4.04249 7.60399 13.6364 7.60399 25.0017C7.60399 36.367 15.1072 45.7563 25.4212 48.8969M12.3885 30.8583C12.3185 30.1865 12.2843 29.5079 12.2843 28.8225C12.2843 17.8613 21.1921 8.97668 32.1794 8.97668C42.5669 8.97668 45.6854 13.6023 46.0716 13.3005C46.4937 12.968 42.3021 3.79868 30.1049 3.79868C19.1159 3.79868 10.2098 12.6833 10.2098 23.6445C10.2098 26.1798 10.6866 28.5975 11.5529 30.8225C11.9186 31.7568 12.4825 31.7636 12.3885 30.8583ZM20.7221 16.5536C25.8929 14.3047 32.3879 14.2365 38.7735 16.4632C43.0625 17.9551 45.547 20.088 45.7504 19.9993C46.0887 19.8527 43.2556 15.3754 38.1412 13.4403C31.9504 11.0994 25.2811 12.3252 20.4214 16.1273C19.8866 16.5467 20.0882 16.8281 20.7221 16.5536Z"/></svg>`,
        'Fastly': `<svg viewBox="0 0 1709 768"><path fill="currentColor" d="M1154.2 134.3v421.1h126.4v-64.3h-41.8V70.2h-84.7zM55.9 491.1h43V287.9h-43V232l43-7.1v-56.6c0-68.5 14.9-98.2 102.3-98.2 18.9 0 41.2 2.8 60.8 6.3l-11.6 68.9c-13.3-2.1-19.8-2.5-28.2-2.5-30.8 0-38.6 3.1-38.6 33.1V225h63.9v62.9h-63.9V491h42.5v64.3H55.9v-64.2zM1111.1 470.7c-13.2 2.8-24.8 2.5-33.2 2.7-34.8.9-31.8-10.6-31.8-43.5v-142h66.3V225H1046V70.2h-84.7v377.3c0 74.1 18.3 107.9 98 107.9 18.9 0 44.8-4.9 64.4-9zM1637.2 491.4c17.8 0 32.2 14.1 32.2 32 0 17.8-14.4 31.9-32.2 31.9s-32.1-14.1-32.1-31.9 14.3-32 32.1-32m0 58.9c14.8 0 26.8-12.1 26.8-26.9s-12-26.6-26.8-26.6-26.7 11.8-26.7 26.6 11.9 26.9 26.7 26.9m5.9-11.2-6.5-9.5h-4.5v9.5h-7.2v-31.4h13.1c7.8 0 12.6 3.9 12.6 10.9 0 5.1-2.6 8.6-6.6 9.8l7.8 10.8h-8.7zm-10.9-15.8h5.7c3.3 0 5.5-1.3 5.5-4.7 0-3.3-2.2-4.6-5.3-4.6h-5.9zM855.6 287.8v-11.3c-25.6-4.7-51.1-4.7-64.9-4.7-39.4 0-44.2 20.9-44.2 32.2 0 16 5.5 24.7 48.2 34 62.4 14 125.1 28.6 125.1 106 0 73.4-37.8 111.3-117.3 111.3-53.2 0-104.8-11.4-144.2-21.4v-63.2h64.1v11.2c27.6 5.3 56.5 4.8 71.6 4.8 42 0 48.8-22.6 48.8-34.6 0-16.7-12.1-24.7-51.5-32.7-74.2-12.7-133.2-38-133.2-113.5 0-71.4 47.7-99.4 127.3-99.4 53.9 0 94.8 8.4 134.2 18.4v62.8h-64zM465.9 343.4l-6.4-6.4-32.7 28.5c-1.7-.6-3.4-.9-5.3-.9-8.8 0-16 7.4-16 16.4 0 9.1 7.2 16.4 16 16.4s16-7.4 16-16.4c0-1.7-.3-3.4-.7-4.9z"/><path fill="currentColor" d="M595.6 470.7l-.1-263.6h-84.7v24.7c-17.4-10.5-36.9-17.9-57.6-21.8h.5v-29.2H464v-21.5h-85.3v21.5H389V210h.6c-81 14.9-142.4 85.8-142.4 171.2 0 96.2 77.9 174.1 174.1 174.1 32.8 0 63.5-9.1 89.7-24.9l15.3 24.9h89.5v-84.7h-20.2zm-169.1-.1v-10h-10.1v9.9c-45.5-2.6-81.8-39.2-84.2-84.7h10.1v-10.1h-10c2.7-45.2 38.9-81.4 84.1-84v10h10.1v-10c44.6 2.4 80.5 37.4 84.4 81.5v2.9h-10.2v10.1h10.2v2.8c-3.8 44.2-39.8 79.2-84.4 81.6zM1495 225h174.7v62.9h-41.8l-107.1 263.6c-30.7 74-81.1 143.7-157.9 143.7-18.9 0-44-2.1-61.5-6.3l7.7-76.9c11.2 2.1 25.8 3.5 33.5 3.5 35.6 0 75.8-22.1 88.4-60.5l-108.6-267.1h-41.8V225h174.8v62.9h-41.7l61.5 151.3 61.5-151.3H1495z"/></svg>`,
        'Tencent': `<svg viewBox="0 0 1053 720"><path fill="currentColor" d="M724.4 396.5c-8.7 8.7-26.1 21.7-56.5 21.7h-187c56.5-54.1 104.4-99.6 108.8-104 8.3-8.4 17-16.3 26.1-23.8 21.8-19.5 39.1-21.7 54.4-21.7 21.7 0 39.1 8.7 54.4 21.6 30.3 28.2 30.3 78.1-.2 106.2m37-140.9c-23-24.8-55.3-39-89.2-39-30.4 0-56.5 10.9-80.5 28.2-8.8 8.7-21.8 17.3-32.7 30.3-8.7 8.7-195.7 190.7-195.7 190.7 10.9 2.2 23.9 2.2 34.8 2.2h237.1c17.4 0 30.5 0 43.5-2.2 30-2.2 58.3-14.4 80.5-34.7 49.9-47.6 49.9-127.7 2.2-175.5M456.9 242.6c-23.9-17.3-47.9-26-76.1-26-33.9 0-66.2 14.2-89.2 39-48.4 49.7-47.4 129.2 2.2 177.7 21.7 19.5 43.5 30.3 69.6 32.5l50-47.7h-28.3c-28.3-2.1-45.7-10.8-56.5-21.6-30-29.6-30.9-77.6-2.2-108.3 15.2-15.2 32.6-21.7 54.4-21.7 13.1 0 32.6 2.1 52.2 21.6 8.7 8.7 32.6 26 41.3 34.7h2.1l32.6-32.5v-2.2c-15.2-15.2-39.1-34.7-52.1-45.5"/><path fill="currentColor" d="M685.3 188.5c-24.7-66.3-88-110.4-158.8-110.5-84.8 0-152.2 62.8-165.3 140.8 6.5 0 13.1-2.1 21.8-2.1 8.7 0 19.6 2.1 28.3 2.1 10.9-54.2 58.7-93.2 115.3-93.2 47.8 0 89.2 28.2 108.7 69.3 0 0 2.2 2.2 2.2 0 15.2-2.1 32.6-6.4 47.8-6.4"/></svg>`,
        'Alibaba': `<svg viewBox="0 0 120 75"><path fill="currentColor" d="M40.1 32.8h40.1v9H40.1z"/><path fill="currentColor" d="M100.2 0h-26.5l6.4 9.1 19.4 5.9c3.6 1.1 5.9 4.5 5.8 8v29c0 3.6-2.3 6.9-5.8 8l-19.3 5.9-6.5 9.1h26.5c11.1 0 20-9 20-20V20c.1-11-8.9-20-20-20M20 0h26.5l-6.4 9.1-19.3 5.9c-3.6 1.1-5.9 4.5-5.8 8v29c0 3.6 2.3 6.9 5.8 8l19.3 5.9 6.4 9.1H20c-11 0-20-9-20-20V20C0 9 9 0 20 0"/></svg>`,
        'ByteDance': `<svg viewBox="0 0 285 280"><path fill="currentColor" d="M0 11l49.5 14.3v198.2L0 237.8zM78.2 112.3l48.4 12.1v106.8l-48.4 9.9zM160.7 91.4l45.2-12.1v131l-45.2-13.2zM235.6 0l49.5 14.3v222.4l-49.5 12.1z"/></svg>`,
        'BytePlus': `<svg viewBox="0 0 23.92 18.78"><path fill="currentColor" d="M14.74 7.79c-.09.08-.23.07-.31-.02-.04-.04-.06-.1-.05-.16V.22c0-.19-.23-.29-.36-.17L5.18 7.55c-.09.08-.23.07-.3-.02-.04-.04-.06-.1-.05-.15V2.25c0-.15-.12-.26-.26-.26H.26c-.15 0-.26.12-.26.26v16.05c0 .19.23.29.36.17l8.83-7.5c.09-.08.23-.07.3.02.04.04.06.1.05.15v7.41c0 .18.23.29.36.17l8.83-7.5c.09-.08.23-.07.3.02.04.04.06.1.05.15v5.13c0 .15.12.26.27.26h4.29c.15 0 .27-.12.27-.26V.46c0-.19-.23-.29-.36-.17l-8.82 7.5z"/></svg>`,
        'Google': `<svg viewBox="0 0 34.5 28"><path fill="currentColor" d="M21.9 7.4h1l2.8-2.8.2-1.2C20.5-1.3 12.4-.8 7.8 4.5c-1.3 1.5-2.2 3.2-2.8 5.1.3-.1.7-.2 1-.1l5.7-.9s.3-.5.4-.5c2.5-2.8 6.8-3.1 9.7-.7h.1z"/><path fill="currentColor" d="M29.8 9.6c-.7-2.4-2-4.6-3.9-6.2l-4 4c1.7 1.4 2.7 3.5 2.6 5.6v.7c2 0 3.6 1.6 3.6 3.6s-1.6 3.6-3.6 3.6h-7.1l-.7.7v4.3l.7.7h7.1c5.1 0 9.3-4.1 9.3-9.2 0-3.1-1.5-6-4.1-7.7z"/><path fill="currentColor" d="M10.3 26.5h7.1v-5.7h-7.1c-.5 0-1-.1-1.5-.3l-1 .3-2.9 2.9-.2 1c1.6 1.2 3.6 1.9 5.6 1.9z"/><path fill="currentColor" d="M10.3 8c-5.1 0-9.2 4.2-9.2 9.3 0 2.9 1.4 5.5 3.6 7.3l4.1-4.1c-1.8-.8-2.6-2.9-1.8-4.7s2.9-2.6 4.7-1.8c.8.4 1.4 1 1.8 1.8l4.1-4.1c-1.8-2.3-4.5-3.6-7.4-3.6z"/></svg>`,
        'QUIC': `<svg viewBox="0 0 64 32"><path fill="currentColor" d="M61.3 7.6c-2.5-3.3-6.2-5.5-10.3-6-.7-.1-1.4-.2-2.1-.2-2.6 0-5 .6-7.3 1.8-.4.2-.8.4-1.1.7h-.1l-1.3.9-.4.3.3.4 3.3 4.3.3.4.4-.3 1-.7c.2-.1.4-.2.6-.3 1.3-.7 2.8-1.1 4.3-1.1.4 0 .8 0 1.2.1 2.5.3 4.6 1.6 6.1 3.6 1.5 2 2.1 4.4 1.8 6.8-.6 4.6-4.6 8-9.2 8-.4 0-.8 0-1.2-.1-1.9-.3-3.7-1.1-5.1-2.4-.2-.2-.3-.3-.5-.5L29.8 7.3l-.8-1v.1l-.5-.7-.2-.2c-.3-.4-.6-.7-1-1-2.5-2.3-5.6-3.8-9-4.2-.7-.1-1.5-.2-2.2-.2C8.2 0 1.2 6.1.2 14.1c-.6 4.3.6 8.6 3.2 12 2.6 3.5 6.5 5.7 10.8 6.3.7.1 1.5.2 2.2.2 2.7 0 5.2-.6 7.6-1.9.1 0 .2-.1.3-.2l.1-.1.5-.3-.4-.5-3.3-4.3-.2-.3-.4.2c-1.3.6-2.8.9-4.2.9-.4 0-.9 0-1.3-.1-5.4-.7-9.2-5.7-8.5-11.1.7-4.9 4.9-8.6 9.8-8.6.4 0 .9 0 1.3.1 2.1.3 3.9 1.2 5.5 2.6.2.2.3.3.5.5l9.6 12.6.8 1v-.1l3.1 4.1.2.2c.3.3.6.7.9 1 2.4 2.2 5.4 3.7 8.6 4.1.7.1 1.4.1 2.1.1 7.8 0 14.4-5.8 15.5-13.5.6-4.1-.5-8.2-3.1-11.5z"/><path fill="currentColor" fill-opacity="0.6" d="M34.7 29.2l-.2-.2-6.2-8.2c-.3-.3-.6-.6-.9-.9-2.3-2.2-5.2-3.6-8.3-4-.3 0-.6-.1-.9-.1h-.5l2.3 3s.1.1.2.2l6.2 8.2c.3.3.6.6.9.9 2.3 2.2 5.2 3.6 8.3 4 .3 0 .6.1.9.1h.5l-2.3-3z"/></svg>`,
        'Bunny': `<svg viewBox="0 0 38 43"><path fill="currentColor" d="M21 6.9l9.9 5.4L21.8 0c-1.5 2-1.8 4.6-.8 6.9M16.5 26.7c1.2 0 2.3 1 2.3 2.2 0 1.2-1 2.3-2.2 2.3-1.2 0-2.3-1-2.3-2.2 0-.6.2-1.2.7-1.6.4-.4 1-.7 1.6-.7M9.7 1.8l27.6 15c.5.2.8.7.8 1.2s-.3 1-.8 1.2c-2.1 1.3-4.4 2.2-6.8 2.6l-5.8 11.8s-1.8 4.1-6.8 2.6c2.1-2.1 4.6-4 4.6-7.2s-2.7-6.1-6.1-6.1-6.1 2.7-6.1 6.1c0 4.2 4.2 6 6.5 8.9 1 1.5.9 3.5-.3 4.8-2.9-2.8-8.4-7.6-10.7-10.8-1.3-1.6-1.9-3.5-2-5.6.2-4.4 3.2-8.2 7.4-9.5 1.3-.4 2.6-.5 3.9-.5 1.8.1 3.6.7 5.2 1.6 2.5 1.4 3.6 1.1 5.3-.4 1-.8 2.1-3.5.4-4.1-.6-.2-1.1-.3-1.7-.4-3.1-.6-8.6-1.2-10.7-2.3-3.2-1.8-5.4-5.4-4.1-9M22.6 29c1.3-6.7-5.6-13.2-10.8-12.2l.4-.1c-.3.1-.6.1-.8.2-4.2 1.3-7.2 5.1-7.4 9.5 0 2 .7 4 2 5.6 2.3 3.1 7.8 7.9 10.7 10.8 1.2-1.3 1.4-3.3.3-4.8-2.4-2.9-6.5-4.7-6.5-8.9 0-3.4 2.7-6.1 6.1-6.1s6.1 2.7 6.1 6.1M9.7 1.8l21 11.4.6.3c.5.4 1 1.2.4 2.6-1 2.2-5 4.2-9.6 2.6 1.4.4 2.4-.1 3.7-1.1 1-.8 2.1-3.5.4-4.1-.6-.2-1.1-.3-1.7-.4-3.1-.6-8.6-1.2-10.7-2.3-3.2-1.8-5.3-5.4-4.1-9M9.7 1.8c2.2 8 15.4 8.7 22 12L9.7 1.8zM16.9 37.9c-2.3-2.9-6.5-4.7-6.5-8.9 0-3.1 2.3-5.6 5.3-6-4.8 0-8.7 3.9-8.8 8.8 0 .6.1 1.2.2 1.8 1.9 2.2 4.7 4.7 7 6.9.9.9 1.8 1.7 2.4 2.3.6-.7.9-1.5 1-2.4.1-.9-.2-1.7-.7-2.4M22.5 29.7v-.7c1.3-6.7-5.6-13.2-10.8-12.2 1.1-.3 2.3-.4 3.4-.3 6.9.3 8.8 7.6 7.3 13.2M2.3 14.8c1.3 0 2.3 1 2.3 2.3v2.3H2.3c-1.3 0-2.3-1-2.3-2.3s1-2.3 2.3-2.3"/></svg>`,
        'KeyCDN': `<svg viewBox="0 0 41.4 39.8"><path fill="currentColor" d="M4 32.1c.4 0 .8.1 1.2.2l4.8-4.7.2.2c.3.3.5.7.8 1l.1.1.2.2.1.1.1.1.1.1.1.1.1.1.1.1a12.9 12.9 0 0 0 8 3.1 13 13 0 0 0 6.9-1.8l.4.4c.4.5.9.9 1.3 1.4a15.2 15.2 0 0 1-8.6 2.4 15.2 15.2 0 0 1-9.4-3.6l-3.1 3.1a3.9 3.9 0 1 1-3.7-2.8h.1zm29.6-20a15.2 15.2 0 0 1 2.2 8.3 15.2 15.2 0 0 1-3.8 9.7l1.9 2a2.4 2.4 0 0 1 2.1.7 2.4 2.4 0 0 1-.1 3.4 2.4 2.4 0 0 1-3.4-.1 2.4 2.4 0 0 1-.6-2.1l-3.4-3.6-.2-.2.2-.2a12 12 0 0 0 1.6-1.5 12.8 12.8 0 0 0 3.2-8.2 12.8 12.8 0 0 0-1.6-6.6zM6.6 3.1c.7 0 1.3.3 1.8.7.4.6.6 1.3.6 2.1l3.7 3.9-.2.2c-.6.5-1.1 1-1.6 1.5a12.9 12.9 0 0 0-1.7 14.8l-1.8 1.7a15.1 15.1 0 0 1-2.2-8.4c.1-3.6 1.5-7 3.8-9.7l-2-2.1a2.4 2.4 0 0 1-2.1-.7 2.4 2.4 0 0 1 .1-3.4 2.4 2.4 0 0 1 1.4-.6h.2zM37.5 0a3.9 3.9 0 1 1-1.2 7.6l-5.3 5-.2-.2c-.3-.4-.6-.7-.9-1.1l-.1-.1-.2-.2-.3-.3-.1-.1-.1-.1-.1-.1-.1-.1-.1-.1a12.9 12.9 0 0 0-8-3c-2.4-.1-4.8.5-6.9 1.8l-1.7-1.8A15.2 15.2 0 0 1 21 4a15.2 15.2 0 0 1 9.4 3.6l3.5-3.3A3.9 3.9 0 0 1 37.5 0z"/><path fill="currentColor" fill-opacity="0.7" d="M20.6 8.6c.4 0 .9 0 1.3.1 6.3.8 10.7 6.5 9.9 12.7-.8 6.3-6.5 10.7-12.7 9.9-6.3-.8-10.7-6.5-9.9-12.7.7-5.8 5.6-10 11.4-10zm-.2 4.9c-2.5.2-4.4 2.1-4.4 4.7 0 1.8.8 3 2.2 4l.4.2-.9 4.1h5.9l-.9-4.1c1.6-.8 2.5-2.4 2.6-4.2 0-2.6-2.1-4.6-4.7-4.7z"/></svg>`,
        'Apache': `<svg viewBox="0 0 74 146"><path fill="currentColor" d="M63.1 1.4c-2.3 1.3-6.1 5.1-10.6 10.6l4.2 7.8c2.9-4.2 5.9-7.9 8.9-11.1l.3-.4c-.1.1-.2.3-.3.4-1 1.1-3.9 4.5-8.4 11.2 4.3-.2 10.8-1.1 16.2-2 1.6-8.9-1.6-12.9-1.6-12.9S67.8-1.3 63.1 1.4M44.4 40c1.3-2.4 2.6-4.7 3.8-6.9 1.3-2.3 2.7-4.6 4.1-6.8l.2-.4c1.4-2.1 2.7-4.2 4.1-6.2l-4.2-7.8c-.3.4-.6.8-.9 1.2-1.2 1.5-2.4 3.1-3.7 4.8-1.4 1.9-2.9 4-4.4 6.1-1.4 2-2.8 4.1-4.2 6.2-1.2 1.8-2.4 3.7-3.6 5.6l5.4 10.6c1.2-2.3 2.3-4.6 3.5-6.8M19.7 99.8c-.7 2-1.4 4-2.2 6l-.3.9c-.5 1.4-.9 2.6-1.9 5.4 1.6.7 2.9 2.6 4.1 4.8-.1-2.2-1.1-4.3-2.8-6 7.9.4 14.7-1.6 18.1-7.3.3-.5.6-1 .9-1.6-1.6 2-3.6 2.9-7.3 2.7h-.1c5.5-2.4 8.2-4.8 10.6-8.6.6-.9 1.1-1.9 1.7-3-4.8 4.9-10.3 6.3-16.2 5.2l-4.4.5c-.1.4-.3.7-.4 1.1M21.8 90.1c.9-2.4 1.9-4.9 2.9-7.4 1-2.4 1.9-4.8 3-7.2s2-4.8 3.1-7.2c1.1-2.5 2.2-4.9 3.3-7.3 1.1-2.4 2.2-4.8 3.4-7.2.4-.9.8-1.7 1.2-2.6.7-1.5 1.4-2.9 2.2-4.4l.1-.2-5.4-10.6c-.1.1-.2.3-.3.4-1.3 2.1-2.5 4.2-3.8 6.3-1.3 2.2-2.5 4.4-3.7 6.6-1 1.9-2 3.8-3 5.7-.2.4-.4.8-.6 1.2-1.2 2.4-2.2 4.7-3.2 7-1.1 2.5-2.1 5-2.9 7.3-.6 1.5-1.1 3-1.5 4.4-.4 1.2-.7 2.4-1.1 3.6-.8 2.8-1.5 5.6-2.1 8.5l5.5 10.7c.7-1.9 1.5-3.9 2.2-5.8.2-.6.4-1.1.6-1.7M13.4 87.3c-.7 3.4-1.2 6.8-1.4 10.2v.4c-1.7-2.7-6.3-5.3-6.2-5.3 3.3 4.7 5.7 9.4 6.1 13.9-1.7.4-4.1-.2-6.9-1.2 2.9 2.6 5 3.4 5.9 3.6-2.7.2-5.4 2-8.2 4 4.1-1.6 7.3-2.3 9.7-1.8-3.7 10.5-7.5 22-11.2 34.3 1.2-.3 1.8-1.1 2.2-2.1.7-2.2 5.1-16.8 12-35.9.2-.5.4-1.1.6-1.6l.2-.5c.7-2 1.5-4.1 2.3-6.2.2-.5.4-1 .5-1.4v-.1l-5.5-10.7v.4M41.7 47.6c-.2.3-.3.6-.5 1-.5 1-1 1.9-1.4 3-.5 1.1-1.1 2.2-1.6 3.3-.3.6-.5 1.2-.8 1.7-.8 1.8-1.6 3.6-2.5 5.4-1 2.3-2.1 4.7-3.1 7.2-1 2.4-2 4.8-3.1 7.3-1 2.4-2 4.9-3 7.4-.9 2.3-1.8 4.6-2.7 7-.1.1-.1.2-.1.3-.9 2.4-1.8 4.8-2.8 7.4l-.1.2 4.4-.5c-.1 0-.2 0-.3-.1 5.2-.6 12.2-4.5 16.7-9.4 2.1-2.2 4-4.8 5.7-7.9 1.3-2.3 2.5-4.8 3.7-7.6 1-2.4 2-5.1 2.9-7.9-1.2.6-2.6 1.1-4.1 1.4-.3.1-.5.1-.8.2s-.6.1-.8.1c4.9-1.9 8-5.5 10.2-9.9-1.3.9-3.4 2-5.9 2.6-.3.1-.7.1-1 .2-.1 0-.2 0-.3 0 1.7-.7 3.1-1.5 4.4-2.4.3-.2.5-.4.8-.6.4-.3.7-.7 1.1-1 .2-.2.4-.5.6-.7.5-.6.9-1.2 1.4-1.9.1-.2.3-.4.4-.6.2-.3.3-.6.5-.9.7-1.4 1.2-2.6 1.7-3.6.2-.5.4-1 .6-1.5.1-.2.1-.4.2-.5.2-.5.3-1 .4-1.4.2-.6.3-1.1.3-1.4-.2.1-.4.3-.6.4-1.5.9-4 1.7-6 2l4-.4-4 .4h-.1c-.2 0-.4.1-.6.1l.1-.1-13.7 1.5v.1M57.2 19.9c-1.2 1.9-2.6 4-4 6.4l-.2.4c-1.2 2.1-2.6 4.4-4 6.9-1.2 2.2-2.4 4.5-3.7 7-1.1 2.2-2.3 4.5-3.5 6.9l13.7-1.5c4-1.8 5.8-3.5 7.5-5.9.5-.7.9-1.4 1.4-2.1 1.4-2.2 2.8-4.6 4-7 1.2-2.3 2.3-4.6 3.1-6.7.5-1.3.9-2.5 1.2-3.6.3-1 .5-1.9.6-2.7-5.3.9-11.9 1.8-16.2 2"/><path fill="currentColor" fill-opacity="0.6" d="M50.6 60.1c.1 0 .2 0 .3 0-.1 0-.2 0-.3 0"/></svg>`,
        'LiteSpeed': `<svg viewBox="0 0 364 457"><path fill="currentColor" d="M359.7 221.9l-103.2-103.2c-.4-.4-1-.7-1.6-.7h-.1c-.7 0-1.3.4-1.7.9l-44 55.8c-.7.9-.6 2.2.2 3l47.4 47.4c1.7 1.7 2.6 4 2.6 6.4 0 2.4-1 4.6-2.6 6.3l-13.7 13.7c-.8.8-.9 2-.3 2.9 3.4 5.1 9 13.5 9.5 14.5 1.7 3.4 2.3 12.2-2.8 16l-107.8 82.8c-.6.4-.9 1.1-.9 1.8v83.7c0 1.6 0 2.5 1.3 3.2.3.2.7.2 1 .2.9 0 1.3-.4 2.2-1.3l1.8-1.8c1.6-1.6 212.7-212.5 212.7-212.5 5.2-5.3 5.2-13.9 0-19.1M222.5 1l-.1-.1-.1-.2c-.4-.5-1-.8-1.7-.8h-.1c-.6 0-1.2.2-1.6.7L4 215.7c-2.6 2.5-4 5.9-4 9.6s1.4 7 4 9.5l103.2 103.2c.4.4 1 .7 1.6.7h.1c.7 0 1.3-.4 1.7-.9l44-55.8c.7-.9.6-2.2-.2-3l-47.5-47.4c-1.7-1.7-2.6-3.9-2.6-6.3 0-2.4.9-4.7 2.6-6.3l13.7-13.8c.8-.8.9-2 .3-2.9l-9.4-13.5c-3.8-5.4-2.6-13 2.6-17l107.9-82.8c.6-.4.9-1.1.9-1.8V1.5c0-.5-.2-1-.5-1.4"/><path fill="currentColor" fill-opacity="0.7" d="M241.5 267.4l-119.4-77.6 52.8 75.8c1.1 1.7 1 4.7-.2 6.4l-94.5 119.9c-1.7 2.2-3.1 4.5-1.9 7 .6 1.3 2.2 2.3 3.7 2.4 1.9 0 3.3-.8 5.3-2.3l151.9-116.6c4.7-3.6 4.5-12.1 2.5-15M285.4 57.7c-.7-1.5-2.3-2.5-4-2.5-1.5 0-2.9.6-5 2.3L124.5 174.2c-4.8 3.7-5.9 10.7-2.4 15.7l119.4 77.6c-1.7-2.5-52.3-75.8-52.8-76.5-1.1-1.6-1.1-4.8.2-6.4l94.5-120v-.1c1.5-2 3.1-4.3 1.9-6.8"/></svg>`,
        'OpenResty': `<svg viewBox="0 0 91 93"><path fill="currentColor" d="M4.6 45.4c12.6.3 17 .9 26.3 1.8 5.1 10.4 4.9 8.2 7.1 20.5-8.3-9.5-20.9-19.5-33.8-22.3M6 0c11.1 5.7 38.8 24.2 46.4 27.9 4-1 9.8-3.6 17.8-.5-8.9 1-16.5 10.9-25.4 17.7C36.8 24.8 23.4 13.1 17.6 6.9M.2 26.6c15.4 3.1 20.6 4.9 31.7 8 7.1 14.9 5.1 21.9 3.6 31.3C28.3 48.7 15.2 32.8 0 26.6M6.2.1c8.9 5.2 20.7 21 25.6 34 1.8 5.2 4.5 17.7 3.6 31.8 1.6 8.9 12.9 34.4 38.3 23.4-12.9 0-19.2-4.9-25.9-15.9-.4-.3-6.7-18.5-3.1-28.4C36.3 16.9 12.9 3.1 6 0M69.3 82.6c10.3 0 18.5-7 20.5-18.2.1-.7 1.6 8.3-8.2 19.3-.7.7-6.7 1.6-12.1-1M76.5 43c2.2 1.6 3.6 2.9 4.9 4.4 1.3 1-.9-3.6-1.3-4.2.7-3.4-1.4-8.5-1.7-8.6-1.6-1.6-30 9.4-20.2 35.4-.9-21.9 9.3-26 18.2-27.1M73.8 89.3c3.1-1.3 5.1-3.6 7.8-5.7.1-.1-18.1 2.5-23.4-13.7-1.8-2.9-8.3-26.7 20.1-35.5-1.3-2.9-6.7-6.6-8.1-7.1C61.3 28.4 51.3 33.4 45 44.5c-5 9-2.4 46.6 28.8 44.8M76 37.2c.7 0 1.3.7 1.3 1.6s-.6 1.6-1.3 1.6-1.3-.7-1.3-1.6.6-1.6 1.3-1.6"/></svg>`,
        'EdgeNext': `<svg viewBox="0 0 159.81 128.06"><path fill="currentColor" d="M101.87 110.4c13.2 13.3 34.7 13.3 48 0s13.2-34.7 0-48-34.7-13.2-48 0l-42 41.9c-8 8-20 9.6-29.6 4.8l34.4-34.4 6.3-6.3c3.1-3.1 3.1-8.2 0-11.3-1.9-1.9-4-3.6-6.2-5.1-16.2-10.9-38.3-9.2-52.6 5.1S-3.83 93.5 7.07 109.7c1.5 2.2 3.2 4.3 5.1 6.2s4 3.6 6.2 5.1c15.4 10.4 36.3 9.3 50.6-3.2l20.2-20.1 12.7 12.7ZM23.57 68.1c8-8 20-9.6 29.6-4.8l-34.3 34.5c-4.9-9.6-3.3-21.7 4.7-29.7ZM138.47 99c-7 7-18.3 7-25.3 0l-12.7-12.7 12.7-12.6c7-7 18.3-7 25.3 0s7 18.3 0 25.3Z"/><path fill="currentColor" fill-opacity="0.7" d="M88.27 53.2c7.5-8.4 17.7-14.2 29.3-16.1C116.87 16.5 99.97 0 79.17 0c-17.9 0-32.9 12.3-37.1 28.8 19.1.3 35.9 9.9 46.2 24.4Z"/><path fill="currentColor" fill-opacity="0.5" d="M59.87 68.1c2 2 3.5 4.2 4.8 6.6l-34.4 34.4c-2.4-1.2-4.6-2.8-6.6-4.8s-3.6-4.2-4.8-6.6l34.4-34.4c2.4 1.2 4.6 2.8 6.6 4.8Z"/><path fill="currentColor" fill-opacity="0.6" d="M100.47 86.3l-11.4 11.3 12.8 12.8 11.3-11.4-12.7-12.7Z"/></svg>`,
        'Medianova': `<svg viewBox="0 0 157.46 172.69"><path fill="currentColor" fill-rule="evenodd" d="M58.79 56.27l-.22.22L0 22.27V0h25.92l32.87 56.27ZM30.51 108.69l11.85-11.85L0 44.3v-6.66l63.82 37.74 13.42-13.41L40.59 0h7.87l50.24 40.5 12.29-12.3L74.4 0h83.06l-22.5 172.69h-61.95c-48.95.01-73.01-14.41-73.01-53.09v-50.48l30.51 39.57Z"/></svg>`,

        'CacheFly': `<svg viewBox="0 0 181.57 186"><path fill="currentColor" d="M102.47 25.64l-1.61 16.66 17.58-10.09 18.84 12.2L180.83 0l-98.67 5.8 18.19 16.04 58.6-16.04-56.49 19.84h0ZM66.66 33.93l-20.11-2.34 1.84-15.93 20.11 2.34-1.84 15.93h0ZM85.81 54.84l-20.03-2.69 1.8-18.23 20.07 2.72-1.84 18.19ZM63.82 67.89l-19.99-2.23 1.92-16.04 20.03 2.26-1.96 16ZM67.01 91.38l-14.97-1.81 1.5-13.85 14.97 1.88-1.5 13.78h0ZM25.98 101.81l-15.04-1.57 1.46-11.47 15.01 1.65s-1.42 11.4-1.42 11.4ZM39.68 122.73l-15.01-1.61 1.38-11.47 15.04 1.65-1.42 11.44Z"/><path fill="currentColor" d="M26.25 130.56l-12.59-1.3 1.19-9.13 12.55 1.27-1.15 9.17ZM53.27 99.2l-14.93-1.84 1.53-13.82 14.89 1.88s-1.5 13.78-1.5 13.78ZM116.13 65.28l-17.46-1.92 1.65-13.74 17.5 1.92s-1.69 13.74-1.69 13.74ZM91.8 70.5l-15.08-1.65 1.34-11.4 15.08 1.69-1.34 11.36h0ZM23.49 146.22l-12.55-1.34 1.19-9.1 12.55 1.38s-1.19 9.06-1.19 9.06ZM28.97 164.48l-12.51-1.34 1.11-9.1 12.59 1.34-1.19 9.1h0ZM51 177.53l-9.9-1.15 1.07-9.29 9.86 1.19-1.04 9.25ZM67.43 180.14l-9.86-1.15 1-9.29 9.94 1.19s-1.07 9.25-1.08 9.25ZM75.91 172.31l-7.41-.84.77-6.99 7.45.92-.81 6.91h0ZM89.65 185.36l-7.49-.85.81-6.99 7.41.92-.73 6.91h0ZM108.8 180.14l-7.41-.85.81-6.99 7.41.92-.81 6.91ZM117.28 167.09l-4.95-.58.54-4.64 4.95.58s-.54 4.64-.54 4.64ZM42.87 156.65l-9.98-1.23 1-9.21 9.94 1.23-.96 9.21h0Z"/><path fill="currentColor" d="M51.08 161.87l-9.98-.88 1-6.95 9.94.96-.96 6.87h0ZM12.55 135.78l-12.55-1.34 1.11-9.1 12.55 1.38-1.11 9.06h0ZM12.55 107.03l-12.55-1.3 1.11-9.13 12.55 1.38-1.11 9.06h0ZM36.84 78.33l-14.89-1.8 1.5-13.85 14.89 1.8s-1.5 13.85-1.5 13.85Z"/></svg>`,
    };

    // --- UI & Execution Functions ---

    // Detect if the current page is using dark or light theme
    function detectPageTheme() {
        try {
            // Method 1: Check data-theme or data-bs-theme attributes (common in modern sites)
            const htmlTheme = document.documentElement.getAttribute('data-theme') ||
                document.documentElement.getAttribute('data-bs-theme') ||
                document.documentElement.getAttribute('data-color-mode');
            if (htmlTheme) {
                if (htmlTheme.toLowerCase().includes('dark')) return 'dark';
                if (htmlTheme.toLowerCase().includes('light')) return 'light';
            }

            const bodyTheme = document.body?.getAttribute('data-theme') ||
                document.body?.getAttribute('data-bs-theme') ||
                document.body?.getAttribute('data-color-mode');
            if (bodyTheme) {
                if (bodyTheme.toLowerCase().includes('dark')) return 'dark';
                if (bodyTheme.toLowerCase().includes('light')) return 'light';
            }

            // Method 2: Check class names for dark/light keywords
            const htmlClass = document.documentElement.className || '';
            const bodyClass = document.body?.className || '';
            const combinedClasses = (htmlClass + ' ' + bodyClass).toLowerCase();

            if (combinedClasses.includes('dark-mode') || combinedClasses.includes('dark-theme') ||
                combinedClasses.includes(' dark ') || combinedClasses.startsWith('dark ') ||
                combinedClasses.endsWith(' dark')) {
                return 'dark';
            }
            if (combinedClasses.includes('light-mode') || combinedClasses.includes('light-theme') ||
                combinedClasses.includes(' light ') || combinedClasses.startsWith('light ') ||
                combinedClasses.endsWith(' light')) {
                return 'light';
            }

            // Method 3: Check color-scheme CSS property
            const colorScheme = getComputedStyle(document.documentElement).colorScheme;
            if (colorScheme && colorScheme.includes('dark')) return 'dark';
            if (colorScheme && colorScheme.includes('light')) return 'light';

            // Method 4: Analyze background color brightness
            const bgColor = getComputedStyle(document.body).backgroundColor;
            if (bgColor && bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
                const brightness = calculateBrightness(bgColor);
                // Lower threshold for better dark detection
                return brightness < 100 ? 'dark' : 'light';
            }

            // Fallback to html element
            const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
            if (htmlBg && htmlBg !== 'transparent' && htmlBg !== 'rgba(0, 0, 0, 0)') {
                const brightness = calculateBrightness(htmlBg);
                return brightness < 100 ? 'dark' : 'light';
            }

            return null; // Cannot determine
        } catch (e) {
            console.warn('[CDN Detector] Error detecting page theme:', e);
            return null;
        }
    }

    // Calculate brightness from RGB color string
    function calculateBrightness(color) {
        const rgb = color.match(/\d+/g);
        if (!rgb || rgb.length < 3) return 255; // Default to light
        const [r, g, b] = rgb.map(Number);
        // Standard brightness formula
        return (r * 299 + g * 587 + b * 114) / 1000;
    }

    function getPanelCSS() {
        // Simple light/dark theme (no auto mode)
        const isDarkTheme = config.settings.theme === 'dark';
        console.log('[CDN Detector] Panel theme:', config.settings.theme);

        // Ultra-premium aesthetic: deeper blacks, cleaner whites
        const materialBase = isDarkTheme
            ? 'rgba(15, 15, 15, 0.65)'  // Dark mode: darker, slightly less transparent for legibility
            : 'rgba(255, 255, 255, 0.65)'; // Light mode: milky white

        const surfaceGradient = isDarkTheme
            ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 100%)'
            : 'linear-gradient(180deg, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0) 100%)';

        const borderColor = isDarkTheme
            ? 'rgba(255, 255, 255, 0.12)' // Crisp border in dark
            : 'rgba(0, 0, 0, 0.08)';

        const textColor = isDarkTheme ? '#FFFFFF' : '#000000';
        const labelColor = isDarkTheme ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)';

        // Specific font stacks
        const uiFont = '"SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const monoFont = '"SF Mono", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", monospace';

        // Colors & Shadows
        const backdropFilter = 'blur(24px) saturate(180%)'; // Balanced blur
        const boxShadow = isDarkTheme
            ? '0 12px 32px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.2)'
            : '0 12px 32px rgba(0, 0, 0, 0.1), 0 4px 8px rgba(0, 0, 0, 0.05)';

        const greenColor = isDarkTheme ? '#4ADE80' : '#16A34A'; // Slightly muted green
        const redColor = '#EF4444';
        const blueColor = '#3B82F6';

        return `
        /* Safe CSS Reset for Shadow DOM */
        :host {
            all: initial;
            position: fixed;
            z-index: 2147483647;
            ${getPositionCSS()}
            font-family: ${uiFont};
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            /* Prevent font scaling issues */
            text-size-adjust: 100%;
        }

        /* Reset inherited properties specifically for our container */
        #cdn-info-panel-enhanced {
            all: unset; /* Clear inherited styles on container */
            position: relative;
            box-sizing: border-box;
            width: 252px; /* Reverted to 252px as requested */
            padding: 14px 16px;
            border-radius: 14px;
            background-color: ${materialBase};
            backdrop-filter: ${backdropFilter};
            -webkit-backdrop-filter: ${backdropFilter};
            border: 1px solid ${borderColor};
            box-shadow: ${boxShadow};
            cursor: move;
            user-select: none;
            transition: all 0.3s ease;
            color: ${textColor};
            display: flex;
            flex-direction: column;
            gap: 10px;
            overflow: hidden;
            
            /* Explicitly define inherited properties to stop leakage */
            line-height: 1.5;
            font-size: 14px;
            font-style: normal;
            font-weight: normal;
            text-align: left;
            text-decoration: none;
            text-transform: none;
        }

        /* Ensure all children use border-box */
        #cdn-info-panel-enhanced * {
            box-sizing: border-box;
        }

        /* Subtle top highlight */
        #cdn-info-panel-enhanced::after {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            border-radius: 14px;
            background: ${surfaceGradient};
            pointer-events: none;
            z-index: 1;
        }

        #cdn-info-panel-enhanced > *:not(.cdn-watermark) { position: relative; z-index: 2; }

        /* --- Buttons (Hidden by default) --- */
        button.icon-btn {
            position: absolute !important;
            top: 13px !important;
            width: 18px !important;
            height: 18px !important;
            border-radius: 50% !important;
            background: transparent !important;
            color: ${textColor} !important;
            border: none !important;
            outline: none !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            opacity: 0 !important;
            transition: opacity 0.2s ease, transform 0.2s ease !important;
            z-index: 100 !important;
            padding: 0 !important;
            margin: 0 !important;
            -webkit-appearance: none !important;
            appearance: none !important;
            line-height: 1 !important;
        }

        button.close-btn { right: 12px !important; font-size: 16px !important; font-weight: 300 !important; line-height: 18px !important; }
        button.theme-btn { right: 36px !important; font-size: 12px !important; line-height: 18px !important; }

        #cdn-info-panel-enhanced:hover button.icon-btn { opacity: 0.5 !important; }
        button.icon-btn:hover { opacity: 1 !important; transform: scale(1.1); }

        /* --- Content Typography --- */
        .panel-header {
            display: block;
            font-family: ${uiFont};
            font-size: 10px;
            font-weight: 700;
            color: ${isDarkTheme ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'};
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin: 0 0 2px 0;
            padding-left: 2px;
            line-height: 1.4;
        }

        .info-lines-container {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin: 0;
            padding: 0;
        }

        .info-line {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin: 0;
            padding: 0;
            border: none;
            line-height: normal;
        }

        .info-label {
            display: inline-block;
            font-family: ${uiFont};
            font-size: 11px;
            font-weight: 500;
            color: ${isDarkTheme ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'};
            letter-spacing: 0px;
        }

        .info-value {
            display: inline-block;
            font-family: ${monoFont}; /* Mono for data */
            font-size: 11px;
            font-weight: 500;
            color: ${textColor};
            text-align: right;
            opacity: 0.95;
            max-width: 200px; /* Increased to use available left space */
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            letter-spacing: -0.2px;
        }

        .cache-HIT { color: ${greenColor} !important; }
        .cache-MISS { color: ${redColor} !important; }
        .cache-BYPASS, .cache-DYNAMIC { color: ${blueColor} !important; }
        
        /* Watermark Styles */
        .cdn-watermark {
            position: absolute;
            top: -40px;
            right: -40px;
            width: 200px;
            height: 200px;
            opacity: 1;
            pointer-events: none;
            z-index: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: ${isDarkTheme ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.04)'};
        }
        
        .cdn-watermark svg {
            width: 100%;
            height: 100%;
            fill: currentColor;
        }

        
        /* Settings panel styles */
        #settings-panel {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 320px;
            padding: 24px;
            border-radius: 24px;
            background-color: ${materialBase};
            backdrop-filter: ${backdropFilter};
            -webkit-backdrop-filter: ${backdropFilter};
            box-shadow: ${boxShadow};
            z-index: 2147483648;
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
            color: ${textColor};
            overflow: hidden;
            /* Simple sleek border for settings panel too */
            border: 1px solid ${borderColor};
        }
        #settings-panel::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: 24px;
            background: ${surfaceGradient};
            pointer-events: none;
            z-index: 1;
        }
        #settings-panel > * {
            position: relative;
            z-index: 2;
        }
            #settings-panel h3 {
                margin-top: 0;
                color: ${textColor};
                text-align: center;
                font-size: 14px;
                font-weight: 600;
            }
            .setting-item {
                margin-bottom: 12px;
            }
            .setting-item label {
                display: block;
                margin-bottom: 4px;
                color: ${labelColor};
                font-weight: 500;
                font-size: 12px;
            }
            .setting-item select, .setting-item input {
                width: 100%;
                padding: 8px 12px;
                border-radius: 12px;
                border: 1px solid ${isDarkTheme ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'};
                background: ${isDarkTheme ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.6)'};
                color: ${textColor};
                font-size: 13px;
                box-sizing: border-box;
                transition: all 0.2s;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }
            .setting-item select:focus, .setting-item input:focus {
                outline: none;
                border-color: ${blueColor};
                background: ${isDarkTheme ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.8)'};
            }
            .setting-buttons {
                display: flex;
                justify-content: space-between;
                margin-top: 16px;
            }
            .setting-btn {
                padding: 10px 16px;
                border-radius: 12px;
                border: none;
                cursor: pointer;
                font-weight: 600;
                font-size: 13px;
                flex: 1;
                margin: 0 6px;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }
            .setting-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            }
            .setting-btn:active {
                transform: translateY(0);
            }
            .save-btn {
                background: ${blueColor};
                color: white;
            }
            .cancel-btn {
                background: ${isDarkTheme ? 'rgba(120, 120, 128, 0.3)' : 'rgba(120, 120, 128, 0.2)'};
                color: ${textColor};
            }
        `;
    }

    function getPositionCSS() {
        switch (config.settings.panelPosition) {
            case 'top-left':
                return 'top: 20px; left: 20px;';
            case 'top-right':
                return 'top: 20px; right: 20px;';
            case 'bottom-left':
                return 'bottom: 20px; left: 20px;';
            case 'bottom-right':
            default:
                return `bottom: ${config.initialPosition.bottom}; right: ${config.initialPosition.right};`;
        }
    }

    function createSettingsPanel() {
        // Remove existing settings panel if present
        const existingPanel = document.getElementById('cdn-settings-panel');
        if (existingPanel) existingPanel.remove();

        const panel = document.createElement('div');
        panel.id = 'cdn-settings-panel';
        document.body.appendChild(panel);

        const shadowRoot = panel.attachShadow({ mode: 'open' });
        const styleEl = document.createElement('style');
        styleEl.textContent = getPanelCSS();
        shadowRoot.appendChild(styleEl);

        const settingsPanel = document.createElement('div');
        settingsPanel.id = 'settings-panel';
        settingsPanel.innerHTML = `
            <h3>CDN Info Display Settings</h3>
            <div class="setting-item">
                <label for="theme">Theme</label>
                <select id="theme">
                    <option value="auto" ${config.settings.theme === 'auto' || !config.settings.theme ? 'selected' : ''}>Auto (System)</option>
                    <option value="dark" ${config.settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                    <option value="light" ${config.settings.theme === 'light' ? 'selected' : ''}>Light</option>
                </select>
            </div>
            <div class="setting-item">
                <label for="panelPosition">Panel Position</label>
                <select id="panelPosition">
                    <option value="top-left" ${config.settings.panelPosition === 'top-left' ? 'selected' : ''}>Top Left</option>
                    <option value="top-right" ${config.settings.panelPosition === 'top-right' ? 'selected' : ''}>Top Right</option>
                    <option value="bottom-left" ${config.settings.panelPosition === 'bottom-left' ? 'selected' : ''}>Bottom Left</option>
                    <option value="bottom-right" ${config.settings.panelPosition === 'bottom-right' ? 'selected' : ''}>Bottom Right</option>
                </select>
            </div>
            <div class="setting-item">
                <label for="showExtraInfo">
                    <input type="checkbox" id="showExtraInfo" ${config.settings.showExtraInfo ? 'checked' : ''}>
                    Show Extra Information
                </label>
            </div>
            <div class="setting-buttons">
                <button class="setting-btn cancel-btn">Cancel</button>
                <button class="setting-btn save-btn">Save</button>
            </div>
        `;
        shadowRoot.appendChild(settingsPanel);

        // Add event listeners
        shadowRoot.querySelector('.cancel-btn').addEventListener('click', () => {
            panel.remove();
        });

        shadowRoot.querySelector('.save-btn').addEventListener('click', () => {
            // Save settings
            config.settings.theme = shadowRoot.querySelector('#theme').value;
            config.settings.panelPosition = shadowRoot.querySelector('#panelPosition').value;
            config.settings.showExtraInfo = shadowRoot.querySelector('#showExtraInfo').checked;

            // Save to GM storage if available
            if (typeof GM_setValue !== 'undefined') {
                GM_setValue('cdnInfoSettings', JSON.stringify(config.settings));
            }

            // Close panel
            panel.remove();

            // Re-render info panel with new settings
            const infoPanel = document.getElementById('cdn-info-host-enhanced');
            if (infoPanel) {
                infoPanel.remove();
                // Re-run execution to show updated panel
                runExecution(config.max_retries);
            }
        });
    }

    function createDisplayPanel(info) {
        if (!info || document.getElementById('cdn-info-host-enhanced')) return;
        const host = document.createElement('div');
        host.id = 'cdn-info-host-enhanced';
        document.body.appendChild(host);

        const shadowRoot = host.attachShadow({ mode: 'open' });
        const styleEl = document.createElement('style');

        try {
            styleEl.textContent = getPanelCSS();
        } catch (e) {
            console.error('Final CSS generation failed:', e);
            styleEl.textContent = '';
        }

        shadowRoot.appendChild(styleEl);

        const panel = document.createElement('div');
        panel.id = 'cdn-info-panel-enhanced';

        const cacheStatus = info.cache.toUpperCase();
        const cacheClass = 'cache-' + cacheStatus.split(' ')[0];

        const providerLabel =
            info.provider.includes('CDN') ||
                info.provider.includes('Cloud') ||
                info.provider.includes('Edge')
                ? 'CDN'
                : 'Server';

        // Truncate provider name if too long
        let displayProvider = info.provider;
        if (displayProvider.length > 20) {
            displayProvider = displayProvider.substring(0, 17) + '...';
        }

        // Build panel content with new structure
        // Determine current theme for icon display
        const currentTheme = config.settings.theme === 'light' ? 'light' : 'dark';

        // SVG icons (Lucide style)
        const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>`;
        const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>`;

        const themeIcon = currentTheme === 'light' ? sunIcon : moonIcon;

        // Find watermark icon based on CDN provider
        let watermarkSvg = '';
        if (cdnIcons[info.provider]) {
            // Exact match
            watermarkSvg = cdnIcons[info.provider];
        } else {
            // Fuzzy match: try multiple strategies
            // Strategy 1: Check if provider name contains any icon key
            let iconKey = Object.keys(cdnIcons).find(key => info.provider.includes(key));

            // Strategy 2: Check if any icon key is contained in provider name (reverse check)
            if (!iconKey) {
                iconKey = Object.keys(cdnIcons).find(key => {
                    // Case-insensitive partial match
                    const providerLower = info.provider.toLowerCase();
                    const keyLower = key.toLowerCase();
                    return providerLower.includes(keyLower) || keyLower.includes(providerLower);
                });
            }

            if (iconKey) watermarkSvg = cdnIcons[iconKey];
        }
        const watermarkHtml = watermarkSvg ? `<div class="cdn-watermark">${watermarkSvg}</div>` : '';

        let panelContent = `
            ${watermarkHtml}
            <button class="icon-btn close-btn" title="Close">×</button>
            <button class="icon-btn theme-btn" title="Toggle Theme">${themeIcon}</button>
            <div class="panel-header">CDN & Server Info</div>
            
            <div class="info-lines-container">
                <div class="info-line">
                    <span class="info-label">${providerLabel}</span>
                    <span class="info-value" title="${info.provider}">${displayProvider}</span>
                </div>
                <div class="info-line">
                    <span class="info-label">Cache</span>
                    <span class="info-value ${cacheClass}">${cacheStatus}</span>
                </div>
        `;

        // Add POP location if available and not N/A
        if (info.pop && info.pop !== 'N/A') {
            let displayPop = info.pop;
            if (displayPop.length > 12) {
                displayPop = displayPop.substring(0, 9) + '...';
            }
            panelContent += `
                <div class="info-line">
                    <span class="info-label">POP</span>
                    <span class="info-value" title="${info.pop}">${displayPop}</span>
                </div>
            `;
        }

        // Add extra info if enabled
        // Removed as per request to keep it minimal

        panelContent += `</div>`; // Close info-lines-container

        panel.innerHTML = panelContent;
        shadowRoot.appendChild(panel);

        shadowRoot.querySelector('.close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            host.remove();
        });

        shadowRoot.querySelector('.theme-btn').addEventListener('click', (e) => {
            e.stopPropagation();

            // Toggle between light and dark only
            config.settings.theme = config.settings.theme === 'light' ? 'dark' : 'light';

            // Save settings
            if (typeof GM_setValue !== 'undefined') {
                GM_setValue('cdnInfoSettings', JSON.stringify(config.settings));
            }

            // Update icon immediately with SVG
            const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>`;
            const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>`;
            const newIcon = config.settings.theme === 'light' ? sunIcon : moonIcon;
            shadowRoot.querySelector('.theme-btn').innerHTML = newIcon;

            // Update styles by replacing the style element
            const newStyleEl = document.createElement('style');
            try {
                newStyleEl.textContent = getPanelCSS();
                const oldStyle = shadowRoot.querySelector('style');
                if (oldStyle) {
                    shadowRoot.replaceChild(newStyleEl, oldStyle);
                }
            } catch (e) {
                console.error('Failed to update theme:', e);
            }
        });


        makeDraggable(host);
    }

    function makeDraggable(element) {
        let isDragging = false,
            startX = 0,
            startY = 0,
            elementX = 0,
            elementY = 0;
        const dragTarget = element.shadowRoot.querySelector('#cdn-info-panel-enhanced');
        dragTarget.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('close-btn')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = element.getBoundingClientRect();
            elementX = rect.left;
            elementY = rect.top;
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', dragEnd);
        });
        function drag(e) {
            if (!isDragging) return;
            e.preventDefault();
            const newX = elementX + e.clientX - startX;
            const newY = elementY + e.clientY - startY;
            const maxX = window.innerWidth - element.offsetWidth;
            const maxY = window.innerHeight - element.offsetHeight;
            element.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
            element.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
            element.style.right = 'auto';
            element.style.bottom = 'auto';
        }
        function dragEnd() {
            isDragging = false;
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', dragEnd);
        }
    }

    function shouldExcludePage() {
        const url = window.location.href.toLowerCase();
        if (config.excludePatterns.some((pattern) => pattern.test(url))) {
            console.log('[CDN Detector] Excluded by URL pattern.');
            return true;
        }
        return false;
    }

    async function runExecution(retriesLeft) {
        const currentHref = window.location.href;
        const status = window.cdnScriptStatus;
        if (
            status[currentHref] === 'succeeded' ||
            shouldExcludePage() ||
            document.getElementById('cdn-info-host-enhanced')
        )
            return;
        console.log(`[CDN Detector] Attempting to fetch headers... Retries left: ${retriesLeft}`);
        try {
            const response = await fetch(currentHref, {
                method: 'HEAD',
                cache: 'no-store',
                redirect: 'follow',
                headers: {
                    'User-Agent': navigator.userAgent,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                },
            });
            const info = parseInfo(response);
            if (info) {
                createDisplayPanel(info);
                status[currentHref] = 'succeeded';
                console.log('[CDN Detector] Success:', info);
            } else {
                throw new Error('No server info found.');
            }
        } catch (error) {
            console.warn(
                `[CDN Detector] Fetch failed: ${error.message}. This often indicates an active security challenge.`
            );
            status[currentHref] = 'retrying';
            if (retriesLeft > 0) {
                console.log(`[CDN Detector] Retrying in ${config.retry_delay / 1000} seconds...`);
                setTimeout(() => runExecution(retriesLeft - 1), config.retry_delay);
            } else {
                console.error('[CDN Detector] Max retries reached. Aborting for this page.');
                status[currentHref] = 'failed';
            }
        }
    }

    function loadUserSettings() {
        // Load settings from GM storage if available
        if (typeof GM_getValue !== 'undefined') {
            try {
                const savedSettings = GM_getValue('cdnInfoSettings');
                if (savedSettings) {
                    const parsed = JSON.parse(savedSettings);
                    config.settings = { ...config.settings, ...parsed };
                    console.log('[CDN Detector] Loaded saved settings:', config.settings);

                    // Always re-detect and apply page theme on load
                    const pageTheme = detectPageTheme();
                    if (pageTheme) {
                        config.settings.theme = pageTheme;
                        console.log('[CDN Detector] Applied page theme:', pageTheme);
                        GM_setValue('cdnInfoSettings', JSON.stringify(config.settings));
                    } else if (config.settings.theme !== 'light' && config.settings.theme !== 'dark') {
                        // Fallback if page theme can't be detected and saved theme is invalid
                        config.settings.theme = 'light';
                        GM_setValue('cdnInfoSettings', JSON.stringify(config.settings));
                    }
                } else {
                    console.log('[CDN Detector] No saved settings, using defaults:', config.settings);
                    // If no settings, initialize theme based on page theme or default to light
                    const pageTheme = detectPageTheme();
                    config.settings.theme = pageTheme || 'light';
                    GM_setValue('cdnInfoSettings', JSON.stringify(config.settings));
                }
            } catch (e) {
                console.warn('[CDN Detector] Failed to load user settings:', e);
            }
        } else {
            console.log('[CDN Detector] GM_getValue not available, using defaults');
        }
    }

    function main() {
        // Load user settings
        loadUserSettings();

        setTimeout(() => runExecution(config.max_retries), config.initial_delay);
        let lastUrl = window.location.href;
        const observer = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                console.log('[CDN Detector] URL changed (SPA), resetting...');
                lastUrl = window.location.href;
                const oldPanel = document.getElementById('cdn-info-host-enhanced');
                if (oldPanel) oldPanel.remove();
                setTimeout(() => runExecution(config.max_retries), config.initial_delay);
            }
        });
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            new MutationObserver((__, obs) => {
                if (document.body) {
                    observer.observe(document.body, { childList: true, subtree: true });
                    obs.disconnect();
                }
            }).observe(document.documentElement, { childList: true });
        }

        // Listen for system theme changes
        const themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        themeMediaQuery.addEventListener('change', (e) => {
            // Only update if using auto theme
            if (config.settings.theme === 'auto' || !config.settings.theme) {
                console.log('[CDN Detector] System theme changed, updating panel...');
                const oldPanel = document.getElementById('cdn-info-host-enhanced');
                if (oldPanel) {
                    oldPanel.remove();
                    setTimeout(() => runExecution(config.max_retries), 100);
                }
            }
        });

        // Listen for page theme changes (class/style changes on html/body)
        let lastPageTheme = detectPageTheme();
        console.log('[CDN Detector] Initial page theme detected:', lastPageTheme);
        let themeCheckTimeout;

        const pageThemeObserver = new MutationObserver((mutations) => {
            // Debounce: only check after 300ms of no changes
            clearTimeout(themeCheckTimeout);
            themeCheckTimeout = setTimeout(() => {
                if (config.settings.theme === 'auto' || !config.settings.theme) {
                    const currentPageTheme = detectPageTheme();
                    console.log('[CDN Detector] Theme check - Last:', lastPageTheme, 'Current:', currentPageTheme);

                    if (currentPageTheme && currentPageTheme !== lastPageTheme) {
                        console.log(`[CDN Detector] Page theme changed: ${lastPageTheme} -> ${currentPageTheme}`);
                        lastPageTheme = currentPageTheme;

                        const oldPanel = document.getElementById('cdn-info-host-enhanced');
                        if (oldPanel) {
                            oldPanel.remove();
                            setTimeout(() => runExecution(config.max_retries), 100);
                        }
                    }
                }
            }, 300);
        });

        // Observe both html and body for attribute changes
        if (document.documentElement) {
            pageThemeObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme']
            });
        }
        if (document.body) {
            pageThemeObserver.observe(document.body, {
                attributes: true,
                attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme']
            });
        }
    }

    main();
})();
