module.exports = [
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
                MutationObserver: 'readonly',

                // Userscript globals
                GM_addStyle: 'readonly',
                GM_getValue: 'readonly',
                GM_setValue: 'readonly',

                // Node.js globals
                module: 'readonly',
            },
        },
        rules: {
            // Basic rules
            indent: ['error', 4],
            'linebreak-style': ['error', 'unix'],
            quotes: ['error', 'single'],
            semi: ['error', 'always'],

            // Best practices
            'no-unused-vars': 'warn',
            'no-console': 'off',
            'no-undef': 'error',
        },
    },
];
