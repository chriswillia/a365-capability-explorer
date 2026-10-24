import capabilities from '../../generated/capabilities.json';
import changelog from '../../generated/changelog.json';
import consoles from '../../generated/consoles.json';
import controlPoints from '../../generated/controlPoints.json';
import lifecycle from '../../generated/lifecycle.json';
import meta from '../../generated/meta.json';
import pillars from '../../generated/pillars.json';
import site from '../../generated/site.json';
import sources from '../../generated/sources.json';
import { computeMetrics, templateValues } from './metrics.ts';
import type { ConsoleId, Content, ContentMeta, ControlPointId, PillarId } from './schemas.ts';

/*
 * The only place the app reads compiled content. scripts/build-content.ts validates every file against the
 * Zod schemas before it writes src/generated/*.json, so the casts below describe data that is already checked.
 */
export const content = {
  sources,
  pillars,
  consoles,
  controlPoints,
  lifecycle,
  capabilities,
  site,
  changelog,
} as unknown as Content;

export const contentMeta = meta as ContentMeta;

export const metrics = computeMetrics({
  capabilities: content.capabilities,
  pillars: content.pillars,
  consoles: content.consoles,
  controlPoints: content.controlPoints,
  contentVersion: contentMeta.contentVersion,
});

/** Values for {placeholders} in content templates. */
export const values = templateValues(metrics);

const sourcesById = new Map(content.sources.map((source) => [source.id, source]));
export const sourceById = (id: string) => sourcesById.get(id);

const pillarsById = new Map(content.pillars.map((pillar) => [pillar.id, pillar]));
export const pillarById = (id: PillarId) => pillarsById.get(id);

const consolesById = new Map(content.consoles.map((console_) => [console_.id, console_]));
export const consoleById = (id: ConsoleId) => consolesById.get(id);

const controlPointsById = new Map(content.controlPoints.map((point) => [point.id, point]));
export const controlPointById = (id: ControlPointId) => controlPointsById.get(id);
