import { describe, expect, it, vi } from 'vitest';
import { LogoSchema, LOGO_INPUT_BYTES, normalizeLogo } from './logo.ts';
import { DiagnosticWorkspaceSchema, emptyWorkspace } from './diagnostic-model.ts';
import {
  appendDiagnosticBundle,
  diagnosticBundle,
  parseDiagnosticBundle,
} from './diagnostic-transfer.ts';

const logo = {
  data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP8////fwYGBgYAGfgD/g/eHX8AAAAASUVORK5CYII=',
  width: 2,
  height: 1,
  alt: 'Fictional organization logo',
};

describe('local raster branding', () => {
  it('validates PNG structure, checksums and bounded matching dimensions', () => {
    expect(LogoSchema.parse(logo)).toEqual(logo);
    for (const change of [
      { data: 'https://example.invalid/logo.png' },
      { data: 'data:image/svg+xml;base64,PHN2Zy8+' },
      { data: logo.data.replace('EUlEQVR', 'AUlEQVR') },
      { data: `${logo.data}AAAA` },
      { width: 3 },
      { width: 513 },
      { height: 0 },
      { alt: '' },
      { alt: 'x'.repeat(121) },
      { extra: true },
    ])
      expect(LogoSchema.safeParse({ ...logo, ...change }).success).toBe(false);
  });

  it('loads legacy v1 workspaces without inserting a logo default, and preserves branded copies', () => {
    const data = emptyWorkspace();
    const entity = {
      createdAt: '2026-10-26T12:00:00.000Z',
      updatedAt: '2026-10-26T12:00:00.000Z',
      contentVersion: 'old',
    };
    const organizationId = crypto.randomUUID();
    data.organizations.push({ ...entity, id: organizationId, answers: {} });
    data.assessments.push({
      ...entity,
      id: crypto.randomUUID(),
      organizationId,
      answers: {},
      mode: 'full',
      sectionId: 'review',
      patternId: null,
      sampleId: null,
    });
    expect(DiagnosticWorkspaceSchema.parse(data)).toEqual(data);
    expect(DiagnosticWorkspaceSchema.parse(data).assessments[0]).not.toHaveProperty('logo');
    data.assessments[0]!.logo = logo;
    const bundle = diagnosticBundle(data, 'current');
    expect(parseDiagnosticBundle(JSON.stringify(bundle))).toEqual({ ok: true, bundle });
    const imported = appendDiagnosticBundle(data, bundle);
    expect(imported.assessments[1]!.logo).toEqual(logo);
    expect(imported.assessments[1]!.id).not.toBe(data.assessments[0]!.id);
    bundle.workspace.assessments[0]!.logo = { ...logo, width: 4000 };
    expect(parseDiagnosticBundle(JSON.stringify(bundle))).toEqual({ ok: false, error: 'format' });
  });

  it('rejects oversized and unsupported uploads before decoding', async () => {
    await expect(
      normalizeLogo(new File(['svg'], 'logo.svg', { type: 'image/svg+xml' }), 'Logo'),
    ).rejects.toMatchObject({ reason: 'format' });
    await expect(
      normalizeLogo(
        new File([new Uint8Array(LOGO_INPUT_BYTES + 1)], 'big.png', { type: 'image/png' }),
        'Logo',
      ),
    ).rejects.toMatchObject({ reason: 'size' });
  });

  it('reports unavailable native image decoding as a readable upload error', async () => {
    const bytes = Uint8Array.from(atob(logo.data.split(',')[1]!), (char) => char.charCodeAt(0));
    const file = Object.assign(new File([bytes], 'logo.png', { type: 'image/png' }), {
      arrayBuffer: async () => bytes.buffer,
    });
    vi.stubGlobal('createImageBitmap', undefined);
    try {
      await expect(normalizeLogo(file, 'Logo')).rejects.toMatchObject({ reason: 'read' });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
