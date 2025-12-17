// ==UserScript==
// @name         CDN & Server Info Displayer (UI Overhaul)
// @name:en      CDN & Server Info Displayer (UI Overhaul)
// @namespace    http://tampermonkey.net/
// @version      7.3.0
// @description  [v7.3.0] Enhanced Glassmorphism UI with auto system theme detection. Improved visual effects with gradient borders and backdrop blur.
// @description:en [v7.3.0] Enhanced Glassmorphism UI with auto system theme detection. Improved visual effects with gradient borders and backdrop blur.
// @author       Zhou Sulong
// @license      MIT
// @match        *://*/*
// @downloadURL  https://raw.githubusercontent.com/zhousulong/cdn-server-info-userscript/main/cdn-server-info.user.js
// @updateURL    https://raw.githubusercontent.com/zhousulong/cdn-server-info-userscript/main/cdn-server-info.user.js
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_getResourceText
// @resource     cdn_rules https://raw.githubusercontent.com/zhousulong/cdn-server-info-userscript/main/cdn_rules.json?v=7.2.4
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

    // --- UI & Execution Functions ---

    // Detect if the current page is using dark or light theme
    function detectPageTheme() {
        try {
            // Method 1: Check color-scheme meta tag or CSS property
            const colorScheme = getComputedStyle(document.documentElement).colorScheme;
            if (colorScheme && colorScheme.includes('dark')) return 'dark';
            if (colorScheme && colorScheme.includes('light')) return 'light';

            // Method 2: Analyze background color brightness
            const bgColor = getComputedStyle(document.body).backgroundColor;
            if (!bgColor || bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') {
                // Fallback to html element
                const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
                if (htmlBg && htmlBg !== 'transparent' && htmlBg !== 'rgba(0, 0, 0, 0)') {
                    return calculateBrightness(htmlBg) < 128 ? 'dark' : 'light';
                }
                return null; // Cannot determine
            }

            // Calculate brightness: if < 128, it's dark
            return calculateBrightness(bgColor) < 128 ? 'dark' : 'light';
        } catch (e) {
            return null; // Error, cannot determine
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
        const useSystemTheme = config.settings.theme === 'auto' || !config.settings.theme;

        let isDarkTheme;
        if (useSystemTheme) {
            // Priority: Page theme > System theme
            const pageTheme = detectPageTheme();
            if (pageTheme) {
                isDarkTheme = pageTheme === 'dark';
            } else {
                // Fallback to system preference
                isDarkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
            }
        } else {
            isDarkTheme = config.settings.theme === 'dark';
        }

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
        :host {
            all: initial;
            position: fixed;
            z-index: 2147483647;
            ${getPositionCSS()}
            font-family: ${uiFont};
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        #cdn-info-panel-enhanced {
            position: relative;
            width: 220px; /* Extremely compact */
            padding: 14px 16px; /* Tight, balanced padding */
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

        #cdn-info-panel-enhanced > * { position: relative; z-index: 2; }

        /* --- Buttons (Hidden by default) --- */
        button.icon-btn {
            position: absolute !important;
            top: 13px !important; /* Visual alignment with header */
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
        }

        button.close-btn { right: 12px !important; font-size: 16px !important; font-weight: 300 !important; line-height: 18px !important; }
        button.theme-btn { right: 36px !important; font-size: 12px !important; line-height: 18px !important; }

        #cdn-info-panel-enhanced:hover button.icon-btn { opacity: 0.5 !important; }
        button.icon-btn:hover { opacity: 1 !important; transform: scale(1.1); }

        /* --- Content Typography --- */
        .panel-header {
            font-family: ${uiFont};
            font-size: 10px;
            font-weight: 700;
            color: ${isDarkTheme ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)'};
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 2px;
            padding-left: 2px;
        }

        .info-lines-container {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .info-line {
            display: flex;
            justify-content: space-between;
            align-items: baseline; /* Baseline alignment is key for mixed fonts */
            margin: 0;
            padding: 0;
            border: none; /* Removed dividers for cleaner look */
        }

        .info-label {
            font-family: ${uiFont};
            font-size: 11px;
            font-weight: 500;
            color: ${isDarkTheme ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'};
            letter-spacing: 0px;
        }

        .info-value {
            font-family: ${monoFont}; /* Mono for data */
            font-size: 11px;
            font-weight: 500;
            color: ${textColor};
            text-align: right;
            opacity: 0.95;
            letter-spacing: -0.2px; /* Tighter mono spacing */
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 140px; /* Text truncation constraint */
        }

        .cache-HIT { color: ${greenColor} !important; }
        .cache-MISS { color: ${redColor} !important; }
        .cache-BYPASS, .cache-DYNAMIC { color: ${blueColor} !important; }

        
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
        const themeIcon = config.settings.theme === 'light' ? '☀️' : (config.settings.theme === 'dark' ? '🌙' : '🌓');

        let panelContent = `
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

            // Cycle themes: auto -> dark -> light -> auto
            const current = config.settings.theme;
            if (current === 'auto' || !current) config.settings.theme = 'dark';
            else if (current === 'dark') config.settings.theme = 'light';
            else config.settings.theme = 'auto';

            // Save settings
            if (typeof GM_setValue !== 'undefined') {
                GM_setValue('cdnInfoSettings', JSON.stringify(config.settings));
            }

            // Update icon immediately
            const newIcon = config.settings.theme === 'light' ? '☀️' : (config.settings.theme === 'dark' ? '🌙' : '🌓');
            shadowRoot.querySelector('.theme-btn').textContent = newIcon;

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
        let themeCheckTimeout;

        const pageThemeObserver = new MutationObserver(() => {
            // Debounce: only check after 300ms of no changes
            clearTimeout(themeCheckTimeout);
            themeCheckTimeout = setTimeout(() => {
                if (config.settings.theme === 'auto' || !config.settings.theme) {
                    const currentPageTheme = detectPageTheme();
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
