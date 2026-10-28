import { describe, expect, it } from 'vitest';
import { calculateSeats, type SeatInputs } from '../engine/seats.ts';
import { content } from './index.ts';
import { csvCell, seatsCsv, seatsMarkdown, warningTexts } from './seats-export.ts';

const copy = content.licensing.calculator;
const families = copy.planFamilies;
const idOf = (standing: (typeof families)[number]['standing']) =>
  families.find((family) => family.standing === standing)!.id;

const inputs: SeatInputs = {
  delegating: 100,
  owners: 10,
  overlap: 4,
  everyone: 200,
  seats: { [idOf('included')]: 30, [idOf('qualifies')]: 50 },
  includedEstimate: null,
  qualifyingEstimate: null,
};
const result = calculateSeats(inputs, families);

// A small CSV reader, so the test checks the file as a spreadsheet would read it.
function readCsv(text: string): string[][] {
  return text.split('\r\n').map((line) => {
    const cells: string[] = [];
    let at = 0;
    while (at <= line.length) {
      if (line[at] === '"') {
        let cell = '';
        at += 1;
        while (at < line.length && !(line[at] === '"' && line[at + 1] !== '"')) {
          if (line[at] === '"') at += 1;
          cell += line[at];
          at += 1;
        }
        cells.push(cell);
        at += 2;
      } else {
        const end = line.indexOf(',', at);
        cells.push(line.slice(at, end === -1 ? line.length : end));
        at = end === -1 ? line.length + 1 : end + 1;
      }
    }
    return cells;
  });
}

describe('the calculator content', () => {
  it('has one row for each plan, with every standing the page explains', () => {
    expect(new Set(families.map((family) => family.id)).size).toBe(families.length);
    for (const standing of ['included', 'qualifies', 'does-not-qualify', 'unknown'] as const)
      expect(families.some((family) => family.standing === standing)).toBe(true);
  });

  it('marks as qualifying only plans the Product Terms list as a prerequisite', () => {
    const listed = content.licensing.prerequisites.productTerms.sourceIds;
    for (const family of families.filter((f) => f.standing === 'qualifies'))
      expect(family.sourceIds.some((id) => listed.includes(id))).toBe(true);
  });
});

describe('seatsMarkdown', () => {
  const markdown = seatsMarkdown(content, inputs, result);

  it('opens with the title and the planning notice', () => {
    expect(markdown.split('\n')[0]).toBe(`# ${copy.export.title}`);
    expect(markdown).toContain(copy.export.notice);
  });

  it('lists the people, the plans and the results with their numbers', () => {
    for (const heading of [copy.export.people, copy.export.plans, copy.export.results])
      expect(markdown).toContain(`## ${heading}`);
    expect(markdown).toContain(`- ${copy.results.required.label}: 106`);
    expect(markdown).toContain(`- ${copy.results.recommended.label}: 200`);
    expect(markdown).toContain(`- ${copy.results.toAdd.label}: 76`);
  });

  it('says a figure is not entered instead of printing a zero', () => {
    const empty = seatsMarkdown(
      content,
      { ...inputs, delegating: null, owners: null, overlap: null, everyone: null },
      calculateSeats(
        { ...inputs, delegating: null, owners: null, overlap: null, everyone: null },
        families,
      ),
    );
    expect(empty).toContain(`- ${copy.results.required.label}: ${copy.notEntered}`);
  });

  it('names the sources it rests on', () => {
    expect(markdown).toContain(content.site.ui.exhibit.sourcePrefix);
    const title = content.sources.find((source) => source.id === 'lic-faq')!.title;
    expect(markdown).toContain(title);
  });
});

describe('seatsCsv', () => {
  const rows = readCsv(seatsCsv(content, inputs, result));

  it('has a header and a section, item and value on every row', () => {
    expect(rows[0]).toEqual([
      copy.export.columns.section,
      copy.export.columns.item,
      copy.export.columns.value,
    ]);
    expect(rows.length).toBe(1 + 4 + families.length + 6);
    for (const row of rows) expect(row).toHaveLength(3);
  });

  it('puts the numbers in the value column', () => {
    const required = rows.find((row) => row[1] === copy.results.required.label);
    expect(required?.[2]).toBe('106');
  });
});

describe('csvCell', () => {
  it.each([
    ['plain', 'plain'],
    ['a, b', '"a, b"'],
    ['say "hi"', '"say ""hi"""'],
    ['two\nlines', '"two\nlines"'],
    ['=SUM(A1:A2)', "'=SUM(A1:A2)"],
    ['+1', "'+1"],
    ['-1', "'-1"],
    ['@cmd', "'@cmd"],
  ])('writes %j as %j', (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });
});

describe('warningTexts', () => {
  it('says what was lowered, with the number', () => {
    const lowered = calculateSeats(
      {
        ...inputs,
        delegating: 5,
        owners: 3,
        overlap: 9,
        includedEstimate: 99,
        qualifyingEstimate: 99,
      },
      families,
    );
    const texts = warningTexts(copy, lowered);
    expect(texts).toHaveLength(3);
    expect(texts[0]).toContain('3');
  });

  it('is empty when nothing was lowered', () => {
    expect(warningTexts(copy, result)).toEqual([]);
  });
});
