# Scam Surface Mapper v.3.0 beta

Modified version of [Pogoda Scam Surface Mapper](https://github.com/paulpogoda/Scam-Surface-Mapper) with GitHub Pages and additional functionality.

OSINT link-surface analyzer with hybrid architecture: bookmarklet collector + GitHub Pages viewer.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![JavaScript](https://img.shields.io/badge/language-JavaScript-yellow.svg)
![Platform](https://img.shields.io/badge/platform-Browser-green.svg)

## Overview

Scam Surface Mapper maps outgoing infrastructure from suspicious pages:

- extracts links from `a[href]`, `onclick`, `data-*`, `meta refresh`, `canonical`, `og:url`
- computes URL/domain heuristics and suspicion score
- builds host summary and raw-link dataset
- visualizes host/url relations in interactive graphs
- exports JSON/CSV/PNG artifacts for investigations

Project now supports a **hybrid workflow**:

1. **Collector bookmarklet** runs on target page and builds snapshot.
2. **Viewer page (GitHub Pages)** receives snapshot via `postMessage`.
3. If transfer fails, collector downloads `snapshot.json` and Viewer can import it manually.

## Mode Comparison

| Aspect | Hybrid (Collector + Viewer) | Legacy (Standalone Bookmarklet) |
| --- | --- | --- |
| Execution model | Collect on target page, inspect in external Viewer | Full analysis and UI directly on target page |
| Best for | Repeatable workflow, JSON handoff, external review | Fast ad-hoc checks without opening Viewer |
| Data transfer | `postMessage` with fallback to downloaded `snapshot.json` | No transfer, all data remains in current page context |
| Operational limits | Depends on popup availability and bridge timeout | Depends on in-page rendering performance |
| Setup | Open Pages Viewer, install collector bookmarklet | Install one bookmark from `scam-surface-mapper.js` |

## Repository Layout

```text
.
├─ scam-surface-mapper.js          # legacy standalone bookmarklet
├─ src/
│  ├─ core/
│  │  ├─ schema.js
│  │  ├─ score.js
│  │  ├─ extract.js
│  │  └─ aggregate.js
│  ├─ bookmarklet/
│  │  └─ collector-entry.js
│  └─ viewer/
│     ├─ install.js
│     ├─ import-export.js
│     ├─ graph.js
│     ├─ bridge.js
│     └─ app.js
├─ site/
│  └─ index.html
├─ scripts/
│  └─ build-pages.mjs
└─ .github/workflows/
   └─ pages.yml
```

## Local Build

```bash
npm run build:pages
```

Build output:

- `dist/site/index.html`
- `dist/site/assets/viewer.js`
- `dist/site/assets/bookmarklet-template.txt`

To test locally, serve `dist/site` over HTTP (not `file://`), for example:

```bash
cd dist/site
python3 -m http.server 8080
```

## GitHub Pages Deployment

Workflow is already included: `.github/workflows/pages.yml`.

1. Push to `main`.
2. In repository settings, set **Pages Source** to **GitHub Actions**.
3. Wait for workflow `Deploy GitHub Pages` to finish.
4. Open published Pages URL.

## Usage (Hybrid Mode)

1. Open your GitHub Pages Viewer.
2. In **Install Collector Bookmarklet**, drag `Drag To Bookmarks` to bookmarks bar.
3. Navigate to suspicious webpage.
4. Click collector bookmarklet.
5. Viewer opens and receives snapshot automatically.

Fallback path:

- If popup is blocked, payload is too large, or bridge times out, collector downloads `ssm_snapshot_*.json`.
- In Viewer, use **Import JSON** or **Paste JSON**.

## Usage (Legacy Standalone Bookmarklet)

Legacy mode uses the old all-in-one overlay directly on target page:

1. Open `scam-surface-mapper.js`.
2. Copy full file content (`javascript:...`).
3. Create browser bookmark and paste code as bookmark URL.
4. Open suspicious page and click this legacy bookmark.

This mode is useful if you want everything in-page without opening Viewer.

## How To Switch Modes

- Use **Hybrid mode** when you need a stable external Viewer, import/export flow, and easier sharing of `snapshot.json`.
- Use **Legacy mode** when you want the quickest in-page analysis and do not need Pages Viewer.
- You can keep both bookmarks in browser at once, e.g. `SSM Hybrid Collector` and `SSM Legacy`.

## Viewer Features

Tabs:

- **Summary**: risk-ordered host table
- **Raw Links**: discovered URLs and tags
- **Hosts Graph**: source-to-host map
- **Full Graph**: source → host → URL map

Actions:

- Copy JSON
- Download `hosts.csv`
- Download `links.csv`
- Download `snapshot.json`
- Save graph PNG
- Import JSON / Paste JSON

## Limitations

- Browsers do not allow auto-creating bookmarks from websites. Bookmarklet install is manual (`drag/copy`).
- GitHub Pages Viewer cannot inspect arbitrary external site DOM directly due browser same-origin policy.
- Some target sites can partially block bookmarklet execution via restrictive CSP.
- Full graph is capped by node limit for performance.

## Security & Ethics

Intended for:

- cybersecurity and threat-intel research
- OSINT investigations
- academic analysis of fraud infrastructure
- fact-checking and journalism

Use responsibly and follow local laws, platform terms, and responsible disclosure practices.

## Support

**[Support my team on Patreon](https://www.patreon.com/c/provereno)**
