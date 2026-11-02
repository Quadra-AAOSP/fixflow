# Workspace readability and reflow review

Checked 2 November 2026 against the current web source and the local browser at
http://127.0.0.1:8081 using disposable account/site/report fixtures.

## Text color pairs

Normal text was assessed against the 4.5:1 threshold described in
[W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
Ratios use the defined sRGB foreground/background values, not antialiased screenshot pixels.
Displayed ratios are rounded for reading; the checks compare full precision.

| Text | Previous foreground | Current foreground | Background | Before | After |
| --- | --- | --- | --- | --- | --- |
| Selected navigation | #008e82 | #006f65 | #d3f6ef | 3.51:1 | 5.26:1 |
| Coral status | #bb5260 | #9f3f4c | #fae4e5 | 3.85:1 | 5.26:1 |
| Mint status | #008d80 | #006f65 | #d2f6ee | 3.55:1 | 5.25:1 |
| Citron status | #688522 | #4f6519 | #edf4b2 | 3.66:1 | 5.67:1 |
| Introductory text | #788b92 | #52677b | #ffffff | 3.56:1 | 5.86:1 |
| Chart axis | #7b8ba0 | #52677b | #ffffff | 3.48:1 | 5.86:1 |
| Workspace footer | #8695a5 | #52677b | #fcfdfc | 3.00:1 | 5.74:1 |
| Sidebar footer | #8b978f | #52677b | #fcf9f4 | 2.89:1 | 5.58:1 |

The coral, mint and citron brand backgrounds remain unchanged. Only affected
text/foreground colors changed; decorative illustration colors were retained.
The muted text token and teal action token now use darker foregrounds.

## Live computed-style evidence

- Mobile selected navigation returned rgb(0,111,101) on rgb(211,246,239).
- Open status returned rgb(159,63,76) on rgb(250,228,229).
- Assigned status returned rgb(0,111,101) on rgb(210,246,238).
- Site metadata and workspace footer returned rgb(82,103,123).

## Responsive checks

| Page and language | Requested viewport | Measured content | Result |
| --- | --- | --- | --- |
| Sites, English | 320 × 740 | client 305px / document 305px with vertical scrollbar | No document overflow; card actions wrap |
| Sites, Chinese | 320 × 740 | client 305px / document 305px | No document overflow |
| Sites, Chinese | 1280 × 900 | client 1280px / document 1280px | Desktop navigation and cards fit |
| Reporter home, Chinese | 320 × 740 | client 320px / document 320px | Wide table remains inside its scroll region |
| Reporter home, English | 320 × 740 | client 320px / document 320px | No document overflow |

The previous body minimum width forced a 320px body into a 305px layout area when
a vertical scrollbar was present. Removing that fixed minimum lets the body use
the available layout width. Site-card actions now wrap without hiding links.
Temporary viewport overrides were reset, and the language was restored to English.

## Scope still open

- These samples do not prove every component, hover state, theme or image caption.
- Full screen-reader acceptance, non-text contrast and target-size coverage remain open.
- Dashboard chart colors still encode categories alongside their text legend;
  chart/non-text assessment is separate from these foreground checks.
- The full role/workflow acceptance gates remain in VERIFICATION.md.
- This is targeted verification, not a whole-application WCAG conformance claim.
