# Photographic Hero Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current left-copy/right-image Hero with the approved full-screen photographic Mac composition, real expanded/collapsed TO-DO Panel interaction, and staged entrance animation.

**Architecture:** Keep the existing React/Vinext landing page and replace only `HeroSection`. Render every visual layer inside a normalized `1200 × 831` artboard so the photograph, screen wallpaper, product panel, and foreground mask share one coordinate system. Product UI remains file-backed real screenshots; a small pure state module controls when the panel may toggle.

**Tech Stack:** React 19, TypeScript, Vinext, native CSS, Framer Motion, Node test runner

---

### Task 1: Lock Hero behavior with failing tests

**Files:**
- Create: `website/app/landingHero.mjs`
- Create: `website/app/landingHero.d.ts`
- Create: `website/tests/landingHero.test.mjs`
- Modify: `website/tests/landingPage.test.tsx`

**Step 1: Write the failing state test**

Test the consumer-visible state contract: the Hero starts expanded, ignores clicks while the entrance is incomplete, toggles to collapsed after the entrance, and toggles back to expanded.

**Step 2: Run the focused tests and verify RED**

Run: `cd website && node --import tsx --test tests/landingHero.test.mjs tests/landingPage.test.tsx`

Expected: FAIL because the photographic Hero state module and rendered contract do not exist.

**Step 3: Implement the minimum pure state reducer**

Export `INITIAL_HERO_PANEL_STATE` and `nextHeroPanelState(current, entranceComplete)` from `landingHero.mjs`.

**Step 4: Extend the rendered page contract**

Render assertions must verify:

- The Hero description is exactly `把灵动岛，变成随手可用的工作台。`
- Hero navigation contains `FEATURES / TABS / PRIVACY` and no `ABOUT`.
- One accessible panel toggle is initially expanded.
- The photographic scene, wallpaper, expanded capture, and collapsed capture are represented by real file-backed images.

**Step 5: Run focused tests and verify GREEN**

Run: `cd website && node --import tsx --test tests/landingHero.test.mjs tests/landingPage.test.tsx`

Expected: all focused tests PASS.

### Task 2: Prepare real photographic layers

**Files:**
- Create: `website/public/hero/mac-scene.png`
- Create: `website/public/hero/mac-wallpaper.png`
- Create: `website/public/hero/panel-collapsed.png`
- Create: `website/public/hero/mac-foreground-mask.svg`

**Step 1: Copy the user-provided scene and wallpaper without generative edits**

Use the files preserved under `docs/assets/hero/` as sources. Keep their original pixels and dimensions.

**Step 2: Crop the real collapsed-state reference**

Mechanically crop the 2× Retina capture to the actual 400 × 68 pixel island region. Do not redraw the grip or black island.

**Step 3: Create the foreground mask**

Create an SVG luminance mask in the photograph's `1200 × 831` coordinate system. The mask exposes the real laptop bezel, laptop body, and stone plinth while leaving the screen interior transparent. It must only mask original photo pixels; it must not contain illustrated product UI.

**Step 4: Inspect every produced asset**

Verify dimensions, crop boundaries, screen aperture, and absence of private desktop content.

### Task 3: Implement the layered Hero and real toggle

**Files:**
- Modify: `website/app/HeroSection.tsx`
- Modify: `website/app/landingContent.ts`
- Modify: `website/app/globals.css`

**Step 1: Replace the current Hero markup**

Build the normalized artboard with this exact z-order:

1. scene photograph;
2. `TO-DO PANEL` wordmark;
3. clipped wallpaper;
4. real expanded/collapsed panel control;
5. scene photograph repeated through the foreground mask;
6. minimal navigation, one-line description, and the two CTA links.

**Step 2: Add the approved entrance sequence**

- `0–600ms`: stone, Mac, and wallpaper;
- `500–1100ms`: wordmark behind the Mac;
- `1050–1700ms`: panel expansion plus description and CTA reveal.

The panel toggle remains disabled until the final stage completes.

**Step 3: Implement the click interaction**

Use a semantic button with `aria-expanded`. Animate only the media container's geometry and clipping, cross-fading between the two real captures. Do not draw panel controls in HTML or CSS.

**Step 4: Implement responsive and reduced-motion behavior**

Desktop uses the single-line description at bottom-left and CTA pair at bottom-right. Mobile crops the photographic artboard around the Mac, reduces the background wordmark, and stacks the copy and CTA controls beneath the computer. Reduced motion switches real captures without spatial animation.

**Step 5: Run all automated verification**

Run: `cd website && npm test && npm run lint && npm run build`

Expected: tests, ESLint, and production build all exit 0.

**Step 6: Perform browser visual verification**

Inspect at the default desktop viewport, a 1280 × 720 low-height desktop viewport, and a 390 × 844 mobile viewport. Verify layer alignment, title occlusion, single-line copy, both panel states, no horizontal overflow, and no console errors.

