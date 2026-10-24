import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { HtmlTagDescriptor, Plugin } from 'vite';
import { overviewTitle } from '../src/lib/content/titles.ts';
import { colors, cssVariables } from '../src/theme/tokens.ts';

interface SiteHead {
  productName: string;
  tagline: string;
  description: string;
  indexable: boolean;
}

const siteJson = fileURLToPath(new URL('../src/generated/site.json', import.meta.url));

/**
 * Fills the document head from content/site.yaml and the design tokens, so index.html carries no copy of its
 * own: the title, description and robots tag come from content, and the CSS variables come from tokens.ts.
 */
export function sitePlugin(): Plugin {
  return {
    name: 'a365-site-head',
    transformIndexHtml(html) {
      const site = JSON.parse(readFileSync(siteJson, 'utf8')) as SiteHead;
      const title = overviewTitle(site).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const tags: HtmlTagDescriptor[] = [
        {
          tag: 'style',
          attrs: { id: 'design-tokens' },
          children: cssVariables(),
          injectTo: 'head-prepend',
        },
        {
          tag: 'meta',
          attrs: { name: 'description', content: site.description },
          injectTo: 'head',
        },
        { tag: 'meta', attrs: { name: 'theme-color', content: colors.paper }, injectTo: 'head' },
      ];
      if (!site.indexable) {
        tags.push({
          tag: 'meta',
          attrs: { name: 'robots', content: 'noindex, nofollow' },
          injectTo: 'head',
        });
      }
      return { html: html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`), tags };
    },
  };
}
