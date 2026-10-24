# Motion studio rules

## Render contract
- Every film is a pure function of time: `window.seek(t)` paints frame t.
- No CSS transitions, no setTimeout, no requestAnimationFrame in render mode,
  no state carried between frames. Seeded noise only (mulberry32), never Math.random.
- Render with `node render.mjs`, encode H.264 yuv420p, CRF 16.

## Look
- Banned defaults: centered title on gradient, everything fading in,
  corner labels and frame borders, glow on UI chrome, generic particle bursts.
- One display face, one UI face. One accent color unless the brief says otherwise.
- Every 2 to 4 seconds something new must happen on screen.

## Sound
- Score and SFX are synthesized in code unless a track is supplied.
- Place hits on the measured beat grid (beats.json). Loudness -14 LUFS.

## Loop before you show me anything
1. Render one frame per beat as a contact sheet and LOOK at it.
2. Score it 1-10 on: hook in first 2s, readability at phone size,
   motion quality, variety, brand accuracy, sound sync.
3. Fix the 3 worst problems. Repeat until every score is 8+.
4. Only then do the full render.

---

## Project context: Home TV intro

These notes describe this project; the rules above still apply in full.

- What it is: the intro that plays when Home TV opens for the first time after the TV
  boots. Any remote key skips it, and it can be turned off in the ☰ panel.
- Canvas and length: 1920×1080, 3 to 5 seconds. Brand, storyboard (timings, easing,
  sound cues) and sound direction come from the Claude Design canvas for the identity.
- First and last frame: starts on pure black and ends on the Home background (#07090C),
  so the cut into the Home screen is invisible.
- Brand: dark glass look, UI face Inter (app/src/main/assets/www/fonts/InterVariable.ttf),
  text #F2F4F6, secondary #A3ABB5; the accent comes from the brand canvas.
- Readability: besides phone size, check the logo at 64 px and at TV distance (3 m).
- Motion: the app's own feel is short moves (200 to 360 ms) that settle with a light
  spring; the intro may be bolder but keeps that personality.
- Sound: synthesized in code by default, matching the UI sounds in app/src/main/res/raw
  (scripts/generate-ui-sounds.py). A supplied track replaces it only if its licence
  allows distribution in the app.
- Output: keep the APK light (target 1 to 3 MB for the video). The final MP4 goes into
  the app; the render sources stay in this folder.
