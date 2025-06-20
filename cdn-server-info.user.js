// ==UserScript==
// @name         CDN & Server Info Displayer (POP Display Tweak)
// @name:en      CDN & Server Info Displayer (POP Display Tweak)
// @namespace    http://tampermonkey.net/
// @version      5.5.7
// @description  [v5.5.7 微调] 根据反馈优化字节跳动CDN的POP显示逻辑：当无法识别明确城市名而只能获取到内部节点代码（如cn8506）时，仅显示国家代码“CN”。
// @description:en [v5.5.7 Tweak] Optimized ByteDance CDN's POP display logic per feedback: When only an internal node code (e.g., cn8506) is available instead of a clear city name, it will only display the country code "CN".
// @author       Gemini (AI Polish)
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
        minWindowSize: { width: 400, height: 300 },
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

    // --- Core Info Parsing Functions ---
    function getCacheStatus(h) {
        const headersToCheck = [ h.get('x-cache'), h.get('x-bdcdn-cache-status'), h.get('x-response-cache'), h.get('x-qc-cache'), h.get('x-cache-lookup'), h.get('cache-status'), h.get('x-cache-status'), h.get('x-edge-cache-status'), h.get('x-sucuri-cache'), h.get('x-vercel-cache'), h.get('cf-cache-status'), h.get('cdn-cache'), h.get('bunny-cache-state') ];
        for (const value of headersToCheck) { if (!value) continue; const firstValue = value.split(',')[0].trim(); const upperVal = firstValue.toUpperCase(); if (upperVal.includes('HIT')) return 'HIT'; if (upperVal.includes('MISS')) return 'MISS'; if (upperVal.includes('BYPASS')) return 'BYPASS'; if (upperVal.includes('DYNAMIC')) return 'DYNAMIC'; }
        if (parseInt(h.get('age'), 10) > 0) return 'HIT (inferred)';
        return 'N/A';
    }

    const cdnProviders = {
        'ByteDance CDN': {
            serverHeaders: ['Byte-nginx'],
            headers: ['x-tt-trace-tag', 'x-bdcdn-cache-status'],
            priority: 11,
            getInfo: (h) => {
                let cache = 'N/A';
                const ttTrace = h.get('x-tt-trace-tag');
                if (ttTrace) { const match = ttTrace.match(/cdn-cache=([^;]+)/); if (match) cache = match[1].toUpperCase(); }
                if (cache === 'N/A') { const serverTiming = h.get('server-timing'); if (serverTiming) { const match = serverTiming.match(/cdn-cache;desc=([^,]+)/); if (match) cache = match[1].toUpperCase(); } }
                if (cache === 'N/A') { cache = getCacheStatus(h); }

                let pop = 'N/A';
                const viaHeader = h.get('via');
                if (viaHeader) {
                    const viaParts = viaHeader.split(',');
                    for (let i = viaParts.length - 1; i >= 0; i--) {
                        const part = viaParts[i].trim();
                        // 1. 优先尝试匹配明确的城市/地区代码 (e.g., jschangzhou, wxct)
                        const cityMatch = part.match(/\.([a-zA-Z]+)/);
                        if (cityMatch && cityMatch[1]) {
                            // 确保它不是一个内部代码格式
                            if (!/cn\d+/.test(cityMatch[1])) {
                                 pop = cityMatch[1].split('-')[0].toUpperCase();
                                 break;
                            }
                        }
                        // 2. 如果没找到城市代码，再匹配内部节点代码 (e.g., l2cn3160, cn8506)
                        const internalCodeMatch = part.match(/\b([a-z]*cn\d+)\b/i);
                        if (internalCodeMatch && internalCodeMatch[1]) {
                            pop = 'CN'; // 按要求简化为 CN
                            break;
                        }
                    }
                }
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
        'JD Cloud CDN': {
            headers: ['x-jss-request-id'], customCheck: (h) => (h.get('via') || '').includes('(jcs'), priority: 10,
            getInfo: (h) => { let pop = 'N/A'; const viaHeader = h.get('via'); if (viaHeader) { const match = viaHeader.match(/\s([A-Z]{2,3})-[A-Z]{2,}/); if (match && match[1]) { pop = match[1]; } } return { provider: 'JD Cloud CDN', cache: getCacheStatus(h), pop: pop, extra: `Req ID: ${h.get('x-jss-request-id') || 'N/A'}` }; }
        },
        'QUIC.cloud': {
            headers: ['x-qc-pop', 'x-qc-cache'], priority: 9,
            getInfo: (h) => { let pop = 'N/A'; const popHeader = h.get('x-qc-pop'); if (popHeader) { const parts = popHeader.split('-'); if (parts.length >= 3) { pop = parts[2].toUpperCase(); } else { pop = parts.length >= 2 ? parts[1].toUpperCase() : popHeader; } } return { provider: 'QUIC.cloud', cache: h.get('x-qc-cache')?.toUpperCase() || getCacheStatus(h), pop: pop, extra: `POP Str: ${popHeader || 'N/A'}` }; }
        },
        'Tencent EdgeOne': {
            serverHeaders: ['edgeone-pages'], headers: ['x-nws-log-uuid'], priority: 10,
            getInfo: (h) => { let cache = 'N/A'; const lookup = h.get('x-cache-lookup'); if (lookup) { const firstPart = lookup.split(',')[0].trim(); cache = firstPart.replace('Cache ', '').toUpperCase(); } else { cache = getCacheStatus(h); } return { provider: 'Tencent EdgeOne', cache: cache, pop: 'N/A', extra: `Log-UUID: ${h.get('x-nws-log-uuid') || 'N/A'}` }; }
        },
        'Cloudflare':{headers:['cf-ray'],serverHeaders:['cloudflare'],priority:10,getInfo:(h)=>({provider:'Cloudflare',cache:h.get('cf-cache-status')?.toUpperCase()||'N/A',pop:h.get('cf-ray')?.slice(-3).toUpperCase()||'N/A',extra:`Ray ID: ${h.get('cf-ray')||'N/A'}`})},
        'AWS CloudFront':{headers:['x-amz-cf-pop','x-amz-cf-id'],priority:9,getInfo:(h)=>({provider:'AWS CloudFront',cache:getCacheStatus(h),pop:(h.get('x-amz-cf-pop')||'N/A').substring(0,3),extra:`CF ID: ${h.get('x-amz-cf-id')||'N/A'}`})},
        'Fastly':{headers:['x-fastly-request-id','x-served-by'],priority:9,getInfo:(h)=>({provider:'Fastly',cache:getCacheStatus(h),pop:h.get('x-served-by')?.split('-').pop()||'N/A',extra:`ReqID: ${h.get('x-fastly-request-id')||'N/A'}`})},
        'Vercel':{headers:['x-vercel-id'],priority:10,getInfo:(h)=>{let pop='N/A';const vercelId=h.get('x-vercel-id');if(vercelId){const regionPart=vercelId.split('::')[0];const match=regionPart.match(/^[a-zA-Z]+/);if(match)pop=match[0].toUpperCase();}return{provider:'Vercel',cache:getCacheStatus(h),pop:pop,extra:`ID: ${h.get('x-vercel-id')||'N/A'}`};}},
    };
    function parseInfo(h) {
        const lowerCaseHeaders=new Map();for(const[key,value]of h.entries()){lowerCaseHeaders.set(key.toLowerCase(),value);}let detectedProviders=[];for(const[_,cdn]of Object.entries(cdnProviders)){let isMatch=false;if(cdn.customCheck&&cdn.customCheck(lowerCaseHeaders)){isMatch=true;}if(!isMatch&&cdn.headers?.some(header=>lowerCaseHeaders.has(header.toLowerCase())))isMatch=true;if(!isMatch&&cdn.serverHeaders?.some(server=>(lowerCaseHeaders.get('server')||'').toLowerCase().includes(server.toLowerCase())))isMatch=true;if(isMatch)detectedProviders.push({...cdn.getInfo(lowerCaseHeaders),priority:cdn.priority||5});}if(detectedProviders.length>0){detectedProviders.sort((a,b)=>b.priority-a.priority);return detectedProviders[0];}const server=lowerCaseHeaders.get('server');if(server)return{provider:server,cache:getCacheStatus(lowerCaseHeaders),pop:'N/A',extra:'No CDN detected'};return{provider:'Unknown',cache:'N/A',pop:'N/A',extra:'No CDN or Server info'};
    }

    // --- UI & Execution Functions (Unchanged) ---
    function getPanelCSS() {
        return `
            :host { all: initial; position: fixed; z-index: 2147483647; bottom: ${config.initialPosition.bottom}; right: ${config.initialPosition.right}; }
            #cdn-info-panel-enhanced { position: relative; min-width: 270px; padding: 20px 24px; border-radius: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: rgba(255, 255, 255, 0.65); backdrop-filter: blur(20px) saturate(110%); -webkit-backdrop-filter: blur(20px) saturate(110%); border: 1px solid rgba(0, 0, 0, 0.1); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15); cursor: move; user-select: none; transition: transform 0.2s ease, box-shadow 0.2s ease; }
            #cdn-info-panel-enhanced:hover { transform: translateY(-4px); box-shadow: 0 15px 35px rgba(0, 0, 0, 0.18); }
            .close-btn { position: absolute; top: 8px; right: 8px; width: 22px; height: 22px; border-radius: 50%; background: rgba(0,0,0,0.05); color: rgba(0,0,0,0.5); border: none; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; line-height: 22px; z-index: 2;}
            .close-btn:hover { background: rgba(0,0,0,0.1); color: #000; }
            .panel-header { font-size: 13px; font-weight: 600; color: #555; text-align: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(0, 0, 0, 0.1); }
            .info-line { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; font-size: 14px; }
            .info-line:last-child { margin-bottom: 0; }
            .info-label { font-weight: 400; color: #666; }
            .info-value { font-weight: 600; color: #222; }
            .cache-HIT { color: #059669 !important; }
            .cache-MISS { color: #be185d !important; }
        `;
    }
    function createDisplayPanel(info) {
        if (!info || document.getElementById('cdn-info-host-enhanced')) return;
        const host = document.createElement('div'); host.id = 'cdn-info-host-enhanced'; document.body.appendChild(host);
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const styleEl = document.createElement('style'); styleEl.textContent = getPanelCSS(); shadowRoot.appendChild(styleEl);
        const panel = document.createElement('div'); panel.id = 'cdn-info-panel-enhanced';
        const cacheStatus = info.cache.toUpperCase();
        const providerLabel = info.provider.includes('CDN') || info.provider.includes('Cloud') || info.provider.includes('Edge') ? 'CDN Provider' : 'Server';
        panel.innerHTML = `
            <button class="close-btn" title="Close">×</button>
            <div class="panel-header">CDN & Server Information</div>
            <div class="info-line"> <span class="info-label">${providerLabel}</span> <span class="info-value" title="${info.provider}">${info.provider}</span> </div>
            <div class="info-line"> <span class="info-label">Cache Status</span> <span class="info-value ${cacheStatus.includes('HIT') ? 'cache-HIT' : 'cache-MISS'}">${info.cache}</span> </div>
            <div class="info-line"> <span class="info-label">POP Location</span> <span class="info-value" title="${info.pop}">${info.pop}</span> </div>
        `;
        shadowRoot.appendChild(panel);
        shadowRoot.querySelector('.close-btn').addEventListener('click', (e) => { e.stopPropagation(); host.remove(); });
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
        const currentHref=window.location.href;const status=window.cdnScriptStatus;if(status[currentHref]==='succeeded'||shouldExcludePage()||document.getElementById('cdn-info-host-enhanced')){return;}console.log(`[CDN Detector] Attempting to fetch headers... Retries left: ${retriesLeft}`);try{const response=await fetch(currentHref,{method:'HEAD',cache:'no-store',redirect:'follow',headers:{'User-Agent':navigator.userAgent,'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',}});const info=parseInfo(response.headers);createDisplayPanel(info);status[currentHref]='succeeded';console.log('[CDN Detector] Success! Panel created.');}catch(error){console.warn(`[CDN Detector] Fetch failed: ${error.message}. This often indicates an active security challenge.`);status[currentHref]='retrying';if(retriesLeft>0){console.log(`[CDN Detector] Retrying in ${config.retry_delay/1000} seconds...`);setTimeout(()=>runExecution(retriesLeft-1),config.retry_delay);}else{console.error('[CDN Detector] Max retries reached. Aborting for this page.');status[currentHref]='failed';}}
    }
    function main() {
        setTimeout(()=>{runExecution(config.max_retries);},config.initial_delay);let lastUrl=location.href;const observer=new MutationObserver(()=>{if(location.href!==lastUrl){console.log('[CDN Detector] URL changed (SPA), resetting...');lastUrl=location.href;const oldPanel=document.getElementById('cdn-info-host-enhanced');if(oldPanel)oldPanel.remove();setTimeout(()=>{runExecution(config.max_retries);},config.initial_delay);}});if(document.body){observer.observe(document.body,{childList:true,subtree:true});}else{new MutationObserver((_,obs)=>{if(document.body){observer.observe(document.body,{childList:true,subtree:true});obs.disconnect();}}).observe(document.documentElement,{childList:true});}
    }

    main();

})();
