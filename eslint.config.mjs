import {defineConfig} from "eslint/config";
import typescriptParser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
    ...obsidianmd.configs.recommended,
    {
        files: ["**/*.ts"],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {project: "./tsconfig.json"},
        },
    },

]);