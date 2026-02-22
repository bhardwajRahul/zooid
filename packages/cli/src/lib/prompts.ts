import type readline from 'node:readline/promises';

/** Prompt the user for input with an optional default value. */
export async function ask(
  rl: readline.Interface,
  label: string,
  defaultValue: string,
): Promise<string> {
  const hint = defaultValue ? ` [${defaultValue}]` : '';
  const answer = await rl.question(`  ${label}${hint}: `);
  return answer.trim() || defaultValue;
}
