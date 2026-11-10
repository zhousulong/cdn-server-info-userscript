module.exports = [
    {
        ignores: ['node_modules/**', 'tools/ip438_cdnfinder_cnames.json'],
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'script',
            globals: {
                // Browser globals
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                console: 'readonly',
                fetch: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                MutationObserver: 'readonly',
                AbortController: 'readonly',
                getComputedStyle: 'readonly',
                RegExp: 'readonly',
                Map: 'readonly',
                Set: 'readonly',
                Promise: 'readonly',
                JSON: 'readonly',
                Object: 'readonly',
                Array: 'readonly',
                String: 'readonly',
                Number: 'readonly',
                Date: 'readonly',
                Math: 'readonly',
                Error: 'readonly',

                // Userscript globals
                GM_addStyle: 'readonly',
                GM_getValue: 'readonly',
                GM_setValue: 'readonly',
                GM_getResourceText: 'readonly',
                GM_xmlhttpRequest: 'readonly',
                GM_info: 'readonly',

                // Node.js globals
                module: 'readonly',
                require: 'readonly',
                process: 'readonly',
                __dirname: 'readonly',
            },
        },
        rules: {
            // Basic rules
            indent: ['error', 4, { SwitchCase: 1 }],
            'linebreak-style': ['error', 'unix'],
            quotes: ['error', 'single'],
            semi: ['error', 'always'],

            // Best practices
            'no-unused-vars': ['warn', { args: 'none' }],
            'no-console': 'off',
            'no-undef': 'error',
        },
    },
];
