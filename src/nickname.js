export function normalizeNickname(value) {
  return Array.from(value.trim()).slice(0, 12).join('');
}
