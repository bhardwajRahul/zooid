import fs from 'node:fs';

/**
 * Set or remove a variable in a wrangler.toml [vars] section.
 * JSON values are single-quoted to avoid TOML escaping issues.
 * Pass null to remove the variable.
 */
export function setWranglerVar(
  tomlPath: string,
  key: string,
  value: string | null,
): void {
  const content = fs.readFileSync(tomlPath, 'utf-8');
  const lines = content.split('\n');

  // Find [vars] section
  let varsStart = -1;
  let varsEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (/^\[vars\]\s*$/.test(lines[i])) {
      varsStart = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^\[/.test(lines[j]) && !/^\[vars\]/.test(lines[j])) {
          varsEnd = j;
          break;
        }
      }
      break;
    }
  }

  // Find existing line for this key
  const keyPattern = new RegExp(`^${key}\\s*=`);
  let existingLine = -1;
  const searchStart = varsStart >= 0 ? varsStart + 1 : 0;
  const searchEnd = varsStart >= 0 ? varsEnd : lines.length;

  for (let i = searchStart; i < searchEnd; i++) {
    if (keyPattern.test(lines[i])) {
      existingLine = i;
      break;
    }
  }

  if (value === null) {
    if (existingLine >= 0) {
      lines.splice(existingLine, 1);
    }
  } else {
    const newLine = `${key} = '${value}'`;

    if (existingLine >= 0) {
      lines[existingLine] = newLine;
    } else if (varsStart >= 0) {
      lines.splice(varsStart + 1, 0, newLine);
    } else {
      lines.push('', '[vars]', newLine);
    }
  }

  fs.writeFileSync(tomlPath, lines.join('\n'));
}
