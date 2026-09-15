export function generateOrderCode(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `#${n}`;
}
