import { JSDOM } from 'jsdom';
import JSZip from 'jszip';
import { posix } from 'node:path';
import { expect } from 'vitest';

/**
 * Opens a PowerPoint package and checks it the way a strict reader would: the expected number of slides and notes,
 * every declared part present, no external relationships, and the notes master listed before the slides.
 * Returns the text of each slide and of each slide's notes. The caller stubs DOMParser and XMLSerializer first.
 */
export async function packageContents(blob: Blob, count: number) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort();
  const notes = Object.keys(zip.files)
    .filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name))
    .sort();
  expect(slides).toHaveLength(count);
  expect(notes).toHaveLength(count);
  for (const name of Object.keys(zip.files).filter((name) => /\.(xml|rels)$/.test(name))) {
    const xml = await zip.file(name)!.async('string');
    const document = new JSDOM(xml, { contentType: 'text/xml' });
    if (name.endsWith('.rels')) {
      for (const relationship of document.window.document.getElementsByTagName('Relationship')) {
        expect(relationship.getAttribute('TargetMode')).not.toBe('External');
        const target = relationship.getAttribute('Target');
        if (!target) throw new Error('Missing package relationship target');
        const source = name.replace('_rels/', '').replace(/\.rels$/, '');
        const part = posix.normalize(posix.join(posix.dirname(source), target));
        expect(zip.file(part), `${name}: ${target}`).not.toBeNull();
      }
    }
    for (const override of document.window.document.getElementsByTagName('Override')) {
      const part = override.getAttribute('PartName')?.slice(1);
      if (!part) throw new Error('Missing content-type part name');
      expect(zip.file(part), `Missing declared package part: ${part}`).not.toBeNull();
    }
    if (name === 'ppt/presentation.xml') {
      const tags = [...document.window.document.documentElement.children].map(
        (node) => node.localName,
      );
      expect(tags.indexOf('notesMasterIdLst')).toBeLessThan(tags.indexOf('sldIdLst'));
    }
    document.window.close();
  }
  const readText = async (name: string) => {
    const window = new JSDOM(await zip.file(name)!.async('string'), { contentType: 'text/xml' })
      .window;
    const text = [...window.document.getElementsByTagName('a:t')]
      .map((node) => node.textContent)
      .join('\n');
    window.close();
    return text;
  };
  return {
    zip,
    slides: await Promise.all(slides.map(readText)),
    notes: await Promise.all(notes.map(readText)),
  };
}
