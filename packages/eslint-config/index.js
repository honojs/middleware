import js from '@eslint/js'
import importX from 'eslint-plugin-import-x'
import nodePlugin from 'eslint-plugin-n'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import tseslint from 'typescript-eslint'

export default [
  js.configs.recommended,
  nodePlugin.configs.recommended,
  tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
	{
		plugins: {
			'@typescript-eslint': tseslint.plugin,
			'import-x': importX,
		},

		languageOptions: {
			globals: {
				fetch: false,
				Response: false,
				Request: false,
				addEventListener: false,
			},

			parser: tseslint.parser,
			ecmaVersion: 2021,
			sourceType: 'module',
		},

		rules: {
			curly: ['error', 'all'],
			quotes: ['error', 'single'],
			semi: ['error', 'never'],
			'no-debugger': ['error'],

			'no-empty': [
				'warn',
				{
					allowEmptyCatch: true,
				},
			],

			'no-process-exit': 'off',
			'no-useless-escape': 'off',

			'prefer-const': [
				'warn',
				{
					destructuring: 'all',
				},
			],

			'import-x/consistent-type-specifier-style': ['error', 'prefer-top-level'],
			'import-x/order': [
				'error',
				{
					groups: [
						'external',
						'builtin',
						'internal',
						'parent',
						'sibling',
						'index',
					],
					alphabetize: {
						order: 'asc',
						caseInsensitive: true,
					},
				},
			],
			'import-x/no-duplicates': 'error',

			'n/no-missing-import': 'off',
			'n/no-missing-require': 'off',
			'n/no-deprecated-api': 'off',
			'n/no-unpublished-import': 'off',
			'n/no-unpublished-require': 'off',
			'n/no-unsupported-features/es-syntax': 'off',
			'n/no-unsupported-features/node-builtins': 'off',

			'@typescript-eslint/consistent-type-imports': [
				'error',
				{
					prefer: 'type-imports',
				},
			],
			'@typescript-eslint/no-empty-object-type': 'off',
			'@typescript-eslint/no-unsafe-function-type': 'off',
			'@typescript-eslint/no-empty-function': [
				'error',
				{
					allow: ['arrowFunctions'],
				},
			],
			'@typescript-eslint/no-unused-expressions': 'off',
			'@typescript-eslint/no-empty-interface': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-inferrable-types': 'off',
			'@typescript-eslint/no-require-imports': 'off',
			'@typescript-eslint/no-unused-vars': 'warn',
			'@typescript-eslint/no-var-requires': 'off',
		},
	},
]
