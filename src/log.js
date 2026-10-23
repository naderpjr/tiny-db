import { createHash } from 'node:crypto';

const checksum = (text) =>
    createHash('sha1').update(text).digest('hex').slice(0, 8);


export function encode(op) {
    const body = JSON.stringify(op);
    return `${checksum(body)} ${body}\n`;
}

export function decode(line) {
    const hash = line.slice(0, 8);
    const body = line.slice(9);
    if (line[8] !== ' ' || checksum(body) !== hash) return null;
    try {
        return JSON.parse(body);
    } catch {
        return null;
    }
}