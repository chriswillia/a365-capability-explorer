# How to update content

You do not need to be a developer. Capabilities, sources and all interface copy are YAML files in the [`content/`](../content) folder, and the site rebuilds itself when a change is merged.

## The flow

1. **Edit.** Open a file in `content/` on GitHub and select the pencil icon (the web editor).
2. **Propose.** Select **Commit changes**, choose **Create a new branch and start a pull request**, and open the pull request.
3. **Check.** CI validates the change. Open the **Checks** tab. A green tick means the content is valid. A red cross shows the exact file, entry and field to fix.
4. **Merge.** A maintainer reviews and merges.
5. **Publish.** The site redeploys to GitHub Pages automatically. A published change can take up to about ten minutes to appear.

## What the files are

| File                                                                     | Holds                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `capabilities.yaml`                                                      | The 26 capabilities: verbatim service-description text, availability, and editorial drafts |
| `sources.yaml`                                                           | Every source, with its URL and when it was last verified                                   |
| `site.yaml`                                                              | All interface copy, page titles and the footer disclaimer                                  |
| `pillars.yaml`, `consoles.yaml`, `control-points.yaml`, `lifecycle.yaml` | The labels and groupings that capabilities refer to                                        |
| `changelog.md`                                                           | What changed, and which capabilities each change touches                                   |
| `source-snapshot.json`                                                   | The service description's feature table as published. Do not edit by hand                  |

## Rules of thumb

- **Official wording is verbatim.** Do not edit `featureText` or the three availability flags to fix a typo or "improve" them. If the service description changed, update `source-snapshot.json` and the capability together.
- **Never invent.** If you do not know a value, leave the field empty and add `# TODO(verify)` on the line above it.
- **No prices.** Link to the official page instead.
- **Editorial text stays `reviewStatus: draft`** until a subject-matter expert signs it off. Keep to the word limits: 40 words for `summary`, 30 for the other text fields.
- **Every claim needs a source** that exists in `sources.yaml`.
- Use "Essential", "Recommended" and "Consider" for recommendation levels. Never "Required".

## Add a capability

1. Copy an existing entry in `capabilities.yaml`. Give it a new kebab-case `id` that never changes once published.
2. Paste the feature text exactly as published, and set the console and the three availability flags from the service description.
3. Fill in the fit metadata (pillar, wave, layer, setup, lifecycle stages) and the editorial text, all as drafts.
4. Add an entry to `changelog.md` with an `affects:` line that lists the new id.
5. Update the expected numbers in `src/lib/content/catalog.test.ts` (see below).

The new capability then appears in the overview numbers and the capabilities table. Later phases will carry it into every lens, matrix and readout automatically.

## When CI fails

| The message says                   | What to do                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| `Unrecognized key: "sumary"`       | A field name is misspelled                                                   |
| `unknown source "a365-registy"`    | The `sourceId` is not in `sources.yaml`                                      |
| `must be 40 words or fewer`        | Shorten the text                                                             |
| `duplicate value "…"`              | Two entries share an id                                                      |
| `unknown placeholder {…}`          | A `{placeholder}` in `site.yaml` is not one of the computed values           |
| `catalog.test.ts` fails on a count | You changed the catalog on purpose. Update the expected numbers in that test |

Warnings (stale `lastVerified`, a source nothing cites yet) do not fail the build, but they show what needs attention.

## Check it on your computer

```bash
npm ci
npm run content:build   # validates and compiles /content
npm run dev             # shows the site
```
