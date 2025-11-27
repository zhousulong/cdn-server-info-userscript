// ==UserScript==
// @name         CDN & Server Info Displayer (UI Overhaul)
// @name:en      CDN & Server Info Displayer (UI Overhaul)
// @namespace    http://tampermonkey.net/
// @version      6.1.1
// @description  [v6.1.1 Author Update] Updated author name and optimized font sizes for better CDN name display.
// @description:en [v6.1.1 Author Update] Updated author name and optimized font sizes for better CDN name display.
// @author       Zhou Sulong
// @license      MIT
// @match        *://*/*
// @downloadURL  https://raw.githubusercontent.com/zhousulong/cdn-server-info-userscript/main/cdn-server-info.user.js
// @updateURL    https://raw.githubusercontent.com/zhousulong/cdn-server-info-userscript/main/cdn-server-info.user.js
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_getResourceText
// @resource     cdn_rules https://raw.githubusercontent.com/zhousulong/cdn-server-info-userscript/main/cdn_rules.json
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
            theme: 'dark', // 'dark' or 'light'
            panelPosition: 'bottom-right', // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
            showExtraInfo: true,
            excludedUrls: [],
        },
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
        'Tencent EdgeOne': {
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
                    provider: 'Tencent EdgeOne',
                    cache: cache,
                    pop: 'N/A',
                    extra: `Log-UUID: ${logUuid}`,
                };
            }
        },
        'ByteDance CDN': {
            getInfo: (h, rule) => {
                let cache = 'N/A';
                const ttTrace = h.get('x-tt-trace-tag');
                if (ttTrace) {
                    const match = ttTrace.match(/cdn-cache=([^;]+)/);
                    if (match) cache = match[1].toUpperCase();
                }
                if (cache === 'N/A') {
                    const serverTiming = h.get('server-timing');
                    if (serverTiming) {
                        const match = serverTiming.match(/cdn-cache;desc=([^,]+)/);
                        if (match) cache = match[1].toUpperCase();
                    }
                }
                if (cache === 'N/A') cache = getCacheStatus(h);

                let pop = 'N/A';
                const viaHeader = h.get('via');
                if (viaHeader) {
                    const viaParts = viaHeader.split(',');
                    for (let i = viaParts.length - 1; i >= 0; i--) {
                        const part = viaParts[i].trim();
                        const cityMatch = part.match(/\.([a-zA-Z]+)/);
                        if (cityMatch && cityMatch[1]) {
                            if (!/cn\d+/.test(cityMatch[1])) {
                                pop = cityMatch[1].split('-')[0].toUpperCase();
                                break;
                            }
                        }
                        const internalCodeMatch = part.match(/\b([a-z]*cn\d+)\b/i);
                        if (internalCodeMatch && internalCodeMatch[1]) {
                            pop = 'CN';
                            break;
                        }
                    }
                }
                return {
                    provider: 'ByteDance CDN',
                    cache,
                    pop,
                    extra: `Trace Tag: ${h.get('x-tt-trace-tag') || 'N/A'}`,
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
                    const match = val.match(new RegExp(rule.pop_regex));
                    if (match && match[1]) pop = match[1].toUpperCase();
                } else {
                    pop = val.trim().split(/[-_]/).pop().toUpperCase(); // Default heuristic
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

    // --- UI & Execution Functions ---
    function getPanelCSS() {
        const isDarkTheme = config.settings.theme === 'dark';
        const bgColor = isDarkTheme ? 'rgba(25, 25, 25, 0.7)' : 'rgba(255, 255, 255, 0.7)';
        const borderColor = isDarkTheme ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
        const textColor = isDarkTheme ? '#ffffff' : '#000000';
        const labelColor = isDarkTheme ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
        const backdropFilter = 'blur(20px)'; // iOS-style blur effect
        const boxShadow = isDarkTheme
            ? '0 10px 30px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.1)'
            : '0 10px 30px rgba(0, 0, 0, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.5)';

        return `
            :host {
                all: initial;
                position: fixed;
                z-index: 2147483647;
                ${getPositionCSS()}
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            #cdn-info-panel-enhanced {
                position: relative;
                min-width: 200px;
                max-width: 300px;
                padding: 14px;
                border-radius: 20px;
                background-color: ${bgColor};
                border: 1px solid ${borderColor};
                box-shadow: ${boxShadow};
                backdrop-filter: ${backdropFilter};
                -webkit-backdrop-filter: ${backdropFilter};
                cursor: move;
                user-select: none;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }
            #cdn-info-panel-enhanced:hover {
                transform: translateY(-2px);
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
            }
            .close-btn {
                position: absolute; 
                top: 8px; 
                right: 8px;
                width: 22px; 
                height: 22px;
                border-radius: 50%;
                background: transparent;
                color: ${labelColor};
                border: none; 
                cursor: pointer;
                font-size: 16px;
                line-height: 22px;
                display: flex; 
                align-items: center; 
                justify-content: center;
                transition: all 0.2s;
                z-index: 2;
            }
            .close-btn:hover { 
                background: ${isDarkTheme ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}; 
                color: ${textColor}; 
            }
            .panel-header {
                font-size: 12px;
                font-weight: 600;
                color: ${labelColor};
                text-align: center;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid ${borderColor};
                text-transform: uppercase;
                letter-spacing: 0.5px;
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
                color: ${labelColor};
                font-weight: 500;
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .info-value {
                color: ${textColor};
                font-weight: 600;
                text-align: right;
                flex: 1.5;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-family: -apple-system, BlinkMacSystemFont, 'SF Mono', 'Menlo', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
                font-size: 12px;
            }
            .cache-HIT { color: #34C759 !important; }
            .cache-MISS { color: #FF2D55 !important; }
            .cache-BYPASS, .cache-DYNAMIC { color: #0A84FF !important; }
            
            /* Settings panel styles */
            #settings-panel {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 300px;
                padding: 18px;
                border-radius: 20px;
                background-color: ${bgColor};
                border: 1px solid ${borderColor};
                box-shadow: ${boxShadow};
                backdrop-filter: ${backdropFilter};
                -webkit-backdrop-filter: ${backdropFilter};
                z-index: 2147483648;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            #settings-panel h3 {
                margin-top: 0;
                color: ${textColor};
                text-align: center;
                font-size: 16px;
                font-weight: 600;
            }
            .setting-item {
                margin-bottom: 16px;
            }
            .setting-item label {
                display: block;
                margin-bottom: 5px;
                color: ${labelColor};
                font-weight: 500;
                font-size: 13px;
            }
            .setting-item select, .setting-item input {
                width: 100%;
                padding: 8px 10px;
                border-radius: 12px;
                border: 1px solid ${borderColor};
                background-color: ${isDarkTheme ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)'};
                color: ${textColor};
                font-size: 13px;
                box-sizing: border-box;
            }
            .setting-buttons {
                display: flex;
                justify-content: space-between;
                margin-top: 20px;
            }
            .setting-btn {
                padding: 8px 16px;
                border-radius: 12px;
                border: none;
                cursor: pointer;
                font-weight: 600;
                font-size: 14px;
                flex: 1;
                margin: 0 4px;
            }
            .save-btn {
                background-color: #0A84FF;
                color: white;
            }
            .cancel-btn {
                background-color: ${labelColor};
                color: ${bgColor};
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
        styleEl.textContent = getPanelCSS();
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

        // Build panel content - keep it concise
        let panelContent = `
            <button class="close-btn" title="Close">×</button>
            <div class="panel-header">CDN & Server Info</div>
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

        panel.innerHTML = panelContent;
        shadowRoot.appendChild(panel);
        shadowRoot.querySelector('.close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            host.remove();
        });

        // Add settings button (right click on panel to open settings)
        panel.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            createSettingsPanel();
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
                }
            } catch (e) {
                console.warn('[CDN Detector] Failed to load user settings:', e);
            }
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
    }

    main();
})();
