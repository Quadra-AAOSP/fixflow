# Spec — Mobile-friendly layouts (Android + iOS)

Scope: `Frontend/Mobile` only. No backend changes.

## Goal

The app is a phone app, but several surfaces are still laid out with the web
build's assumptions: content under the status bar / home indicator, forms the
keyboard covers, and one screen whose list cannot scroll. Fix those so every
screen behaves on both Android and iOS.

## Audit findings (verified by reading each file)

| # | Severity | Finding | Files |
|---|----------|---------|-------|
| A | P0 | `expo.userInterfaceStyle: "light"` locks the native appearance, so the dark theme (already implemented) cannot apply on iOS/Android. Web works, native does not — matches the user's earlier report. | `app.json` L9 |
| B | P0 | The More menu has **no header at all** (Tabs `more` + More-stack `index` both set `headerShown: false`) and its ScrollView starts at `pt-4`, so the "More" heading renders under the status bar / notch on iOS and under the status bar on Android edge-to-edge. | `app/(tabs)/more/index.tsx` L52 |
| C | P0 | Modals use `presentationStyle="fullScreen"` on Android and their chrome starts at the very top → the title/Close ("Done") row renders under the status bar. Witnessed in both modal implementations. | `components/ui/Picker.tsx` L93-101, `components/ui/ModalSheet.tsx` L44-52 |
| D | P0 | `ModalSheet`'s footer is pinned at the bottom with `py-4` and no bottom inset → it sits under the home indicator / gesture nav bar. | `components/ui/ModalSheet.tsx` L82-86 |
| E | P0 | `ModalSheet` has no keyboard handling. Its footer (Create site / Place order) and the last fields are covered by the keyboard on iOS. Affects the site editor and the shop checkout sheet. | `components/ui/ModalSheet.tsx` L75-80; callers `more/sites.tsx` L331+, `more/shop/index.tsx` L823+ |
| F | P0 | Assignments renders a **non-flex `ScrollView` (header block) plus a sibling non-flex `FlatList`** inside a fixed-height parent. The list is allocated content height after the header and is pushed past the container bottom, so lower rows are clipped and unreachable on short screens. | `app/(tabs)/assignments.tsx` L242-333 |
| G | P1 | Screens with text inputs have no `KeyboardAvoidingView`; the keyboard covers the lower fields and the submit CTA on iOS. | `app/(tabs)/more/team-access.tsx` L207-210, `app/(tabs)/more/contracts.tsx` L49-52 |
| H | P1 | The auth shell only pads for the status bar (`paddingTop: insets.top`), so the footer sits too close to the home indicator. | `components/auth/AuthShell.tsx` L37 |
| I | P1 | The default `Picker` trigger renders its label in a non-flex `Text` with no `numberOfLines`, inside a `justify-between` row → a long value (e.g. "Springfield Community College") overflows the bordered field, worst in the two-column Role/Site row on 320–360 px phones. | `components/ui/Picker.tsx` L81-88; `app/(tabs)/more/team-access.tsx` L278-297 |

Not a problem (checked, no change): `AuthShell` safe-area + keyboard, `reports/index.tsx`
(already a single `FlatList` with `ListHeaderComponent`), `reports/new.tsx`, tab-bar
bottom inset (handled by react-navigation), `Home` FAB (`pb-32` clears it),
`orientation: portrait` (no landscape requirement).

## Decisions

1. **Insets via `useSafeAreaInsets`, not `SafeAreaView`.** `expo-router` already
   wraps the tree in `SafeAreaProvider` (`ExpoRoot.js`), and the React context
   reaches into `<Modal>` subtrees, so `useSafeAreaInsets()` is valid inside the
   modals. Inset values are `0` on web and non-edge-to-edge Android, so the
   change is a no-op there.
2. **`ModalSheet` and `Picker` gain the insets and the keyboard handling
   themselves**, so every caller (`sites`, `shop`, `contracts`, `new-report`)
   is fixed at once — no per-caller duplication.
3. **`team-access` keeps its two-column rows** on normal phones but the `Picker`
   trigger label is made shrinkable (`flex-1` + `numberOfLines={1}`) so it can
   never overflow its box. No responsive breakpoint logic is added.
4. **Assignments is rewritten as one scrollable `FlatList`** whose
   `ListHeaderComponent` holds the existing heading/stats/search/filter block —
   the same shape `reports/index.tsx` already uses. No visual redesign.
5. **`app.json` `userInterfaceStyle` → `"automatic"`.** Required for the dark
   theme to be able to apply on native; the app still launches light because the
   theme provider defaults to light and calls `setColorScheme` explicitly.
6. **`contracts`/`team-access` use `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`**
   (Android's default `softwareKeyboardLayoutMode: resize` already handles it),
   matching `reports/new.tsx` and `AuthShell`. `keyboardDismissMode="on-drag"`
   and iOS `automaticallyAdjustKeyboardInsets` added alongside.
7. Out of scope (not changing): tablet/wide-screen content caps, touch-target
   enlargement for the small text links, the no-op `pointer-events-box-none`
   class on the shop's floating bar, `boxShadow` in `StatCard`.

## Exact changes

| File | Change |
|------|--------|
| `app.json` | `expo.userInterfaceStyle`: `"light"` → `"automatic"` |
| `components/ui/ModalSheet.tsx` | `useSafeAreaInsets()`; header `paddingTop: insets.top + 16`; footer `paddingBottom: Math.max(insets.bottom, 16)`; wrap the `ScrollView` in `KeyboardAvoidingView` (`behavior={Platform.OS === 'ios' ? 'padding' : undefined}`); `keyboardDismissMode="on-drag"`, `automaticallyAdjustKeyboardInsets` (iOS) |
| `components/ui/Picker.tsx` | Same modal insets as `ModalSheet` (`pt-4` → `insets.top + 16`, list bottom `insets.bottom + 24`); default trigger label → `flex-1` + `numberOfLines={1}` |
| `app/(tabs)/more/index.tsx` | `useSafeAreaInsets()`; ScrollView `contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 48) }}` |
| `app/(tabs)/assignments.tsx` | Replace the header `ScrollView` + sibling `FlatList` with one `FlatList`; move the heading/stats/search/filter into `ListHeaderComponent`; list `contentContainerClassName="px-5 pb-6"` |
| `app/(tabs)/more/team-access.tsx` | Wrap the `ScrollView` in `KeyboardAvoidingView` (iOS `padding`); add `keyboardDismissMode="on-drag"`, `automaticallyAdjustKeyboardInsets` |
| `app/(tabs)/more/contracts.tsx` | Same keyboard treatment as `team-access` |
| `components/auth/AuthShell.tsx` | `contentContainerStyle` also sets `paddingBottom: insets.bottom` |

## Verification

1. `npx tsc --noEmit -p tsconfig.json` from `Frontend/Mobile` → must pass (it does today).
2. Web smoke test (insets are 0, so only regressions are detectable): load
   `http://localhost:8081`, sign in, then visit Home, More, Reports, Assignments,
   Settings, Shop at a 360×640 viewport — no clipping, list scrolls, no header
   duplicate.
3. Native: no iOS/Android device or simulator is available in this environment,
   so native correctness is established by code reasoning only — `useSafeAreaInsets`
   resolves inside modal subtrees, and every inset is `0` where edge-to-edge is off.
   This limitation is called out explicitly; the user is expected to spot-check
   on a device.

## Required approval

Approval is required before any file is edited. Task order and tracking live in
`tasks.md`.
