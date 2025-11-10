export const formatBytes = (
  bytes?: number | null,
  decimals = 1,
): string | undefined => {
  if (!bytes || bytes <= 0) {
    return undefined;
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  const formatted =
    unitIndex === 0 ? Math.round(value).toString() : value.toFixed(decimals);

  return `${formatted} ${units[unitIndex]}`;
};

