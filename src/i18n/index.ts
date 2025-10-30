import { Locale, LangPack } from './types';
import { locales, getSystemLocale, isValidLocale } from './config';

// 当前语言
let currentLocale: Locale = getSystemLocale();

// 设置语言
export function setI18n(locale: Locale): void;
export function setI18n(locale: string): void;
export function setI18n(locale: Locale | string): void {
	if (isValidLocale(locale)) {
		currentLocale = locale;
	} else {
		console.warn(`Unsupported locale: ${locale}, falling back to system locale`);
		currentLocale = getSystemLocale();
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
