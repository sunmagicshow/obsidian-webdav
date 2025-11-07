import { Locale, LangPacks } from './types';
import en from './locales/en';
import zh from './locales/zh';
import { App } from 'obsidian';

// 所有语言包
export const locales: LangPacks = {
	en,
	zh
};

// 默认语言
export const DEFAULT_LOCALE: Locale = 'en';

// 存储键名
const LANGUAGE_STORAGE_KEY = 'plugin-language';

// 获取系统语言（需要传入 App 实例）
export function getSystemLocale(app: App): Locale {
	try {
		// 首先尝试从插件存储中读取
		const storedLanguage = app.loadLocalStorage(LANGUAGE_STORAGE_KEY);
		if (storedLanguage && isValidLocale(storedLanguage)) {
			return storedLanguage;
		}

		// 如果没有存储的值，使用浏览器语言
		const browserLanguage = navigator.language || navigator.languages[0];

		if (browserLanguage?.startsWith('zh')) {
			return 'zh';
		}
		return 'en';
	} catch {
		return DEFAULT_LOCALE;
	}
}

// 保存语言设置到插件存储
export function saveLocaleSetting(app: App, locale: Locale): void {
	try {
		app.saveLocalStorage(LANGUAGE_STORAGE_KEY, locale);
	} catch {
		console.error('Failed to save locale setting');
	}
}

// 验证语言是否支持
export function isValidLocale(locale: string): locale is Locale {
	return locale in locales;
}