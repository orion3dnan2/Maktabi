const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64(bytes: Uint8Array): string {
  let result = ''; for (let i = 0; i < bytes.length; i += 3) { const a = bytes[i]!; const b = bytes[i + 1] ?? 0; const c = bytes[i + 2] ?? 0; result += alphabet[a >> 2]! + alphabet[((a & 3) << 4) | (b >> 4)]! + (i + 1 < bytes.length ? alphabet[((b & 15) << 2) | (c >> 6)]! : '=') + (i + 2 < bytes.length ? alphabet[c & 63]! : '='); } return result;
}
