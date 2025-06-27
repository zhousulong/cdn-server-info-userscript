// ==UserScript==
// @name         CDN & Server Info Displayer (UI Overhaul)
// @name:en      CDN & Server Info Displayer (UI Overhaul)
// @namespace    http://tampermonkey.net/
// @version      5.7.0
// @description  [v5.7.0 UI 大修] 彻底重做了面板的视觉设计！灵感源自现代开发者工具，采用更专业、更护眼的暗色主题，优化了色彩与排版，并为核心数据启用等宽字体以提高可读性。
// @description:en [v5.7.0 UI Overhaul] Complete UI redesign! Inspired by modern developer tools, featuring a professional and eye-friendly dark theme, refined colors, improved typography, and a monospaced font for core data to enhance readability.
// @author       Gemini (AI Designer & Coder)
// @license      MIT
// @match        *://*/*
// @grant        GM_addStyle
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration (Unchanged) ---
    const config = {
        initialPosition: { bottom: '20px', right: '20px' },
        initial_delay: 2500,
        retry_delay: 7000,
        max_retries: 4,
        excludePatterns: [
            /\/wp-admin/i, /\/wp-login\.php/i,
            /(\/|&)pay(pal|ment)/i, /\/checkout|\/billing/i,
            /\/login|\/signin|\/auth/i,
            /\/phpmyadmin/i, /(\/ads\/|ad_id=|advertisement)/i,
            /doubleclick\.net/i,
        ]
    };

    window.cdnScriptStatus = window.cdnScriptStatus || {};

    // --- Core Info Parsing Functions (Unchanged) ---
    function getCacheStatus(h) {
        const headersToCheck = [h.get('x-cache'), h.get('x-bdcdn-cache-status'), h.get('x-response-cache'), h.get('x-qc-cache'), h.get('x-cache-lookup'), h.get('cache-status'), h.get('x-cache-status'), h.get('x-edge-cache-status'), h.get('x-sucuri-cache'), h.get('x-vercel-cache'), h.get('cf-cache-status'), h.get('cdn-cache'), h.get('bunny-cache-state')];
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

    const cdnProviders = {
        'Akamai': {
            customCheck: (h) => { const cookieHeader = h.get('set-cookie') || ''; return cookieHeader.includes('ak_bmsc=') || cookieHeader.includes('akacd_'); },
            priority: 10,
            getInfo: (h) => ({ provider: 'Akamai', cache: getCacheStatus(h), pop: 'N/A', extra: 'Detected via Akamai cookie' })
        },
        'ByteDance CDN': {
            serverHeaders: ['Byte-nginx'], headers: ['x-tt-trace-tag', 'x-bdcdn-cache-status'], priority: 11,
            getInfo: (h) => {
                let cache = 'N/A';
                const ttTrace = h.get('x-tt-trace-tag'); if (ttTrace) { const match = ttTrace.match(/cdn-cache=([^;]+)/); if (match) cache = match[1].toUpperCase(); }
                if (cache === 'N/A') { const serverTiming = h.get('server-timing'); if (serverTiming) { const match = serverTiming.match(/cdn-cache;desc=([^,]+)/); if (match) cache = match[1].toUpperCase(); } }
                if (cache === 'N/A') { cache = getCacheStatus(h); }
                let pop = 'N/A'; const viaHeader = h.get('via');
                if (viaHeader) { const viaParts = viaHeader.split(','); for (let i = viaParts.length - 1; i >= 0; i--) { const part = viaParts[i].trim(); const cityMatch = part.match(/\.([a-zA-Z]+)/); if (cityMatch && cityMatch[1]) { if (!/cn\d+/.test(cityMatch[1])) { pop = cityMatch[1].split('-')[0].toUpperCase(); break; } } const internalCodeMatch = part.match(/\b([a-z]*cn\d+)\b/i); if (internalCodeMatch && internalCodeMatch[1]) { pop = 'CN'; break; } } }
                return { provider: 'ByteDance CDN', cache, pop, extra: `Trace Tag: ${h.get('x-tt-trace-tag') || 'N/A'}` };
            }
        },
        'Alibaba Cloud CDN': {
            serverHeaders: ['Tengine'], headers: ['eagleid'], priority: 10,
            getInfo: (h) => {
                let cache = 'N/A';
                const serverTiming = h.get('server-timing'); if (serverTiming) { const match = serverTiming.match(/cdn-cache;desc=([^,]+)/); if (match) cache = match[1].toUpperCase(); }
                if (cache === 'N/A') { const xCache = h.get('x-cache'); if(xCache) cache = getCacheStatus(h); }
                if (cache === 'N/A') { cache = getCacheStatus(h); }
                return { provider: 'Alibaba Cloud CDN', cache, pop: (h.get('X-Swift-Pop') || 'N/A'), extra: `EagleID: ${h.get('eagleid') || 'N/A'}` };
            }
        },
        'BunnyCDN': {
            serverHeaders: ['BunnyCDN'], priority: 9,
            getInfo: (h) => {
                let pop = 'N/A';
                const serverHeader = h.get('server');
                if (serverHeader) { const match = serverHeader.match(/BunnyCDN-([A-Z0-9]+)/); if (match && match[1]) { pop = match[1]; } }
                if (pop === 'N/A') { pop = h.get('cdn-requestcountrycode')?.toUpperCase() || 'N/A'; }
                return { provider: 'BunnyCDN', cache: h.get('cdn-cache')?.toUpperCase() || getCacheStatus(h), pop: pop, extra: `Pullzone: ${h.get('cdn-pullzone') || 'N/A'}` };
            }
        },
        'Cloudflare':{headers:['cf-ray'],serverHeaders:['cloudflare'],priority:10,getInfo:(h)=>({provider:'Cloudflare',cache:h.get('cf-cache-status')?.toUpperCase()||'N/A',pop:h.get('cf-ray')?.slice(-3).toUpperCase()||'N/A',extra:`Ray ID: ${h.get('cf-ray')||'N/A'}`})},
        'AWS CloudFront':{headers:['x-amz-cf-pop','x-amz-cf-id'],priority:9,getInfo:(h)=>({provider:'AWS CloudFront',cache:getCacheStatus(h),pop:(h.get('x-amz-cf-pop')||'N/A').substring(0,3),extra:`CF ID: ${h.get('x-amz-cf-id')||'N/A'}`})},
        'Fastly':{headers:['x-fastly-request-id','x-served-by'],priority:9,getInfo:(h)=>({provider:'Fastly',cache:getCacheStatus(h),pop:h.get('x-served-by')?.split('-').pop()||'N/A',extra:`ReqID: ${h.get('x-fastly-request-id')||'N/A'}`})},
        'Vercel':{headers:['x-vercel-id'],priority:10,getInfo:(h)=>{let pop='N/A';const vercelId=h.get('x-vercel-id');if(vercelId){const regionPart=vercelId.split('::')[0];const match=regionPart.match(/^[a-zA-Z]+/);if(match)pop=match[0].toUpperCase();}return{provider:'Vercel',cache:getCacheStatus(h),pop:pop,extra:`ID: ${h.get('x-vercel-id')||'N/A'}`};}},
    };

    function parseInfo(h) {
        const lowerCaseHeaders = new Map();
        for (const [key, value] of h.entries()) { lowerCaseHeaders.set(key.toLowerCase(), value); }
        const detectedProviders = [];
        for (const [_, cdn] of Object.entries(cdnProviders)) {
            let isMatch = false;
            if (cdn.customCheck && cdn.customCheck(lowerCaseHeaders)) isMatch = true;
            if (!isMatch && cdn.headers?.some(header => lowerCaseHeaders.has(header.toLowerCase()))) isMatch = true;
            if (!isMatch && cdn.serverHeaders?.some(server => (lowerCaseHeaders.get('server') || '').toLowerCase().includes(server.toLowerCase()))) isMatch = true;
            if (isMatch) detectedProviders.push({ ...cdn.getInfo(lowerCaseHeaders), priority: cdn.priority || 5 });
        }
        if (detectedProviders.length > 0) {
            detectedProviders.sort((a, b) => b.priority - a.priority);
            return detectedProviders[0];
        }
        const server = lowerCaseHeaders.get('server');
        if (server) return { provider: server, cache: getCacheStatus(lowerCaseHeaders), pop: 'N/A', extra: 'No CDN detected' };
        return { provider: 'Unknown', cache: 'N/A', pop: 'N/A', extra: 'No CDN or Server info' };
    }

    // --- UI & Execution Functions ---
    function getPanelCSS() {
        return `
            :host {
                all: initial;
                position: fixed;
                z-index: 2147483647;
                bottom: ${config.initialPosition.bottom};
                right: ${config.initialPosition.right};
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            #cdn-info-panel-enhanced {
                position: relative;
                min-width: 240px;
                padding: 14px 20px;
                border-radius: 12px;
                background-color: #1A1B1E;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
                cursor: move;
                user-select: none;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }
            #cdn-info-panel-enhanced:hover {
                transform: translateY(-4px);
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3);
            }
            .close-btn {
                position: absolute; top: 6px; right: 6px;
                width: 20px; height: 20px;
                border-radius: 50%;
                background: transparent;
                color: #6c6d6f;
                border: none; cursor: pointer;
                font-size: 14px;
                line-height: 20px;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.2s;
                z-index: 2;
            }
            .close-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
            .panel-header {
                font-size: 11px;
                font-weight: 600;
                color: #8E8F91;
                text-align: center;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }
            .info-line {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                font-size: 13px;
            }
            .info-line:last-child { margin-bottom: 0; }
            .info-label {
                color: #8E8F91;
                font-weight: 500;
            }
            .info-value {
                color: #E4E5E7;
                font-weight: 600;
                /* Using a monospace font for data alignment and a professional look */
                font-family: 'SF Mono', 'Menlo', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
            }
            .cache-HIT { color: #34D399 !important; /* Tailwind Green 400 */ }
            .cache-MISS { color: #F472B6 !important; /* Tailwind Pink 400 */ }
            .cache-BYPASS, .cache-DYNAMIC { color: #A5B4FC !important; /* Tailwind Indigo 300 */ }
        `;
    }

    function createDisplayPanel(info) {
        if (!info || document.getElementById('cdn-info-host-enhanced')) return;
        const host = document.createElement('div');
        host.id = 'cdn-info-host-enhanced';
        document.body.appendChild(host);

        const shadowRoot = host.attachShadow({ mode: 'open' });
        const styleEl = document.createElement('style');
        styleEl.textContent = getPanelCSS();
        shadowRoot.appendChild(styleEl);

        const panel = document.createElement('div');
        panel.id = 'cdn-info-panel-enhanced';
        const cacheStatus = info.cache.toUpperCase();
        const cacheClass = 'cache-' + cacheStatus.split(' ')[0]; // e.g., cache-HIT
        const providerLabel = info.provider.includes('CDN') || info.provider.includes('Cloud') || info.provider.includes('Edge') ? 'CDN Provider' : 'Server';

        panel.innerHTML = `
            <button class="close-btn" title="Close">×</button>
            <div class="panel-header">CDN & Server Info</div>
            <div class="info-line">
                <span class="info-label">${providerLabel}</span>
                <span class="info-value" title="${info.provider}">${info.provider}</span>
            </div>
            <div class="info-line">
                <span class="info-label">Cache Status</span>
                <span class="info-value ${cacheClass}">${info.cache}</span>
            </div>
            <div class="info-line">
                <span class="info-label">POP Location</span>
                <span class="info-value" title="${info.pop}">${info.pop}</span>
            </div>
        `;

        shadowRoot.appendChild(panel);
        shadowRoot.querySelector('.close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            host.remove();
        });
        makeDraggable(host);
    }

    function makeDraggable(element) {
        let isDragging = false, startX = 0, startY = 0, elementX = 0, elementY = 0;
        const dragTarget = element.shadowRoot.querySelector('#cdn-info-panel-enhanced');
        dragTarget.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('close-btn')) return;
            isDragging = true; startX = e.clientX; startY = e.clientY;
            const rect = element.getBoundingClientRect(); elementX = rect.left; elementY = rect.top;
            document.addEventListener('mousemove', drag); document.addEventListener('mouseup', dragEnd);
        });
        function drag(e) {
            if (!isDragging) return; e.preventDefault();
            const newX = elementX + e.clientX - startX; const newY = elementY + e.clientY - startY;
            const maxX = window.innerWidth - element.offsetWidth; const maxY = window.innerHeight - element.offsetHeight;
            element.style.left = `${Math.max(0, Math.min(newX, maxX))}px`;
            element.style.top = `${Math.max(0, Math.min(newY, maxY))}px`;
            element.style.right = 'auto'; element.style.bottom = 'auto';
        }
        function dragEnd() {
            isDragging = false; document.removeEventListener('mousemove', drag); document.removeEventListener('mouseup', dragEnd);
        }
    }

    function shouldExcludePage() {
        const url = window.location.href.toLowerCase();
        if (config.excludePatterns.some(pattern => pattern.test(url))) {
            console.log('[CDN Detector] Excluded by URL pattern.');
            return true;
        }
        return false;
    }

    async function runExecution(retriesLeft) {
        const currentHref = window.location.href;
        const status = window.cdnScriptStatus;
        if (status[currentHref] === 'succeeded' || shouldExcludePage() || document.getElementById('cdn-info-host-enhanced')) return;
        console.log(`[CDN Detector] Attempting to fetch headers... Retries left: ${retriesLeft}`);
        try {
            const response = await fetch(currentHref, { method: 'HEAD', cache: 'no-store', redirect: 'follow', headers: { 'User-Agent': navigator.userAgent, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8' } });
            const info = parseInfo(response.headers);
            createDisplayPanel(info);
            status[currentHref] = 'succeeded';
            console.log('[CDN Detector] Success! Panel created.');
        } catch (error) {
            console.warn(`[CDN Detector] Fetch failed: ${error.message}. This often indicates an active security challenge.`);
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

    function main() {
        setTimeout(() => runExecution(config.max_retries), config.initial_delay);
        let lastUrl = location.href;
        const observer = new MutationObserver(() => {
            if (location.href !== lastUrl) {
                console.log('[CDN Detector] URL changed (SPA), resetting...');
                lastUrl = location.href;
                const oldPanel = document.getElementById('cdn-info-host-enhanced');
                if (oldPanel) oldPanel.remove();
                setTimeout(() => runExecution(config.max_retries), config.initial_delay);
            }
        });
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            new MutationObserver((_, obs) => {
                if (document.body) {
                    observer.observe(document.body, { childList: true, subtree: true });
                    obs.disconnect();
                }
            }).observe(document.documentElement, { childList: true });
        }
    }

    main();

})();
