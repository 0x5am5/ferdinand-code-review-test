import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import hooksPlugin from "eslint-plugin-react-hooks";

export default [
	{
		ignores: ["dist/*", "node_modules/*"],
	},
	// Base JS recommended rules
	eslint.configs.recommended,

	// Node.js files
	{
		files: ["server/**/*.ts", "scripts/**/*.js"],
		languageOptions: {
			globals: {
				process: "readonly",
				Buffer: "readonly",
				__dirname: "readonly",
				__filename: "readonly",
				exports: "writable",
				module: "readonly",
				require: "readonly",
				console: "readonly",
			},
		},
	},

	// TypeScript/React project files
	{
		files: ["**/*.ts", "**/*.tsx"],
		plugins: {
			"@typescript-eslint": tseslint,
			react: reactPlugin,
			"react-hooks": hooksPlugin,
		},
		languageOptions: {
			parser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
				ecmaFeatures: { jsx: true },
			},
			globals: {
				window: "readonly",
				document: "readonly",
				navigator: "readonly",
				localStorage: "readonly",
				sessionStorage: "readonly",
				requestAnimationFrame: "readonly",
				setTimeout: "readonly",
				clearTimeout: "readonly",
				console: "readonly",
				fetch: "readonly",
				FormData: "readonly",
				Blob: "readonly",
				URL: "readonly",
				URLSearchParams: "readonly",
				CustomEvent: "readonly",
				EventListener: "readonly",
				HTMLElement: "readonly",
				HTMLDivElement: "readonly",
				HTMLInputElement: "readonly",
				HTMLButtonElement: "readonly",
				HTMLTextAreaElement: "readonly",
				HTMLSpanElement: "readonly",
				HTMLAnchorElement: "readonly",
				HTMLUListElement: "readonly",
				HTMLLIElement: "readonly",
				HTMLTableElement: "readonly",
				HTMLTableSectionElement: "readonly",
				HTMLTableRowElement: "readonly",
				HTMLTableCellElement: "readonly",
				HTMLTableCaptionElement: "readonly",
				HTMLHeadingElement: "readonly",
				HTMLParagraphElement: "readonly",
				HTMLOListElement: "readonly",
				File: "readonly",
				FileList: "readonly",
				Image: "readonly",
				MouseEvent: "readonly",
				KeyboardEvent: "readonly",
				Response: "readonly",
				RequestInit: "readonly",
			},
		},
		settings: {
			react: { version: "detect" },
		},
		rules: {
			// TS-specific:
			"no-undef": "off",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
			],
			"@typescript-eslint/no-explicit-any": "warn",
			"@typescript-eslint/no-empty-object-type": [
				"warn",
				{ allowInterfaces: "always" },
			],
			"@typescript-eslint/no-require-imports": "off",

			// React:
			"react/react-in-jsx-scope": "off",
			"react/prop-types": "off",
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "warn",

			// Base JS tweaks
			"no-case-declarations": "warn",
			"no-unused-vars": "off",
		},
	},
];
