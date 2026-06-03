# Built-in sample instruments (CC0)

These packs power the **Sample instruments** group in the instrument picker. Each
instrument is a small set of AAC (`.m4a`) zones plus a `manifest.json`. The app
lazy-loads a pack only when a user first selects that instrument, then caches it in
Cache Storage so it works offline afterward. The core app bundles **no** audio, so
download size and offline behaviour are unaffected until a sample instrument is used.

## The audio files

To keep the repository lean, the generated `.m4a` audio is provided **alongside this
PR** to drop straight into `public/packs/` — and is also fully reproducible:

```bash
node scripts/build-sample-packs.mjs            # all instruments
node scripts/build-sample-packs.mjs marimba    # a subset
```

The script downloads the source samples, picks a few zones per instrument (so packs
stay tiny), corrects the octave labelling, and transcodes to the exact files listed
in each `manifest.json`. Requirements: Node 18+, `curl`, and `ffmpeg` (built-in `aac`).

## Source & licence

All samples derive from the **Versilian Community Sample Library (VCSL)** —
<https://github.com/sgossner/VCSL> — released under **CC0 1.0 (public domain)**.
No attribution is required; it is noted here as a courtesy. Because the audio is CC0,
it is fully compatible with this project's MIT licence.

## Format

Mono **AAC** (`.m4a`), ~88–96 kbps, silence-trimmed and length-capped. AAC is used
because it is both small and decodable on every target browser **including iOS
Safari** — Ogg/Opus are not reliably decodable via `decodeAudioData` in Safari.
