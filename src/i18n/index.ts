import { Locale, LangPack } from './types';
import { locales, isValidLocale } from './config';
import { App } from 'obsidian';

// 当前语言
let currentLocale: Locale = 'en'; // 先设置默认值，在插件初始化时会重新设置

// 存储键名
const LANGUAGE_STORAGE_KEY = 'webdav-plugin-language';

export function setI18n(locale: Locale | string): void {
	if (isValidLocale(locale)) {
		currentLocale = locale;
	} else {
		console.warn(`Unsupported locale: ${locale}, falling back to default`);
		currentLocale = 'en';
	}
}

// 初始化语言设置（需要在插件初始化时调用）
export function initI18n(app: App): void {
	currentLocale = getSystemLocale(app);
}

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
	} catch (e) {
		console.error('Failed to load locale setting:', e);
		return 'en';
	}
}

// 保存语言设置到插件存储
export function saveLocaleSetting(app: App, locale: Locale): void {
	try {
		app.saveLocalStorage(LANGUAGE_STORAGE_KEY, locale);
	} catch (e) {
		console.error('Failed to save locale setting:', e);
	}
}

// 获取当前语言包
export function i18n(): LangPack {
	return locales[currentLocale];
}

// 获取当前语言
export function getCurrentLocale(): Locale {
	return currentLocale;
}

// 获取所有支持的语言
export function getSupportedLocales(): Locale[] {
	return Object.keys(locales) as Locale[];
}

// 重新导出类型
export type { Locale, LangPack, SettingItem } from './types';