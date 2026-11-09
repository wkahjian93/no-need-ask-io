# No Need Ask IO

REDEFINE team app. Agents ask an ePartner question and get the steps, with screenshots of where to tap. Questions the guides don't cover go to the AI on the REDEFINE team server, which answers only from GE's ePartner documents.

- `docs/`: the app (static PWA). It contains no GE content; guides and screenshots download after team-code sign-in.
- `tools/`: builds the private knowledge files.
- `test/`: `node test/test.js`; `test/server-sim.js` runs the real team server code locally.

Team server code: `REDEFINE Form Filler/server/Code.gs` (ops `iopack`, `ioput`, `ioask`).
