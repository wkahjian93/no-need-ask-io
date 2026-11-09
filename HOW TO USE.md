# No Need Ask IO: how to use

**The problem it fixes:** agents keep asking you ePartner questions they could look up themselves, so you teach the same steps again and again.
**How it fixes it:** the agent types the question on their phone and gets the steps, with a real ePartner screenshot and a red box on where to tap. Questions the guides don't cover go to an AI that only answers from GE's own ePartner documents. If it can't find the answer, it says so and points the agent to ICM or Agent Careline instead of guessing.

## For agents (send this to the team)
1. Open the app link on your phone and tap **Add to Home Screen**.
2. Tap **Sign in** and enter your name and the REDEFINE team code (the same one as Form Filler). The guides then download, and after that they work without internet.
3. Type your question in English, 中文 or BM, then tap **Show me how**.
   - Common questions such as commission, login, forms, e-policy or ICM open a step-by-step guide right away, with screenshots. Tap a picture to zoom in.
   - Questions about rules or facts (e.g. "SPYE2 free-look how many days?") go to the AI. Wait 10 to 30 seconds. The answer shows which ePartner document it came from.
4. **Ask a follow-up** in the box under the answer, like a chat. For example: "How about for SRM?" or "那个表格在哪里？". The AI remembers the chat until you tap **New question** or refresh the app. Nothing is saved, on the phone or on the server.
5. **Show the AI what you're looking at:** tap **Take photo** or **Photo / PDF** under the question box (or under the follow-up box). You can add screenshots of an ePartner error, a photo of a letter, or a policy PDF.
   - Up to 8 photos or PDF pages per chat.
   - If a PDF has a password (like e-Policy PDFs), the app asks for it once. The password opens the file on the phone and is never saved or sent.
   - The AI reads them for this chat only. Nothing is saved. Cover the client's name and IC if you can.
6. **Copy steps** puts the steps on your clipboard so you can paste them into WhatsApp.
7. Still stuck? The app sends you to ICM or Agent Careline 03-4259 8111. Tell your IO what you already tried.

**Never type client details** (IC, phone, policy number). The app spots them in typed text and asks you to remove them before anything is sent. It can't check photos or PDFs, so cover or crop those details yourself where you can. The AI is told never to repeat them.

## For you (owner)
- **Updating the guides:** edit `private/guides.js`, or drop new ePartner exports into `private/source/`, then run:
  ```
  node tools/build-pack.js
  ```
  Then in the app: **⋯ → Owner: upload guides and library**, pick every file in `private/build/` that starts with `nnaio_`, and enter your owner code.
- **New screenshots:** save them as PNG in `private/shots/` (red box #ff1f3d around the spot to tap), then run `node tools/find-boxes.js` and `tools/convert-shots.ps1`, then rebuild.
- **AI cost:** each AI question is one call on the shared team daily limit (same as Form Filler and What-If). Each follow-up is one more call. Instant guides cost nothing. A chat stops at 8 questions and asks the agent to start fresh. Questions with photos cost more AI tokens (each follow-up resends them) and take 20 to 60 seconds.
- **What is private:** everything in `private/` (GE internal PDF text, screenshots, guides). It reaches phones only after team-code sign-in, and the PDF library never leaves the team server. The public app code contains no GE content.

## Test run
```
node test/test.js
```
This runs 90 checks:
- the 17 common questions and 14 messy real-life wordings each go to the right guide;
- fact questions go to the AI;
- client details are caught;
- the real team server code (run in memory) refuses uploads from agents, and its search finds the right GE document;
- follow-up questions carry only the last 4 turns of the chat, and the app saves no questions;
- attached photos and PDF text reach the AI (8 pictures at most), and a password-protected sample PDF (`test/fixtures/locked-sample.pdf`, password 1234, made-up details) opens in the app.

The last result is in `test/last-run.txt`.

To try the app on this PC, ask Claude for the `no-need-ask-io` preview, or run `node test/server-sim.js --preload` and open http://localhost:5197 (team code `test-team-code`). In this local test, the AI replies are hand-written stand-ins in `test/ai-replies/`, because the real AI only runs on the team server.
