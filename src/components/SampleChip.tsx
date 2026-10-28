import { content } from '../lib/content/index.ts';
import { Badge } from './Badge.tsx';

/** Marks data that belongs to the fictional sample customer, so nobody mistakes it for a real customer's. */
export function SampleChip() {
  return <Badge tone="amber">{content.site.ui.sample.chip}</Badge>;
}
