# Work In Progress

This file is the current short roadmap for Notenotes. Keep it focused on what still needs decisions or implementation. Details about how the current code works belong in `AI.MD` unless they directly affect a planned change.

## Current Recommendation

Move next to **WAV Export Hardening**.

Why:

- Export trust matters for beta.
- Durable audio storage is now in place.
- Typed Canvas tracks are already in place.
- Users need confidence that what they arrange can leave the app intact.

## 1. WAV Export Hardening

Goal:

Make snippet and Canvas WAV export feel reliable enough for real users.

Needs testing or follow-up:

- Smoke test snippet WAV export for MIDI, drum, audio, and Tone.
- Smoke test Canvas WAV export with mixed MIDI, drum, and audio tracks.
- Confirm muted tracks stay out of Canvas export.
- Confirm soloed tracks export correctly.
- Confirm unavailable audio is summarized clearly instead of failing silently.
- Test clips that start after bar 1.
- Test non-4/4 time signatures.

Code note:

WAV export already has paths for MIDI, drum, audio, Tone rendering, and asset-backed audio. This is mainly a trust pass and bug-fix pass, not a new exporter.

Expected scope:

Small to medium.

## 2. Backup Options and History Limits

Goal:

Give users clearer control over how much history and backup data they keep.

Recommended settings:

- Version history depth: `5`, `10`, `25`, `50`.
- Workspace backup contents: current workspace only.
- Expanded backup contents: workspace plus milestones.
- Full archive backup contents: workspace plus milestones plus version history.

Needed UX:

- Explain that browser/PWA storage is local to that browser/device.
- Explain that exported backup files are the user's portable copy.
- Show a rough backup size estimate before export when possible.

Code note:

Version history is currently capped at 5. Backups already exist, but options for milestones/history are not user-facing yet.

Expected scope:

Medium.

## 3. Tone Presets and Clip Tone Editing

Goal:

Let users save and reuse Tone settings without turning the Canvas into a full mixer.

Recommended model:

- Users can save named Tone presets.
- Users can apply a preset to live playing.
- Users can apply a preset to a snippet.
- Users can apply a preset to a selected Canvas clip.
- Recorded notes and drum hits keep the Tone that was active when they were played.

Canvas visual:

- Keep small Tone badges on clips with active Tone.
- Add Tone badges to drum clips too.
- Keep pitch/modulation lines separate from Tone badges.
- Do not build full automation lanes yet.

Export and backup logic:

- WAV export should render Tone.
- Notenotes JSON backups should preserve Tone.
- MIDI export should not be expected to preserve Tone because standard MIDI does not reliably carry Notenotes sound-design data.

Expected scope:

Medium if kept to presets, clip application, and badges.

## 4. Controller Trigger Polish

Goal:

Make trigger behavior obvious and consistent for users who do not already think like musicians.

Possible follow-up:

- Re-check trigger helper text on mobile.
- Confirm Trigger Notes feel clear in single-note mode and chord mode.
- Decide whether the Trigger Notes list should stay as-is or be simplified after testing.
- Confirm real controller trigger pressure maps cleanly on desktop Chrome and mobile browsers where gamepads are supported.

Expected scope:

Small.

## 5. Google Drive Backup

Goal:

Let users back up to a `.notenotes` folder in Google Drive with a retention setting.

Expected pieces:

- Google OAuth flow.
- Create or find `.notenotes` folder.
- Save workspace backup files.
- Save snippet backup files.
- Retention setting for how many cloud saves to keep.
- Restore UI.
- Offline, auth, quota, and permission error handling.

Recommendation:

Do not start this until local backups, storage clarity, and export reliability feel solid. This is useful, but it adds account permissions, cloud failures, and support burden.

Expected scope:

Large.

## 6. Optional Later: Audio File Import

Goal:

Let users import audio files as audio snippets, not only record from Audio In.

Why it fits:

Audio assets now exist, so imported files can use the same storage path as recordings.

Questions before building:

- Do we allow any audio file the browser can decode?
- Do we auto-trim silence?
- Do we ask for BPM or treat imported files as free audio?

Expected scope:

Small to medium.

## Parking Lot

These are worth remembering but should not block beta:

- Snippet dock icon polish for audio snippets.
- Full Tone automation editor.
- MP3 export with an optional encoder.
- Better chunking/code splitting if the Vite bundle warning becomes a practical problem.
