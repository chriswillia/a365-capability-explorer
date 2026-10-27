import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  CONTENT_FILES,
  ChangelogEntrySchema,
  type Content,
  type ContentMeta,
} from '../src/lib/content/schemas.ts';

const compiled = (key: string): unknown =>
  JSON.parse(readFileSync(`src/generated/${key}.json`, 'utf8'));
export const content = {
  ...Object.fromEntries(
    Object.entries(CONTENT_FILES).map(([key, { schema }]) => [key, schema.parse(compiled(key))]),
  ),
  changelog: z.array(ChangelogEntrySchema).parse(compiled('changelog')),
} as Content;
export const contentMeta = compiled('meta') as ContentMeta;
