# Work In Progress

## Deferred: Durable Audio Asset Storage

We decided to wait on the larger audio storage refactor until there is more quota/time for a careful pass.

### Why this matters

Notenotes currently protects new Audio In recordings by storing durable audio data on the snippet itself, instead of relying only on temporary `blob:` URLs. This fixes the immediate data-loss issue for new recordings and makes JSON backups portable.

However, storing large audio data directly inside snippets is not ideal long-term. It can duplicate audio across:

- project saves
- version history snapshots
- milestones
- workspace backups
- snippet backups

This is acceptable as a beta safety step, but it can become heavy for audio-heavy projects.

### Better long-term architecture

Use separate audio assets:

- Store project JSON in IndexedDB.
- Store larger audio blobs in a separate `audioAssets` IndexedDB store.
- Give each recording an `audioAssetId`.
- Snippets reference `audioAssetId` instead of embedding all audio data directly.
- Version history and milestones should snapshot project structure without duplicating the same audio bytes repeatedly.
- Workspace/snippet backup should still be portable by bundling referenced audio assets.

### Expected scope

This is a medium refactor. It likely touches:

- `ProjectStore` database version upgrade
- a new `audioAssets` store
- Audio In recording save path
- playback audio lookup
- edit preview audio lookup
- WAV export audio lookup
- workspace backup format
- snippet backup format
- import/restore migration
- version history and milestone snapshot behavior

Do this in a focused pass with browser testing, not casually while quota/context is tight.

### Migration needs

Support old and current snippet formats:

- old broken format: `audioUrl` only, often unrecoverable if the `blob:` URL is dead
- current safer format: `audioDataUrl`
- future format: `audioAssetId`

For current `audioDataUrl` snippets, migration can extract the data into `audioAssets` and replace it with `audioAssetId`.

For dead `blob:`-only snippets, the app should show a clear audio unavailable state rather than failing silently.

## Smaller Beta Patch Ideas

These can be done before the full audio-asset refactor:

- Add a storage meter using `navigator.storage.estimate()`.
- Show current storage usage, estimated quota, and percent used.
- Estimate workspace backup size.
- Warn when projects are audio-heavy.
- Add configurable version history depth:
  - default: `10`
  - options: `5`, `10`, `25`, `50`
- Let workspace backups choose what to include:
  - current workspace only
  - workspace plus milestones
  - full archive: workspace plus milestones plus version history
- Consider pruning or warning when history contains large embedded audio snapshots.

## Google Drive Sync

Feasible, but should be a separate feature pass.

Expected pieces:

- Google OAuth flow
- create/find a `.notenotes` folder in the user's Drive
- save workspace/snippet backup files there
- retention setting for how many cloud saves to keep
- restore UI
- clear error handling for offline, auth expiration, quota, and permission problems

Do not mix this into the local backup/storage refactor unless the project is ready for a larger cloud integration.

## Tone Traits / Friendly Sound Effects Follow-Up

Tone Traits now have a cleaner first-pass model, but they still need a small beta polish pass before calling the whole idea finished.

### Current status

Fixed in the current implementation pass:

- Tone sliders write to `project.settings.soundTraits` immediately.
- Closing and reopening `Tone` should preserve the saved slider amounts.
- Moving a Tone slider applies the normalized Tone state to the live synth right away.
- Controller trigger assignments layer temporary Tone overrides on top of the current Tone settings instead of saving trigger pressure as the new default.
- Full trigger press maps to `100%`.
- Analog trigger values map from `0%` to `100%` when the browser exposes that data.
- MIDI snippet recording saves the current Tone snapshot onto the snippet.
- WAV snippet and Canvas export render saved MIDI Tone snapshots.

Still needs hands-on verification:

- Test trigger overrides with a real controller in Chrome and Safari.
- Confirm the effect feels obvious enough at high slider values on the built-in patches.
- Confirm PWA/service worker refresh is not showing stale Tone UI on installed builds.

### Intended model

Use a clear three-layer model:

1. `Current Tone`
   - The sliders beside the Patch dropdown represent the current live synth tone.
   - `0%` means the trait is off.
   - Any value above `0%` means the trait is active.
   - No separate checkbox is needed.

2. `Snippet Tone Snapshot`
   - When recording a MIDI snippet, save the current Tone settings onto that snippet.
   - This protects old ideas from changing when the user tweaks Tone later.
   - Example: record a bass with `Drive`, then change Tone to `Wobble` for a lead without mutating the bass snippet.

3. `Canvas / Edit Tone`
   - Users should eventually be able to inspect and edit the saved Tone on a selected snippet or clip.
   - This should be explicit, not accidental global mutation.

### Proposed data shape

Use slider-only values:

```js
soundTraits: {
  crush: { amount: 0 },
  echo: { amount: 0.35 },
  space: { amount: 0 },
  wobble: { amount: 0.9 },
  drive: { amount: 0 },
  noise: { amount: 0 },
}
```

Project settings can store the current/default Tone:

```js
project.settings.soundTraits
```

MIDI snippets can store the recorded snapshot:

```js
snippet.soundTraits
```

Controller assignments remain project-level:

```js
project.settings.controllerToneAssignments = {
  leftTrigger: 'wobble',
  rightTrigger: 'echo',
}
```

Later controller performance recording can store automation:

```js
snippet.toneAutomation = [
  { tick: 0, trait: 'wobble', value: 0 },
  { tick: 120, trait: 'wobble', value: 1 },
  { tick: 240, trait: 'wobble', value: 0.4 },
]
```

### Effects to support first

Keep the first set to six:

- `Crush`: bitcrush/downsample
- `Echo`: delay
- `Space`: reverb/room
- `Wobble`: LFO pitch/filter movement
- `Drive`: distortion/saturation
- `Noise`: noise oscillator/texture

### Remaining fix checklist

- Verify with a real controller, since browser gamepad mappings vary.
- Add a small visible indicator while a trigger is actively pushing a Tone Trait.
- Add an edit path for saved snippet or clip Tone so users can revise Tone after recording.
- Decide whether track-level Tone should exist, or whether saved snippet/clip Tone plus presets is enough for beta.

### Canvas and preset plan

Recommended next UX:

- Add Tone presets, such as user-saved combinations of the six sliders.
- Let users save the current Tone as a preset.
- Let users apply a Tone preset to:
  - the current live synth
  - a selected snippet
  - a selected Canvas clip
- Show Tone badges on MIDI clips when a saved snippet/clip Tone has active traits.
- Add an Inspect/Edit Tone panel later so users can revise a snippet's saved Tone without rerecording.

This is probably better than making every Canvas track a full effects mixer immediately.

### Export logic

MIDI export:

- Standard MIDI cannot reliably represent Tone Traits.
- MIDI export should preserve notes/hits/timing only.
- If Tone data matters, use Notenotes JSON backup or a future sidecar JSON export.

WAV export:

- WAV export should render the saved Tone snapshot for each MIDI snippet or clip.
- If `snippet.toneAutomation` exists later, WAV export should render that automation.
- The long-term goal is for live playback and WAV export to match closely enough that users trust export.

Backup export:

- Workspace backups should preserve:
  - project current Tone
  - Tone presets
  - controller assignments
  - snippet Tone snapshots
  - future tone automation
- Snippet backups should preserve snippet-level Tone snapshots and automation.
