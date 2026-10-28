import { evaluateCondition } from '../engine/conditions.ts';
import type { Answers, Capability, Content, Licensing } from './schemas.ts';

export type RequirementStatus = 'ready' | 'gap' | 'unknown';
type Item = Content['requirements'][number]['items'][number];
type Without = Licensing['prerequisites']['without'][number];

export interface RequirementItemView {
  item: Item;
  status: RequirementStatus;
}
export interface CapabilityRequirementView {
  capability: Capability;
  items: RequirementItemView[];
  /** What the licensing FAQ says stays unavailable without the underlying licenses. */
  without: Without[];
}

/** An item is in place, a gap or still to confirm. With no answers, or no linked question, it is to confirm. */
export function itemStatus(item: Item, answers: Answers | null): RequirementStatus {
  if (answers === null || item.readyWhen === undefined) return 'unknown';
  const result = evaluateCondition(item.readyWhen, answers);
  return result === null ? 'unknown' : result ? 'ready' : 'gap';
}

/** What every premium capability needs: the Agent 365 license, the plan prerequisites and accepting the terms. */
export function baselineRequirements(
  data: Content,
  answers: Answers | null,
): RequirementItemView[] {
  return data.requirements
    .filter((set) => set.capabilityIds.includes('all'))
    .flatMap((set) => set.items)
    .map((item) => ({ item, status: itemStatus(item, answers) }));
}

/** What each capability needs beyond the baseline, in catalog order. */
export function capabilityRequirements(
  data: Content,
  answers: Answers | null,
): CapabilityRequirementView[] {
  const sets = data.requirements.filter((set) => !set.capabilityIds.includes('all'));
  return data.capabilities.map((capability) => ({
    capability,
    items: sets
      .filter((set) => set.capabilityIds.includes(capability.id))
      .flatMap((set) => set.items)
      .map((item) => ({ item, status: itemStatus(item, answers) })),
    without: data.licensing.prerequisites.without.filter((entry) =>
      entry.capabilityIds.includes(capability.id),
    ),
  }));
}

export function summarizeStatuses(items: RequirementItemView[]): Record<RequirementStatus, number> {
  const counts: Record<RequirementStatus, number> = { ready: 0, gap: 0, unknown: 0 };
  for (const { status } of items) counts[status] += 1;
  return counts;
}

/** The capability views grouped by the product area that configures them, in console order. */
export function byProductArea(data: Content, views: CapabilityRequirementView[]) {
  return [...data.consoles]
    .sort((a, b) => a.order - b.order)
    .map((console_) => ({
      console: console_,
      views: views.filter((view) => view.capability.source.console === console_.id),
    }))
    .filter((group) => group.views.length > 0);
}
