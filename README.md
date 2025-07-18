# CDN & Server Info Userscript

This userscript displays detailed information about the CDN and server of the current website.

## Features

- **Prioritizes Cloud Service Information:** Displays specific cloud provider details instead of generic server messages.
- **Accurate Server Details:** Removes vague and unhelpful server information for a clearer overview.
- **Supports Major CDNs:** Detects a wide range of popular CDN providers.
- **Customizable & Modern UI:** Features a sleek, draggable interface that can be easily positioned on the page.

## Recent Changes

### Version 5.8.4

- **Improved Akamai Detection:** Enhanced Akamai detection by checking for `x-akamai-transformed` and `x-akam-sw-version` headers.
- **Accurate Cache Status:** The script now correctly parses the `server-timing` header to determine the cache status, ensuring greater accuracy.
- **POP Location from `x-served-by`:** The POP location for Akamai is now extracted from the `x-served-by` header.

### Version 5.8.3

- **Bug Fix:** Fixed a critical syntax error that prevented the script from running.

### Version 5.8.2

- **Enhanced Server Information:** Prioritizes cloud service details and removes generic messages for more accurate server identification.
- **Improved Detection Logic:** Updated `cdn-headers.js` to refine server detection and avoid returning generic information.
- **Bug Fixes:** Resolved an issue with an undefined `humbleHeaders` variable and improved error handling for fetch requests.

## Installation

1.  Install a userscript manager like [Tampermonkey](https://www.tampermonkey.net/) or [Greasemonkey](https://www.greasespot.net/).
2.  Click [here](https://raw.githubusercontent.com/zhousulong/cdn-server-info-userscript/main/cdn-server-info.user.js) to install the script.

## Usage

Once installed, the script will automatically display a small panel on the bottom right of most web pages, showing the detected CDN and server information.