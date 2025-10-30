import { Locale, LangPacks } from './types';
import en from './locales/en';
import zh from './locales/zh';

// 所有语言包
export const locales: LangPacks = {
	en,
	zh
};

// 默认语言
export const DEFAULT_LOCALE: Locale = 'en';

// 获取系统语言
export function getSystemLocale(): Locale {
	try {
		const language = localStorage.getItem('language') ||
						navigator.language ||
						navigator.languages[0];

		if (language?.startsWith('zh')) {
			return 'zh';
		}
		return 'en';
	} catch (e) {
		return DEFAULT_LOCALE;
	}
}

// 验证语言是否支持
export function isValidLocale(locale: string): locale is Locale {
	return locale in locales;
}
