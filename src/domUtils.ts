import {setIcon} from 'obsidian';

export class DomUtils {
    static withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Request timeout'));
            }, timeoutMs);

            promise.then(
                (result) => {
                    clearTimeout(timeoutId);
                    resolve(result);
                },
                (error) => {
                    clearTimeout(timeoutId);
                    // 使用 Error 构造函数确保返回 Error 对象
                    reject(error instanceof Error ? error : new Error(String(error)));
                }
            );
        });
    }

    static createButton(
        container: HTMLElement,
        icon: string,
        text: string,
        onClick: () => void,
        className: string = ''
    ): HTMLElement {
        const button = container.createEl('div', {cls: `webdav-button ${className}`});
        const content = button.createEl('div', {cls: 'webdav-button-content'});

        const iconEl = content.createSpan({cls: 'webdav-icon'});
        setIcon(iconEl, icon);

        content.createSpan({
            cls: 'webdav-button-text',
            text
        });

        button.onclick = onClick;
        return button;
    }
}