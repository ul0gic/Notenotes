export function compareAppVersions(a, b) {
  const left = versionParts(a);
  const right = versionParts(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const leftPart = left[i] || 0;
    const rightPart = right[i] || 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }
  return 0;
}

export function latestVersionFromSourceText(text = '') {
  const match = String(text).match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  return match ? match[1].trim() : '';
}

function versionParts(version = '') {
  return String(version)
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map(part => {
      const match = String(part).match(/^\d+/);
      return match ? Number(match[0]) : 0;
    });
}

