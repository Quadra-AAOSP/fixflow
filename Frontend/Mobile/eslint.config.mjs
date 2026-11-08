import ts from 'typescript-eslint';

export default ts.config(
  { ignores: ['**/.expo*/**', '**/android/**', '**/ios/**', '**/dist/**', '**/coverage/**'] },
  {
    files: ['**/*.{ts,tsx,mts}'],
    languageOptions: { parser: ts.parser },
    plugins: { '@typescript-eslint': ts.plugin },
    linterOptions: { noInlineConfig: true },
    rules: {
      'no-debugger': 'error',
      'no-unreachable': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
    },
  },
);
