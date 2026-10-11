# Desktop mirror and keepsake implementation

Goal: Adapt the camera wishing experience to desktop screens and preserve the reference scrapbook style.

- [x] Scale the mirror uniformly for desktop and narrow viewports.
- [x] Shrink the opening live camera into the framed scene after nickname entry.
- [x] Enlarge the mirror by 12% during the wish; slowly rotate and float decorations without graying the background.
- [x] Capture the closed-eye moment locally and reveal a white glowing answer after stable open eyes.
- [x] Show the keepsake three seconds after the complete answer, including nickname, timestamp, framed snapshot and answer.
- [x] Recompose the reference collage into 16:9 landscape for desktop while retaining the portrait composition for narrow screens.
- [x] Verify ritual timing, browser flows, viewport bounds, reduced motion and production build.

Validation: `npm test`, `PLAYWRIGHT_CHANNEL=chrome npm run test:browser`, `npm run build`, `git diff --check`.
