# Fonts

Envelope serves three faces, each self-hosted from Fontsource under the SIL Open
Font License 1.1 with its licence beside it: Nunito (variable, Latin and Latin
Extended) for headings and the Envelope wordmark, Inter (variable, Latin and
Latin Extended) for text and tabular figures, and Caveat 600 (Latin) for the
homepage's one handwritten note. Upstreams: https://github.com/googlefonts/nunito,
https://github.com/rsms/inter and https://github.com/googlefonts/caveat.

Their `@font-face` rules are in `public/rer-theme.css`, the one stylesheet every
document links (the app, Base's sign-in, setup and Lobby pages, the run site and
the installer, which reads the theme with Base's grammar). "Nunito Display" is
Nunito with its line box fitted to its glyphs, so two tightly led heading lines
keep separate boxes. Documents preload only the two primary Latin files
(`src/base/font-head.ts`, `src/site/shell/frame.ts`).

Inter's U+2192 is shipped in `inter/inter-symbols-wght-normal.woff2`, subset from
https://github.com/rsms/inter/blob/master/docs/font-files/InterVariable.woff2.
