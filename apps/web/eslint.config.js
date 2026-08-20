import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
    globalIgnores(['node_modules', 'dist', 'build', 'coverage', '**/*.min.js']),
    {
        files: ['**/*.{js,jsx}'],
        extends: [
            js.configs.recommended,
            reactHooks.configs['recommended-latest'],
            reactRefresh.configs.vite,
        ],
        languageOptions: {
            ecmaVersion: 2020,
            globals: {
                ...globals.browser,
                ...globals.jest,
                // Substituted by vite.config.js at build time: the URL of the
                // catalog snapshot, or null when this build has none.
                __CATALOG_URL__: 'readonly',
            },
            parserOptions: {
                ecmaVersion: 'latest',
                ecmaFeatures: { jsx: true },
                sourceType: 'module',
            },
        },
        rules: {
            'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
        },
    },
    {
        // Node.js build/utility scripts run outside the browser.
        files: ['scripts/**/*.{js,mjs,cjs}', '*.config.js'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
        rules: {
            // Dev-only CLI scripts, where a `let` inside a switch case is clearer
            // than hoisting every declaration above the switch.
            'no-case-declarations': 'off',
        },
    },
    {
        // Test files and Jest setup run in Node, so `global`, `module` and friends
        // are legitimately available.
        files: ['tests/**/*.{js,jsx}', '__mocks__/**/*.js', 'src/setupTests.js'],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
            },
        },
    },
    {
        // The one module that runs in both the browser bundle and Node build
        // scripts, so it legitimately feature-detects `process`.
        files: ['src/config/env.js'],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    {
        // Context and hook modules intentionally export a provider component
        // alongside its hook. Splitting them to satisfy Fast Refresh would spread
        // one concept across two files for no runtime benefit; the cost is losing
        // Fast Refresh on these specific files during development.
        files: [
            'src/contexts/**/*.jsx',
            'src/hooks/**/*.jsx',
            'src/main.jsx',
            'src/components/cardDetail/**/*.jsx',
        ],
        rules: {
            'react-refresh/only-export-components': 'off',
        },
    },
])
