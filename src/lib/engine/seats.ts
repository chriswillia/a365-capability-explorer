import type { PlanStanding } from '../content/schemas.ts';

/** The most people a count field accepts. It stops a slip of the keyboard from producing a number nobody means. */
export const MAX_COUNT = 10_000_000;

export interface PlanFamily {
  id: string;
  standing: PlanStanding;
}

export interface SeatInputs {
  /** Delegating users (D): people who use agents that act for them. */
  delegating: number | null;
  /** Owners (S): people who own, sponsor or manage agents with their own access. */
  owners: number | null;
  /** Owners who are also delegating users (O). */
  overlap: number | null;
  /** Everyone who will interact with agents (U). */
  everyone: number | null;
  /** People on each plan family, by the family's id. */
  seats: Readonly<Record<string, number | null>>;
  /** The seller's own estimates. Null means "start from the calculated value". */
  includedEstimate: number | null;
  qualifyingEstimate: number | null;
}

export interface SeatResult {
  /** D + S - O, or null until a people count is entered. */
  required: number | null;
  /** The overlap actually used: it cannot exceed D or S, or a person would be counted twice. */
  overlapUsed: number;
  overlapReduced: boolean;
  /** max(required, U), or null until everyone is entered. */
  recommended: number | null;
  /** People on plans that already include Agent 365. */
  includedSeats: number;
  /** People on plans Microsoft lists as a prerequisite. */
  eligibleSeats: number;
  /** Required people who already have Agent 365 through a plan that includes it. */
  included: number | null;
  includedIsEstimate: boolean;
  includedReduced: boolean;
  /** Required people who hold a qualifying plan and can add Agent 365 now. */
  qualifying: number | null;
  qualifyingIsEstimate: boolean;
  qualifyingReduced: boolean;
  /** Required people who need a prerequisite plan first. */
  needsPlan: number | null;
  /** Agent 365 licenses to add: required, less people who already have it. */
  toAdd: number | null;
}

/** Reads a count field: blank, negative or unreadable is null (not entered), otherwise a whole number from 0 up. */
export function parseCount(text: string): number | null {
  const cleaned = text.trim().replace(/,/g, '');
  if (!/^\d+(?:\.\d*)?$/.test(cleaned)) return null;
  return Math.min(MAX_COUNT, Math.floor(Number(cleaned)));
}

const orZero = (value: number | null | undefined): number => value ?? 0;
const seatsOn = (inputs: SeatInputs, families: readonly PlanFamily[], standing: PlanStanding) =>
  families
    .filter((family) => family.standing === standing)
    .reduce((total, family) => total + orZero(inputs.seats[family.id]), 0);

/**
 * Sizes Agent 365 licenses from the seller's counts. Licensing follows the person, so the people who must be
 * licensed are the delegating users plus the owners, sponsors and managers of agents with their own access,
 * counting anyone in both groups once. Everything is whole-number arithmetic on what was entered.
 */
export function calculateSeats(inputs: SeatInputs, families: readonly PlanFamily[]): SeatResult {
  const delegating = orZero(inputs.delegating);
  const owners = orZero(inputs.owners);
  const overlapAsked = orZero(inputs.overlap);
  const overlapUsed = Math.min(overlapAsked, delegating, owners);
  const peopleEntered = inputs.delegating !== null || inputs.owners !== null;
  const required = peopleEntered ? delegating + owners - overlapUsed : null;
  const recommended = inputs.everyone === null ? null : Math.max(orZero(required), inputs.everyone);

  const includedSeats = seatsOn(inputs, families, 'included');
  const eligibleSeats = seatsOn(inputs, families, 'qualifies');

  let included: number | null = null;
  let includedReduced = false;
  let qualifying: number | null = null;
  let qualifyingReduced = false;
  if (required !== null) {
    const includedCeiling = Math.min(required, includedSeats);
    included =
      inputs.includedEstimate === null
        ? includedCeiling
        : Math.min(inputs.includedEstimate, includedCeiling);
    includedReduced = inputs.includedEstimate !== null && inputs.includedEstimate > includedCeiling;

    const qualifyingCeiling = Math.min(required - included, eligibleSeats);
    qualifying =
      inputs.qualifyingEstimate === null
        ? qualifyingCeiling
        : Math.min(inputs.qualifyingEstimate, qualifyingCeiling);
    qualifyingReduced =
      inputs.qualifyingEstimate !== null && inputs.qualifyingEstimate > qualifyingCeiling;
  }

  return {
    required,
    overlapUsed,
    overlapReduced: overlapAsked > overlapUsed,
    recommended,
    includedSeats,
    eligibleSeats,
    included,
    includedIsEstimate: inputs.includedEstimate !== null,
    includedReduced,
    qualifying,
    qualifyingIsEstimate: inputs.qualifyingEstimate !== null,
    qualifyingReduced,
    needsPlan: required === null ? null : required - orZero(included) - orZero(qualifying),
    toAdd: required === null ? null : required - orZero(included),
  };
}
