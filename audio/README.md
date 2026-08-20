# Music

Drop tracks here and they play automatically. Nothing else needs changing.

## Naming

| File | When it plays |
|---|---|
| `track1.ogg` / `track1.mp3` | Floor 1, and the start of every run |
| `track2.ogg` / `track2.mp3` | Floor 2 |
| `track3.ogg` / `track3.mp3` | Floor 3 |

Tracks then cycle: floor 4 returns to `track1`, and so on. The list lives in
`js/main.js` (`audio.setTracks([...])`) if you want more than three — add the
files and the entries, and the rotation grows with them.

## Format

Provide **either** `.ogg` or `.mp3` — the player asks the browser which it
supports and requests that one, preferring Ogg where available. Ogg Vorbis is
usually smaller at the same quality; MP3 is the safer bet for older Safari. If
you only have one format, use MP3.

Missing files are not an error. The game checks, fails quietly, and runs with
sound effects only — so the repo stays playable with no audio committed.

## Practical notes

- **Loop cleanly.** Tracks are set to `loop`, so a fade-in or fade-out at the
  edges produces an audible dip every time round. Ask for a seamless loop, or
  trim the silence off both ends.
- **Keep them small.** These download before they play. Aim for under ~2 MB
  each; 96–128 kbps is plenty for a chiptune-style track, and GitHub Pages
  serves them as ordinary static files.
- **Mind the mix.** Music sits at 0.45 gain against effects at 0.5. If a track
  buries the gunfire, lower it in the file rather than in code — that keeps the
  mute button and the balance predictable.
