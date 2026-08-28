# TO-DO Panel Website Landing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the TO-DO Panel marketing site as the approved dark 3D landing page with a magnetic real-product hero, operation marquee, six sticky Tab cards, local-first section, and minimal ending.

**Architecture:** Keep the Vinext/React application and native CSS. Split page composition, motion math, media fallback, and section content into focused modules; keep all product imagery as file-backed real captures and render a neutral non-UI fallback when captures are absent.

**Tech Stack:** React 19, TypeScript, Vinext, native CSS, Framer Motion, Node test runner, ESLint

**Spec:** `docs/plans/2026-08-28-website-landing-redesign-design.md`

## Global Constraints

- Only the Hero contains the download and GitHub buttons.
- Product UI may only come from real screenshots or real recordings; never draw simulated product UI.
- Hero is desktop left-copy/right-media and the media has Magnet movement.
- Tab order is todo, clipboard, notes, links, recordings, credentials.
- Every Tab card has one sentence and one full screenshot using `object-fit: contain`.
- Mobile and `prefers-reduced-motion` disable Magnet and large scroll transforms.
- Preserve the existing GitHub Releases and repository URLs.

---

### Task 1: Lock the page contract and motion math with failing tests

**Files:**
- Create: `website/tests/landingStructure.test.mjs`
- Create: `website/tests/landingMotion.test.mjs`
- Create: `website/app/landingMotion.mjs`
- Modify: `website/package.json`

**Interfaces:**
- Produces: `getMagnetTransform(pointer, bounds, reducedMotion)` returning `{ x, y, rotateX, rotateY }`.
- Produces: source-level page contract tests consumed by every later task.

- [ ] **Step 1: Write the failing structure test**

```js
test("landing page contains one hero CTA pair and six real-capture tab cards", () => {
  const page = readFileSync(new URL("../app/LandingPage.tsx", import.meta.url), "utf8");
  assert.equal((page.match(/下载 macOS 版本/g) || []).length, 1);
  assert.equal((page.match(/查看 GitHub 仓库/g) || []).length, 1);
  assert.deepEqual([...page.matchAll(/data-tab-id="([^"]+)"/g)].map((row) => row[1]), [
    "todo", "clipboard", "notes", "links", "recordings", "credentials",
  ]);
  assert.doesNotMatch(page, /ProductDemo/);
});
```

- [ ] **Step 2: Run the structure test and verify RED**

Run: `cd website && node --test tests/landingStructure.test.mjs`

Expected: FAIL because `app/LandingPage.tsx` does not exist.

- [ ] **Step 3: Write the failing Magnet math test**

```js
test("magnet transform clamps pointer movement and disables it for reduced motion", () => {
  assert.deepEqual(getMagnetTransform({ x: 1000, y: -100 }, { width: 800, height: 600 }, false), {
    x: 18, y: -12, rotateX: 1.5, rotateY: 1.5,
  });
  assert.deepEqual(getMagnetTransform({ x: 400, y: 300 }, { width: 800, height: 600 }, true), {
    x: 0, y: 0, rotateX: 0, rotateY: 0,
  });
});
```

- [ ] **Step 4: Run the Magnet test and verify RED**

Run: `cd website && node --test tests/landingMotion.test.mjs`

Expected: FAIL because `app/landingMotion.mjs` does not exist.

- [ ] **Step 5: Implement the pure Magnet function and add Framer Motion**

```js
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function getMagnetTransform(pointer, bounds, reducedMotion) {
  if (reducedMotion || !bounds.width || !bounds.height) return { x: 0, y: 0, rotateX: 0, rotateY: 0 };
  const normalizedX = pointer.x / bounds.width - 0.5;
  const normalizedY = pointer.y / bounds.height - 0.5;
  return {
    x: clamp(normalizedX * 36, -18, 18),
    y: clamp(normalizedY * 24, -12, 12),
    rotateX: clamp(normalizedY * -3, -1.5, 1.5),
    rotateY: clamp(normalizedX * 3, -1.5, 1.5),
  };
}
```

Run: `cd website && npm install framer-motion`

- [ ] **Step 6: Run the Magnet test and verify GREEN**

Run: `cd website && node --test tests/landingMotion.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add website/package.json website/package-lock.json website/tests/landingStructure.test.mjs website/tests/landingMotion.test.mjs website/app/landingMotion.mjs
git commit -m "test: define landing page interaction contract"
```

### Task 2: Build the content model, media fallback, and Hero

**Files:**
- Create: `website/app/landingContent.ts`
- Create: `website/app/RealProductMedia.tsx`
- Create: `website/app/HeroSection.tsx`
- Create: `website/app/LandingPage.tsx`
- Modify: `website/app/page.tsx`
- Modify: `website/app/globals.css`

**Interfaces:**
- Consumes: `getMagnetTransform(pointer, bounds, reducedMotion)`.
- Produces: `RealProductMedia({ src, fallbackSrc, alt, kind, className })`.
- Produces: `HeroSection` with the only CTA pair on the site.

- [ ] **Step 1: Add the minimum LandingPage shell to satisfy the structure test**

```tsx
export default function LandingPage() {
  return <main><HeroSection />{TAB_ITEMS.map((item) => <section data-tab-id={item.id} key={item.id} />)}</main>;
}
```

- [ ] **Step 2: Run the structure test and verify GREEN**

Run: `cd website && node --test tests/landingStructure.test.mjs`

Expected: PASS.

- [ ] **Step 3: Implement `RealProductMedia` with a neutral non-UI fallback**

```tsx
export default function RealProductMedia({ src, fallbackSrc, alt, kind = "image", className = "" }: Props) {
  const [activeSrc, setActiveSrc] = useState(src || fallbackSrc || "");
  if (!activeSrc) return <div className={`real-media-missing ${className}`} role="img" aria-label={`${alt}，真实素材待接入`}><span>REAL PRODUCT CAPTURE</span></div>;
  if (kind === "video") return <video className={className} src={activeSrc} muted loop playsInline autoPlay aria-label={alt} onError={() => setActiveSrc(fallbackSrc || "")} />;
  return <img className={className} src={activeSrc} alt={alt} onError={() => setActiveSrc(fallbackSrc || "")} />;
}
```

- [ ] **Step 4: Implement the layered Hero with left copy and right magnetic media**

Use one pointer handler on the media wrapper, pass local pointer coordinates into `getMagnetTransform`, and animate the wrapper back to zero on pointer leave. The media source is `/product-captures/home.png`; no UI markup is allowed inside the media frame.

- [ ] **Step 5: Run focused tests**

Run: `cd website && npm test`

Expected: all website tests PASS.

- [ ] **Step 6: Commit**

```bash
git add website/app website/tests
git commit -m "feat: build magnetic real-product hero"
```

### Task 3: Build marquee, transition, and capabilities sections

**Files:**
- Create: `website/app/OperationMarquee.tsx`
- Create: `website/app/ProductStory.tsx`
- Create: `website/app/CapabilitiesSection.tsx`
- Modify: `website/app/LandingPage.tsx`
- Modify: `website/app/globals.css`
- Modify: `website/tests/landingStructure.test.mjs`

**Interfaces:**
- Consumes: `RealProductMedia` and content arrays from `landingContent.ts`.
- Produces: two directionally opposed marquee rows and two static narrative sections.

- [ ] **Step 1: Extend the structure test for section order and button uniqueness**

```js
assert.deepEqual([...page.matchAll(/data-section="([^"]+)"/g)].map((row) => row[1]), [
  "hero", "marquee", "story", "capabilities", "tabs-intro", "tab-stack", "privacy", "ending",
]);
assert.equal((page.match(/className="landing-cta/g) || []).length, 2);
```

- [ ] **Step 2: Run the structure test and verify RED**

Run: `cd website && node --test tests/landingStructure.test.mjs`

Expected: FAIL because the new sections are absent.

- [ ] **Step 3: Implement the three sections**

Use `useScroll` and `useTransform` for marquee row translation, `whileInView` for one-time copy reveals, and no button in `ProductStory` or `CapabilitiesSection`.

- [ ] **Step 4: Run the structure test and verify GREEN**

Run: `cd website && node --test tests/landingStructure.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add website/app website/tests/landingStructure.test.mjs
git commit -m "feat: add landing page narrative sections"
```

### Task 4: Build the six-card sticky Tab stack

**Files:**
- Create: `website/app/TabStack.tsx`
- Modify: `website/app/LandingPage.tsx`
- Modify: `website/app/globals.css`
- Modify: `website/tests/landingStructure.test.mjs`

**Interfaces:**
- Consumes: ordered `TAB_ITEMS` and `RealProductMedia`.
- Produces: six `data-tab-id` cards with one sentence and one full capture each.

- [ ] **Step 1: Add assertions for the single-media card contract**

```js
const tabStack = readFileSync(new URL("../app/TabStack.tsx", import.meta.url), "utf8");
assert.match(tabStack, /object-fit:\s*contain|tab-capture/);
assert.doesNotMatch(tabStack, /VIEW TAB|查看功能|tab-detail/);
```

- [ ] **Step 2: Run the structure test and verify RED**

Run: `cd website && node --test tests/landingStructure.test.mjs`

Expected: FAIL because `TabStack.tsx` does not exist.

- [ ] **Step 3: Implement the sticky card**

```tsx
function TabCard({ item, index }: { item: TabItem; index: number }) {
  const cardRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: cardRef, offset: ["start start", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.96]);
  return <section ref={cardRef} className="tab-card-track" data-tab-id={item.id}><motion.article className="tab-card" style={{ scale }}><header><strong>{String(index + 1).padStart(2, "0")}</strong><div><span>{item.eyebrow}</span><h3>{item.title}</h3><p>{item.description}</p></div></header><RealProductMedia className="tab-capture" src={item.capture} alt={`${item.title}完整面板`} /></motion.article></section>;
}
```

- [ ] **Step 4: Run the structure test and verify GREEN**

Run: `cd website && node --test tests/landingStructure.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add website/app/TabStack.tsx website/app/LandingPage.tsx website/app/globals.css website/tests/landingStructure.test.mjs
git commit -m "feat: add real-capture tab stack"
```

### Task 5: Add privacy, minimal ending, responsive behavior, and real capture assets

**Files:**
- Create: `website/app/PrivacySection.tsx`
- Create: `website/app/EndingSection.tsx`
- Create: `website/public/product-captures/home.png`
- Create: `website/public/product-captures/todo.png`
- Modify: `website/app/LandingPage.tsx`
- Modify: `website/app/globals.css`
- Modify: `website/app/layout.tsx`
- Modify: `website/tests/landingStructure.test.mjs`

**Interfaces:**
- Consumes: the approved landing composition.
- Produces: final metadata, real-capture asset paths, mobile layout, and reduced-motion behavior.

- [ ] **Step 1: Add assertions for real asset paths and reduced-motion CSS**

```js
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /\.tab-capture[\s\S]*object-fit:\s*contain/);
assert.match(page, /data-section="privacy"/);
assert.match(page, /data-section="ending"/);
```

- [ ] **Step 2: Run the structure test and verify RED**

Run: `cd website && node --test tests/landingStructure.test.mjs`

Expected: FAIL until the CSS and final sections exist.

- [ ] **Step 3: Add final sections and responsive CSS**

Desktop keeps the left/right Hero and sticky stack. Below 760px, Hero becomes a vertical composition, pointer movement is disabled, marquee movement is reduced, and Tab cards use normal document flow.

- [ ] **Step 4: Add existing real captures without altering the UI**

Mechanically crop the repository's real `docs/screenshots/home.png` and `docs/screenshots/todo.png` to the full panel bounds, then save them at the declared public paths. Do not retouch, redraw, or synthesize missing screens.

- [ ] **Step 5: Run the structure test and verify GREEN**

Run: `cd website && npm test`

Expected: all website tests PASS.

- [ ] **Step 6: Commit**

```bash
git add website/app website/public/product-captures website/tests
git commit -m "feat: finish responsive landing experience"
```

### Task 6: Verify production quality

**Files:**
- Modify only files required by failures found during verification.

**Interfaces:**
- Consumes: the completed landing page.
- Produces: evidence for functional, static, build, and visual acceptance.

- [ ] **Step 1: Run website tests**

Run: `cd website && npm test`

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Run ESLint**

Run: `cd website && npm run lint`

Expected: exit 0 with no errors.

- [ ] **Step 3: Run production build**

Run: `cd website && npm run build`

Expected: exit 0 and `Build complete`.

- [ ] **Step 4: Inspect the production page at desktop and mobile widths**

Verify 1440px, 1024px, 760px, and 390px widths. Confirm the Hero remains left/right on desktop, buttons appear only once, the real panel is not clipped, the six cards preserve screenshot proportions, and no horizontal scrollbar appears.

- [ ] **Step 5: Verify reduced-motion mode**

Confirm Magnet, marquee translation, character reveals, and Tab scale transforms are disabled while content remains readable.

- [ ] **Step 6: Review the final diff**

Run: `git diff --check && git status --short && git diff --stat main...HEAD`

Expected: no whitespace errors and only website redesign files plus the two approved plan documents.

