export function splitOnFirst(string: string, separator: string): [string, string | undefined] {
    if (!(typeof string === 'string' && typeof separator === 'string')) {
        throw new TypeError('Expected the arguments to be of type `string`');
    }

    if (separator === '') {
        return [string, undefined];
    }

    const separatorIndex = string.indexOf(separator);

    if (separatorIndex === -1) {
        return [string, undefined];
    }

    return [
        string.slice(0, separatorIndex),
        string.slice(separatorIndex + separator.length)
    ];
}

export function safeDecodeURIComponent(text: string): string {
    try {
        return decodeURIComponent(text.replace(/\+/g, ' '));
    } catch {
        return text;
    }
}

export function strictUriEncode(text: string): string {
    return encodeURIComponent(text).replace(/[!'()*]/g, (c) =>
        `%${c.charCodeAt(0).toString(16).toUpperCase()}`
    );
}
