# Home TV — guide for assistants

Read README.md and COMPATIBILITY.md before changing this project.

- Active Android project is at repository root; package `com.tvhome.launcher`.
- UI: `app/src/main/assets/www/`. Native bridge/providers: `app/src/main/java/com/tvhome/launcher/`.
- Local-first BYOK only: never embed API keys, create an unnecessary backend, print credentials or authenticated URLs.
- Run `node --check app/src/main/assets/www/app.js` before builds.
- Preserve current layout, remote navigation, keys, favorites and package identity.
- Never disable Amazon Home or Prime Video, perform debloat, or reset app data.
- After an authorized Fire TV installation run `scripts/setup-home.*`, preserving other accessibility services. Do not force-stop the app in normal testing.
- Install/setup/restore scripts target Fire OS, not generic Android TV, Tizen, webOS or Vega OS.
- Explain device changes and request authorization if the current task does not already authorize them.
- Read SECURITY_AUDIT.md before publication. Never rewrite Git history or publish without explicit authorization.
- Keep upstream MIT and third-party notices. Do not claim untested platform support.
- For platform ports read `ports/README.md`, `ports/CONTRACT.md` and the target guide;
  use `ports/REQUEST.md` for the handoff. Generated scaffolds are not functional ports.
- Debug APKs are for development; release APKs need a private distribution signature outside Git.
