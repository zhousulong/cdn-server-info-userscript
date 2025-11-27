# Implementation Plan - Independent Database Refactoring

## Goal Description
Refactor the `cdn-server-info-userscript` to separate the CDN detection rules from the main logic code. This allows for easier updates, independent management of rules (via a JSON file), and the ability to scrape/import rules from external sources like Wappalyzer.

## Proposed Changes

### [Data Layer]
#### [NEW] [cdn_rules.json](file:///Users/zhousulong/LocalFiles/GitHub/cdn-server-info-userscript/cdn_rules.json)
- A JSON file containing declarative rules for CDN detection.
- Structure includes `headers`, `server`, `cookies`, `priority`, and extraction hints (`pop_header`, `id_header`, `pop_regex`).

### [Tooling]
#### [NEW] [tools/update_rules.js](file:///Users/zhousulong/LocalFiles/GitHub/cdn-server-info-userscript/tools/update_rules.js)
- A Node.js script to manage `cdn_rules.json`.
- Supports importing rules from Wappalyzer-format JSON files.
- Future support for fetching rules from remote URLs.

### [Userscript]
#### [MODIFY] [cdn-server-info.user.js](file:///Users/zhousulong/LocalFiles/GitHub/cdn-server-info-userscript/cdn-server-info.user.js)
- **Metadata**: Added `@resource cdn_rules` to load the external JSON file.
- **Logic**:
    - Removed hardcoded `cdnProviders` object.
    - Added `loadRules()` function to parse the JSON resource.
    - Implemented a dynamic detection loop that iterates over the loaded rules.
    - Retained `customHandlers` for providers requiring complex logic (Akamai, Tencent EdgeOne, ByteDance).
    - Added `genericGetInfo` for standard providers based on JSON hints.

## Verification Plan

### Manual Verification
1.  **Load Script**: Install the updated userscript in Tampermonkey.
2.  **Check Rules**: Verify that the script loads `cdn_rules.json` (check console logs for "[CDN Info] Loaded rules from resource").
3.  **Test Detection**: Visit sites using known CDNs (e.g., Cloudflare, Akamai) and verify the panel appears with correct info.
4.  **Test Updates**: Modify `cdn_rules.json` locally or via the update script and verify changes are reflected after script reload.

### Automated Tests (Future)
- Unit tests for `update_rules.js` to ensure Wappalyzer import logic works correctly.
