import type { Capability, ConsoleDef, ControlPointId } from './schemas.ts';

export type LicensingTier = 'foundational' | 'premium';

/** Foundational when the service description says it is included with base plans; otherwise premium. */
export function licensingTier(capability: Capability): LicensingTier {
  return capability.source.includedWithBasePlans ? 'foundational' : 'premium';
}

/** The layer where the capability mainly acts. The first control point is the primary one. */
export function primaryControlPoint(capability: Capability): ControlPointId {
  return capability.controlPoints[0] as ControlPointId;
}

/** True when a source note records a statement that differs from the service description. */
export function sourcesDiffer(capability: Capability): boolean {
  return (capability.sourceNotes ?? []).some((note) => note.differs === true);
}

/** Setup is "agent" or "both" when a decision is needed for each agent, not only once for the platform. */
export function needsAgentDecision(capability: Capability): boolean {
  return capability.setup !== 'platform';
}

/** Owner team: the capability's own override, otherwise the console default. */
export function ownerTeamOf(capability: Capability, consoles: ConsoleDef[]): string {
  return (
    capability.ownerTeam ??
    consoles.find((c) => c.id === capability.source.console)?.ownerTeam ??
    ''
  );
}
