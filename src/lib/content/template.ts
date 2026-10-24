const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

export type TemplateValues = Record<string, string | number>;

const numberFormat = new Intl.NumberFormat('en-US');

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** The {placeholder} names used in a template, in order of first appearance. */
export function templateKeys(template: string): string[] {
  const keys: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    const key = match[1];
    if (key !== undefined && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

/** Fills {placeholders}. Numbers are formatted for display. A missing value throws, so a typo can't ship. */
export function renderTemplate(template: string, values: TemplateValues): string {
  return template.replace(PLACEHOLDER, (_match, key: string) => {
    const value = values[key];
    if (value === undefined) {
      throw new Error(`Template placeholder {${key}} has no value: "${template}"`);
    }
    return typeof value === 'number' ? formatNumber(value) : value;
  });
}
