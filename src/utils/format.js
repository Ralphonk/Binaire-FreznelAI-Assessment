export const clean = (value) =>
  String(value ?? "").replace(/[\x00-\x1f\x7f-\x9f]/g, " ");
export function bytes(value) {
  if (!Number.isFinite(value) || value < 0) return "N/A";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(i ? 1 : 0)} ${units[i]}`;
}
export const percent = (value) =>
  Number.isFinite(value) && value >= 0 ? `${value.toFixed(1)}%` : "N/A";
export function bar(value, width = 20) {
  const filled = Math.round(
    (Math.max(0, Math.min(100, value || 0)) / 100) * width,
  );
  return "█".repeat(filled) + "░".repeat(width - filled);
}
export function graph(values, width, height) {
  const samples = values.slice(-Math.max(1, width));
  return Array.from({ length: height }, (_, row) =>
    samples
      .map((v) => (v >= ((height - row) * 100) / height ? "█" : " "))
      .join(""),
  ).join("\n");
}
