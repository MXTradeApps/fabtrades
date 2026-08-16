export default {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/__mocks__/fileMock.js',
    },
    transform: {
        '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
            presets: [
                '@babel/preset-env',
                ['@babel/preset-react', { runtime: 'automatic' }],
            ],
        }],
    },
    testMatch: [
        '<rootDir>/tests/**/*.{js,jsx,ts,tsx}',
    ],
    // Only collect coverage from the modules exercised by the unit suite.
    // UI components and modules that depend on `import.meta` (Vite/Supabase
    // boundaries) are intentionally excluded so `--coverage` stays meaningful
    // and doesn't fail on files the suite deliberately mocks out.
    collectCoverageFrom: [
        'src/utils/trade.js',
        'src/utils/helpers.js',
        'src/utils/setSlug.js',
        'src/utils/searchUtils.js',
        'src/utils/urlEncoding.js',
        'src/utils/tradeItems.js',
        'src/hooks/useTradeState.js',
        'src/hooks/useSearch.js',
        'src/services/tradeHistory.js',
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/build/',
        '/tests/fixtures/',
    ],
    moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
    transformIgnorePatterns: [
        '/node_modules/(?!(@mui|@babel)/)',
    ],
    testTimeout: 10000,
    verbose: true,
    collectCoverage: false,
    coverageReporters: ['text', 'lcov', 'html'],
    coverageDirectory: 'coverage',
};
