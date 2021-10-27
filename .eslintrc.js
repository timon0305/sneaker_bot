module.exports = {
  env: {
    browser: true,
    es6: true,
    commonjs: true,
    node: true,
  },
  extends: ['plugin:@typescript-eslint/recommended', 'plugin:react/recommended', 'airbnb'],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  plugins: ['react'],
  rules: {
    'max-len': ['error', { code: 200 }],
    'no-console': 'off',
    'linebreak-style': 'off',
    'lines-between-class-members': 'off',
    'object-curly-newline': 'off',
    'react/jsx-filename-extension': [1, { extensions: ['.js', '.jsx'] }],
    'import/no-extraneous-dependencies': 'off',
    'no-async-promise-executor': 'off',
    'react/state-in-constructor': 'off',
    'import/extensions': [
      'error',
      'always',
      {
        ts: 'never',
        tsx: 'never',
        js: 'never',
        jsx: 'never',
      },
    ],
    camelcase: 'warn',
    '@typescript-eslint/camelcase': ['warn'],
    'no-underscore-dangle': 'warn',
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
};
