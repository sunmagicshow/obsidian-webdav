import {defineConfig} from "eslint/config";
import typescriptParser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

export default defineConfig([
    ...obsidianmd.configs.recommended,
    {
        files: ["**/*.ts"],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {project: "./tsconfig.json"},
            globals: {
                ...globals.browser, // 注入所有浏览器全局变量 (window, document, etc.)
                activeDocument: "readonly", // 显式注入 Obsidian 特有的多窗口全局变量
                activeWindow: "readonly",
            },
        },
        rules: {}
    },
]);