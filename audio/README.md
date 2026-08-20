# Music

Three tracks, one per floor, cycling back to the first on floor 4.

| Order | File | Length | Looped body |
|---|---|---|---|
| Floor 1 | `savage-engine.mp3` | 1:02 | 0:00 – 0:57 |
| Floor 2 | `engine-of-the-abyss.mp3` | 1:08 | 0:00 – 1:05 |
| Floor 3 | `hydraulic-siege.mp3` | 1:21 | 0:00 – 1:16 |

The rotation is set in `js/main.js` (`audio.setTracks([...])`). Add files and
entries together and it grows.

## Looping — why the files are not trimmed

All three fade to silence and end with dead air: 5.4s, 3.0s and 5.0s
respectively. Looped naively, that drops several seconds of silence into the
middle of a fight every time round.

Rather than re-encoding, playback decodes each track through Web Audio and
loops **only the musical body**, with `loopStart`/`loopEnd` found automatically
by `AudioSystem.findLoopPoints()`: it builds an RMS profile in quarter-second
windows, takes the median as the reference level, walks in from each end to the
first window still at 60% of it, then nudges both edges to the nearest zero
crossing so the seam does not click.

This means **a replacement track needs no special preparation** — a fade-out is
detected and skipped. It also means the files stay untouched and listenable on
their own.

## Format and delivery

MP3, 44.1 kHz stereo. The three sit at a well-matched ~0.194 RMS, so no
per-track gain correction is applied.

Music plays through the Web Audio graph, so `musicGain` (0.45, against effects
at 0.5) and the master mute both apply to it. Only one track is fetched and
decoded at a time — roughly 1.5 MB over the wire, not the full 4.9 MB.

On `file://` there is no fetch, so playback falls back to a plain `<audio>`
element: music still plays, but the loop points are lost and the fade gap
returns. Serve over HTTP to get proper looping.

Missing files are not an error. The game fails quietly and runs with sound
effects only.
