const fs = require('fs');
const path = require('path');
const https = require('https');

const RULES_FILE = path.join(__dirname, '../cdn_rules.json');

// Helper to fetch JSON from URL
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// Helper to load local JSON
function loadJson(filePath) {
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return {};
}

// Merge logic
function mergeRules(currentRules, newRules) {
    const merged = { ...currentRules };
    let addedCount = 0;

    for (const [name, rule] of Object.entries(newRules)) {
        if (!merged[name]) {
            merged[name] = rule;
            addedCount++;
            console.log(`Added new provider: ${name}`);
        } else {
            // Merge headers
            if (rule.headers) {
                merged[name].headers = { ...merged[name].headers, ...rule.headers };
            }
            // Merge other fields if missing
            if (rule.server && !merged[name].server) merged[name].server = rule.server;
            if (rule.priority && !merged[name].priority) merged[name].priority = rule.priority;
        }
    }
    return { merged, addedCount };
}

// Wappalyzer Parser (Generic)
function parseWappalyzer(wappalyzerData) {
    const extracted = {};
    
    for (const [name, data] of Object.entries(wappalyzerData)) {
        // Check if it's a CDN (Category 31)
        // Wappalyzer format: { "cats": [31], "headers": { ... }, "cookies": { ... } }
        const categories = data.cats || data.categories || [];
        if (categories.includes(31)) {
            const rule = {
                headers: {},
                priority: 5 // Default
            };

            if (data.headers) {
                for (const [hName, hVal] of Object.entries(data.headers)) {
                    rule.headers[hName.toLowerCase()] = hVal || null;
                }
            }
            if (data.cookies) {
                rule.cookies = {};
                for (const [cName, cVal] of Object.entries(data.cookies)) {
                    rule.cookies[cName] = cVal || null;
                }
            }
            
            // Only add if we have some detection logic
            if (Object.keys(rule.headers).length > 0 || rule.cookies) {
                extracted[name] = rule;
            }
        }
    }
    return extracted;
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const source = args[1];

    if (command === 'import-wappalyzer') {
        if (!source) {
            console.error('Usage: node update_rules.js import-wappalyzer <path_to_wappalyzer_json>');
            process.exit(1);
        }
        
        console.log(`Reading Wappalyzer data from ${source}...`);
        const wappalyzerData = loadJson(source);
        const newRules = parseWappalyzer(wappalyzerData);
        
        console.log(`Found ${Object.keys(newRules).length} CDN providers in source.`);
        
        const currentRules = loadJson(RULES_FILE);
        const { merged, addedCount } = mergeRules(currentRules, newRules);
        
        fs.writeFileSync(RULES_FILE, JSON.stringify(merged, null, 2));
        console.log(`Successfully merged rules. Added ${addedCount} new providers.`);
        
    } else if (command === 'fetch-remote') {
        // Placeholder for fetching from a known URL if we find one
        console.log('Fetching from remote source...');
        // Example: const data = await fetchJson('https://example.com/cdn_rules.json');
        // mergeRules(currentRules, data);
        console.log('Remote fetch not configured yet. Please use import-wappalyzer with a local file.');
    } else {
        console.log('Usage:');
        console.log('  node update_rules.js import-wappalyzer <file>');
        console.log('  node update_rules.js fetch-remote');
    }
}

main().catch(console.error);
