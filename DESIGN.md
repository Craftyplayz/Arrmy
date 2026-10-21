# Design Guide

How every page in Arrmy looks and is built. This is a copy of the Crafty Playz design guide (<https://www.craftyplayz.com/design/>), which is the definitive source. The only changes from it make it specific to Arrmy: Next.js instead of PHP, Arrmy's pages and files instead of the site's, and the site-only parts left out. When the two disagree on anything else, the site's guide wins; update this copy to match.

## Start here

- Read this page top to bottom before building anything. Rules are in priority order: when two clash, the earlier one wins.
- Open [Steam Stats](https://www.craftyplayz.com/games/steam/) next to it. It is the gold standard: when this page doesn't answer a question, do what Steam does.
- Build with the components and the Arrmy pieces below before writing any CSS. Copy their markup from the code blocks.
- Never invent a value. Colours are tokens, sizes and spacing come from the scales here, the font is the system font.
- Change the look, not the behaviour, when restyling an existing page. Keep its features, URLs, query parameters and server actions.
- Words in capitals in [GLOSSARY.md](GLOSSARY.md) (Request, Requester, Admin, Available) are domain terms; see Writing for how they appear in the interface.

### Reference pages: when in doubt, copy what these do

| Kind of page | Reference | What to copy |
|---|---|---|
| Gold standard | Steam Stats and its 5 pages | Everything: hero, stat cards, section headings, art grids, ranked lists, charts |
| Plain text / form | [About](https://www.craftyplayz.com/about/) | `.grid` of `.card`s, `.kv` facts |

### Arrmy's pages

| Page | File | Kind | Layout |
|---|---|---|---|
| Search | `src/app/page.tsx` | Search first (`.ar-find`) | One centred column: big wordmark → round search field → All / Movies / TV Shows / Audiobooks segmented control → a list of results (poster, title, a Media Type tag and year, overview, status, Request). All is the default: it runs every search at once and takes each one's best hit in turn; a search that is down only drops its own results. TV and Audiobooks open a drawer with the season picker or Edition field |
| Requests | `src/app/requests/page.tsx` | Dashboard | `Hero` heading row → one `.ar-panel` with an `.ar-tbl` table (title, Media Type, who, when, size, status). A row opens the Request's own page; phones keep only title and status |
| Admin | `src/app/admin/page.tsx` | Dashboard | `Hero` heading row → stat cards → `.ar-two`: Problems, Stuck, Downloading on the left; Disks, Requests by person, Layouts on the right |
| Request | `src/app/requests/[id]/page.tsx` | Dashboard | `Hero` heading row → small stat cards (who, when, status, timings) → `.ar-two`: Request Log, Episodes (TV) and Manage on the left; the title (poster, facts, overview, links) and Cast on the right |
| Settings | `src/app/settings/page.tsx` | Plain form | `Hero` heading row → `.ar-panel.form-card` |
| Layouts | `src/app/layouts/` | Mockups | Fifteen static redesign mockups on made-up data, linked from Admin. Each brings its own chrome, so the sidebar hides there |

Every signed-in page sits beside the sidebar (`.side` in `src/app/layout.tsx`); on phones it becomes a top bar and a bottom tab bar. The colours are the bluer greys of the "Sidebar dashboard" mockup.
| Sign in | `src/app/login/page.tsx` | Plain | Title → one muted line → one primary button |

## Principles in priority order

- **Fast.** Content is visible and usable in under 1 second on a phone. The first view is HTML from a server component; client JS only improves it. Nothing heavy loads until it's needed.
- **Fits every screen.** One layout that flows from 320px to 2560px. Grids pick their own column count, sizes use `clamp()`, and breakpoints exist only where content actually breaks.
- **Uncluttered.** One job per page. One primary button per view. Empty things are hidden, details live behind a click, raw data comes last.
- **Show it, don't list it.** Arrmy is full of pictures (posters, book covers), so lead with them: an art hero, covers, art beside names. Headline numbers are big stat cards and rings, not table rows. Tables and raw data still exist, further down.
- **One dark theme, one blue accent.** Every page uses the same tokens, and the accent is Steam blue everywhere. No page invents a colour, a font, or a light mode.
- **Quick, calm motion.** Things under the pointer answer it (a small lift, zoom or tilt); anything else moves only to explain a change. Under 200ms, transform and opacity only.

A page with art reads: header → hero (title, one line, tabs) → a row of stat cards → sections, each a heading and then a grid of art or a card of text → footer. A plain page skips the hero and the stat row: title → one muted line → cards.

Arrmy is one level deep, so it has no breadcrumbs; the header's current link shows where you are.

## Page anatomy: the Arrmy pieces, top to bottom

These are the Steam pieces from the site's `games-steam.css`, copied into `src/app/pieces.css` with `steam-` renamed to `ar-`. The layout wraps every page in `<main className="page ar">`, so the link and `[hidden]` fixes under Traps apply everywhere.

### Heading row

Every page except Search opens with `Hero` from `src/app/ui.tsx`: the title, one muted line beside it, and any buttons on the right. No art, no tabs; who is signed in is in the sidebar.

```tsx
<header className="ar-head">
  <h1 className="page-title">Admin</h1>
  <p className="page-lede">What needs fixing, what's downloading and how full the disks are.</p>
  <div className="actions">{/* optional buttons */}</div>
</header>
```

### Stat cards

The 3 to 6 headline numbers, straight under the heading row. Each is its own card and links to where the number comes from. Rounded numbers keep the exact value in `title`.

```tsx
<div className="ar-stats-row">
  <a className="ar-stat" href="#problems"><b>2</b><span>Problems</span><small>1 failed download</small></a>
  <div className="ar-stat"><b title="1,204 movies, 3,412.7 GB">1,204</b><span>Movies</span><small>3.41 TB</small></div>
</div>
```

### Panels and tables

Dashboard sections are `.ar-panel`s: a 15px heading with a muted count, then rows, a table or a ranked list. Two columns of them sit in `.ar-two` (one column under 1100px). A table goes in `.ar-tbl` inside a panel that also has `.ar-scroll`; cells marked `.wide` hide on phones.

```tsx
<section className="ar-panel ar-scroll">
  <table className="ar-tbl">
    <thead><tr><th>Title</th><th className="wide num">Size</th><th>Status</th></tr></thead>
    <tbody>
      <tr>
        <td><Link className="ar-t" href="/requests/12"><img className="ar-thumb" src={poster} alt="" width={28} height={42} /><span><b>Dune</b><small>2021</small></span></Link></td>
        <td className="wide num">24.1 GB</td>
        <td><Badge status={status} /></td>
      </tr>
    </tbody>
  </table>
</section>
```

### Search results

The Search page is one centred `.ar-find` column: `.ar-logo`, the `.ar-find-box` form, the `.ar-seg` Media Type links, then `.ar-results`. Each `.ar-result` is a poster, the title over year · Media Type and two lines of overview, and on the right its status badge and the Request button (or the button that opens its drawer).

### Ranked list

Top-N lists: rank, the name over a bar scaled to the first item, and the value with a muted share. Requests by person on the Admin page is one. Arrmy's version has no art column; copy the site's `.steam-rank` if a list needs one.

```tsx
<div className="ar-ranks">
  <div className="ar-rank">
    <span className="ar-rank-n">1</span>
    <span className="grow"><b>Sam</b><span className="ar-rank-bar"><i style={{ width: '100%' }} /></span></span>
    <span className="ar-rank-val">412 GB<small>8 Requests</small></span>
  </div>
</div>
```

### Also from the Steam pages

- Charts: plain SVG or CSS bars, colours `--series-1`, `-2`, `-3` in that order. Hovering one part fades the others to 50%. Every chart has a legend, a tooltip or title with the exact value, and the numbers in a `<details>` table underneath.
- Toolbars: one `.bar` under the hero with the search field, and `.stabs` filters with counts if a page needs them. Filtering hides items in place; nothing re-fetches.
- Server-side data: every number is rendered by a server component from Radarr, Sonarr, qBittorrent, LazyLibrarian and Arrmy's own database, so the page is complete before any script runs. Client components only add live refresh (`AutoRefresh`) and small touches.

## Build a page

1. Pick the folder. URLs are folders: `src/app/<page>/page.tsx`. Lowercase, hyphens.
2. Export `metadata` with the page's `title` (Title Case). The layout adds ` · Arrmy`.
3. Add the page to `NAV` in `src/app/layout.tsx` if it belongs in the header. It is the only list of header links; never hard-code a nav link anywhere else.
4. Build the content with the components and Arrmy pieces below. Page-only CSS goes in `src/app/<page>/<page>.css`, imported by that page.
5. Run the checklist at the bottom of this page.

```tsx
import type { Metadata } from 'next'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Example' }

export default async function ExamplePage() {
  await requireUser()
  return (
    <>
      <h1 className="page-title">Example</h1>
      <p className="page-lede">One line saying what this page does.</p>
      <div className="grid">
        <section className="card"><h2>Section</h2><p>Content.</p></section>
      </div>
    </>
  )
}
```

A page with art swaps the title and lede for a hero (see Page anatomy). Never write your own `<html>`, `<head>`, charset or viewport, or import the global stylesheets in a page: `src/app/layout.tsx` does all of it.

### The stylesheets

| File | What's in it |
|---|---|
| `src/app/globals.css` | Tokens, the sidebar, the footer, `.page`, the heading row, focus ring, reduced motion. Started as the site's `global.css` |
| `src/app/components.css` | Buttons, cards, badges, tiles, rows, forms, tables, messages, drawer, dialog. Copied from the site's `components.css` |
| `src/app/pieces.css` | Stat cards, panels and tables, Search results, ranked list, Request page. Started as the site's `games-steam.css`, renamed `ar-` |

Keep the copied parts as close to the site's files as possible, so changes there can be copied over.

## Colour: dark only

| Token | Value | Use |
|---|---|---|
| `--bg` | `#202020` | Page background |
| `--card` | `#2a2a2a` | Cards |
| `--card2` | `#323232` | Rows, tiles and nested cards inside a card |
| `--sunken` | `#1b1b1b` | Drawer, footer, code blocks, hero without art |
| `--line` | `#3d3d3d` | Borders |
| `--line-strong` | `#555` | Button borders |
| `--text` | `#ececec` | Body text |
| `--muted` | `#9b9b9b` | Secondary text, meta, counts. Nothing darker is ever text |
| `--accent` | `#66c0f4` | Focus ring, current tab, progress, hover border. Means "act" or "you are here" |
| `--accent-soft` | `#1d3a50` | Selected background (tab on, pressed stat card, picked row) |
| `--btn` | `#2a6e9e` | Primary button, start of bar and ring fills |
| `--btn-line` | `#4a9ad0` | Primary button border |
| `--btn-hover` | `#327bb0` | Primary button hover |
| `--btn2` | `#3a3a3a` | Secondary button |
| `--btn2-hover` | `#474747` | Secondary button hover |
| `--link` | `#8cc8ff` | Links in content |
| `--highlight` | `#ffd84a` | Search hits, "new" |
| `--danger-bg` | `#4a2424` | Error background |
| `--danger-line` | `#8a3a3a` | Error border |
| `--info-bg` | `#24384a` | Note background |
| `--info-line` | `#3a628a` | Note border |
| `--ok-bg` | `#2d4a24` | Success background |
| `--ok-line` | `#4f8a3a` | Success border. Green means success or Available only |
| `--gold-bg` | `#4a3d16` | Rare or perfect background |
| `--gold-line` | `#a8862a` | Rare or perfect |
| `--series-1` | `#3987e5` | Chart series 1 |
| `--series-2` | `#c98500` | Chart series 2 |
| `--series-3` | `#9085e9` | Chart series 3 |

- Pages use `var(--…)` only, never a hex value. The exceptions are colours with real meaning (a brand colour) and black or white overlays on art: `rgb(0 0 0 / x)` scrims and chips, `rgb(255 255 255 / x)` tracks.
- Three surface levels: `--bg` → `--card` → `--card2`. Text cards get depth from these steps, never from shadows. Shadows are for floating things (drawer, menus, dialogs, tooltips) and art: a cover has a small resting shadow and `var(--lift)` on hover.
- Blue means act or "you are here". Focus ring, current tab, progress, hover border, the primary button. Never decoration.
- Status colours are tinted backgrounds with a matching border: green for success and Available (`.ok`, `.badge.g`), red for errors and failures, `--info-*` for notes and Downloading, gold for rare or perfect. Small labels on top of art ("Available", "Requested") may be solid so they read over any picture.
- Gradients only where they do a job: scrims over art, bar and ring fills (`--btn` → `--accent`). No borders inside borders.
- `color-scheme: dark` is already set, so scrollbars and form controls are dark.

## Type and spacing

Font: `var(--font)`, the system font. Code and IDs: `var(--mono)`. No web fonts, no icon fonts.

| Text | Size |
|---|---|
| Page title `h1.page-title` | `clamp(24px, 4vw, 34px)`, bold. On art add `text-shadow: 0 2px 12px rgb(0 0 0 / .6)` |
| Headline number (stat card) | `clamp(22px, 3vw, 28px)`, 700 |
| Section heading outside cards | 20px, bold; its count 14px `--muted` |
| Card heading `.card h2` | 17px, 600, icon 22px |
| Sub-heading `h3`, name on a banner | 15px (banner 17px) |
| Body | browser default (16px), line-height 1.5 |
| Controls, rows, buttons, tile names | 14px, names 600 |
| Meta, counts, small buttons, stat labels | 13px, `--muted` |
| Badges, pills, tile labels, cover meta | 12px |
| Code, IDs, raw data | `var(--mono)` 12–13px |

| Thing | Value |
|---|---|
| Spacing scale | 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 28px, nothing else |
| Card padding | 16px (stat cards 14px 16px) |
| Gap between cards and art | 16px · stat cards 12px · tiles 10px |
| Gap inside lists | 6px rows · 8px tiles |
| Above a section heading | 28px (12px below) |
| Radius | 4px small art and avatars · 8px controls and covers · 12px cards, banners, hero · 999px pills |
| Content width | max 1280px, 16px side padding (`.page`) |

Never set `font-family` or a body font size in a page stylesheet, and don't invent sizes like 15.5px or 18px.

Numbers and dates: `num(n)` for numbers and `day(date)` for dates from `src/app/ui.tsx`; IDs in `.mono`. A rounded number ("3.41 TB") keeps the exact value in `title`.

## Layout that fits every screen: test at 320 · 390 · 768 · 1366 · 2560

Do

- Build mobile-first at 320px, then let it grow.
- Grids that choose their own columns, with `min(100%, …)` so one column never overflows: `repeat(auto-fill, minmax(min(100%, 340px), 1fr))`. Use `auto-fit` when a few items should stretch to fill the row (stat cards).
- `aspect-ratio` on every art card (2 / 3 covers) so the grid never jumps.
- `flex-wrap: wrap` on every toolbar, button row and hero body.
- `clamp()` for headings, hero height and repeated UI sizes.
- `min-width: 0` on grid and flex children that hold text, plus ellipsis on long names.
- Panels sized `width: min(460px, 100vw)`, so they're full-screen on phones.
- Images get `width`/`height` attributes and `height: auto`, so nothing jumps while loading.
- Wide data (tables, code): wrap only that block in `overflow-x: auto`.
- Tap targets at least 40px tall on touch.

Don't

- Scroll the page sideways at any width.
- Put fixed pixel widths on containers.
- Make separate mobile and desktop markup, or sniff the user agent.
- Hide anything essential behind hover. Hover may add detail (the overview), never the only copy of it.
- Use `body { overflow: hidden }` or `100vh` on content pages.
- Add a breakpoint "just in case". The header has one (640px, where its links move to their own row); most pages need none.

## Components: `src/app/components.css`

If a page needs something that isn't here and other pages could use it too, add it to `components.css` (from the site's `components.css` if it has one). Helpers: `.muted`, `.mono`, `.hide`. The site's drop zone, raw data tree and hub cards are left out because Arrmy has no use for them; copy them from the site if that changes.

### Buttons

One `.primary` per view. Everything else is a plain `.btn` or a link.

```tsx
<button className="btn primary">Save limits</button>
<button className="btn">Cancel</button>
<a className="btn small" href="/requests">Small link</a>
<button className="btn" disabled>Saving...</button>
```

### Cards in a grid

Text, tables and forms go in a `.card`. `.grid` picks its own column count; use `.masonry` for mixed heights. The count sits in the heading.

```tsx
<div className="grid">
  <section className="card">
    <h2>Problems <span className="n">2</span></h2>
    <p className="muted">Card content.</p>
  </section>
</div>
```

### Tiles

Small numbers inside a card. Headline numbers for the whole page are stat cards (see Page anatomy).

```tsx
<div className="tiles">
  <div className="tile"><b>1,204</b><span>episodes</span></div>
</div>
```

### Badges and pills

Status labels: `g` green (Available, success), `r` red (failed), `p` purple, `b` blue (Downloading). Tinted, never bright fills.

```tsx
<div className="badges">
  <span className="badge">Requested</span>
  <span className="badge g">Available</span>
  <span className="badge b">Downloading 35%</span>
  <span className="badge r">Failed Import</span>
  <span className="pill">S1–3</span>
</div>
```

### Row list

A list with an icon, a name and a value. Ranked top-N lists use the ranked list (see Page anatomy).

```tsx
<div className="rows">
  <div className="rowi"><span className="grow">Dune (2021)</span><small>12.4 GB</small></div>
</div>
```

### Key / value

Detail facts.

```tsx
<div className="kv">
  <span>Seasons</span><span>1–3</span>
  <span>Requested by</span><span>Sam</span>
</div>
```

### Table

Always inside `.table-wrap` so only the table scrolls on a phone. Numbers get `.num` (right-aligned). Add `.tall` to the wrap for long tables: it caps the height and keeps the header in view.

```tsx
<div className="table-wrap">
  <table className="table">
    <thead><tr><th>Person</th><th className="num">Requests</th></tr></thead>
    <tbody><tr><td>Sam</td><td className="num">8</td></tr></tbody>
  </table>
</div>
```

### Form

Each `<label>` wraps its text and its field. `.cols` puts fields side by side and stacks them on phones. The rules are under Forms below.

```tsx
<form action={saveLimits} className="form form-card">
  <label>
    Movie (optional)
    <input className="field" name="movieGb" type="number" inputMode="decimal" min="0" max="10000" step="0.1" />
    <small>The biggest movie file Radarr may download, in GB.</small>
  </label>
  <fieldset>
    <legend>Seasons</legend>
    <label className="check"><input type="checkbox" name="season" value="1" /> Season 1</label>
  </fieldset>
  <div className="actions">
    <button className="btn primary">Save limits</button>
  </div>
</form>
```

### Progress

Completion bars. The fill runs from `--btn` to `--accent`. The width is the one inline style that is fine.

```tsx
<div className="progress" role="progressbar" aria-valuenow={64} aria-valuemin={0} aria-valuemax={100}><i style={{ width: '64%' }} /></div>
```

### Jump links

Long pages only, and only for sections that exist.

```tsx
<nav className="jump"><a href="#problems">Problems</a><a href="#downloading">Downloading</a></nav>
```

### Pill tabs

Switch panels inside a card or a toolbar. The active one gets `.on`.

```tsx
<div className="stabs"><button className="on">All</button><button>Downloading</button></div>
```

### Toolbar and field

List pages get one sticky `.bar` under the hero. Content pages don't need one.

```tsx
<Form action="/" className="bar">
  <input className="field" type="search" name="q" placeholder="Dune" aria-label="Search movies" />
  <button className="btn primary">Search</button>
</Form>
```

### Messages

A plain sentence saying what happened and what to do.

```tsx
<p className="note">Loading...</p>
<p className="err">Radarr isn't responding. Try again in a minute.</p>
<p className="ok">Saved, and applied to Radarr and Sonarr.</p>
```

### Drawer

Details for a clicked item. Full width on phones; Esc closes it. Arrmy opens drawers with the native Popover API, so they need no client JS: the cover is a `<button popoverTarget>`, the drawer an `<aside popover>`.

```tsx
<button className="ar-cap" popoverTarget={`d-${id}`}>…</button>
<aside className="drawer" id={`d-${id}`} popover="auto" aria-label={title}>
  <button className="close" popoverTarget={`d-${id}`} popoverTargetAction="hide" aria-label="Close" title="Close">&times;</button>
  <h2>{title}</h2>
  <p className="muted">Slides in with transform only, in 180ms.</p>
</aside>
```

### Dialog

The native `<dialog>`: `showModal()` gives focus trapping, Esc and a backdrop for free. Needs a client component to call `showModal()`.

```tsx
<dialog className="dlg">
  <h2>Remove Dune</h2>
  <p className="muted">One short line about what this does.</p>
  <div className="actions"><button className="btn">Close</button></div>
</dialog>
```

### Forms

- Every field sits inside its `<label>`, label text first, so clicking the text focuses the field and no id is needed. Never use a placeholder instead of a label; a placeholder is only an example value.
- One field per row by default. Use `.cols` only for short fields that belong together. Forms sit in `.form-card` (max 560px wide) so fields don't stretch across the screen.
- Mark the optional fields with "(optional)" in the label. Never mark required ones with an asterisk.
- Use the right input: `type="number"` with `inputMode`, `min` and `max` for numbers, `<select>` for more than 4 fixed choices, radios in a `<fieldset>` for 2 to 4, a `.check` checkbox for yes/no.
- Errors: set `aria-invalid="true"` on the field (red border) and put what to fix in the label's `<small>`. Check a field when it loses focus or the form is sent, not on every key press. A failed send shows one `.err` above the buttons.
- A button is for actions that send, save or take a while; it is the view's one `.primary`, says what it does ("Save limits", not "Submit"), and is disabled with "Saving..." while it works. A form that posts to a server action uses `SubmitButton` from `src/app/submit-button.tsx`, which does that: `<SubmitButton className="btn primary" pending="Saving...">Save limits</SubmitButton>`.
- Buttons go last, in an `.actions` row, primary first.

### Icons

- Use an icon only when it helps people recognise something faster: links to outside services (Plex, Radarr, Sonarr), and the few controls everyone knows (close, search, copy, menu). Never decorate headings or buttons that already have clear text.
- UI icons are inline SVG in `currentColor`, so they follow the text colour. Put a reused one in `src/app/ui.tsx` instead of pasting the same SVG into several pages.
- Sizes: 16px beside text and in buttons, 22px in card headings, 24px in row lists. Art is not an icon.
- An icon-only button needs `aria-label` and `title`. A decorative icon gets `alt=""` or `aria-hidden="true"`.
- No icon fonts, no Font Awesome, and no emoji as icons or in titles, headings, menus or buttons.

### Page stylesheets

- Named `src/app/<page>/<page>.css`, starting with a one-line comment naming the page.
- Every class gets a short page prefix (`.adm-`, `.req-`) so nothing leaks. Page-only tokens get it too.
- Tokens only, no `transition: all`, no `!important` except for the `[hidden]` fix.

## Motion: quick, small, transform and opacity only

| Use | Duration | Property |
|---|---|---|
| Hover / focus colour | `var(--fast)` 120ms | background, border-color, color |
| Card lift on hover (stat cards, tiles) | `var(--fast)` | `translateY(-2px)`, accent border |
| Art lift on hover (covers) | `var(--base)` ease-out | `translateY(-3px)`, `var(--lift)` plus a 2px accent ring |
| Art zoom inside its frame | `var(--base)` ease-out | `scale(1.03)` |
| Ranked row on hover | `var(--fast)` | `translateX(4px)` |
| Chart part on hover | `var(--fast)` | the other parts fade to `opacity: .5` |
| Press | 60ms | `translateY(1px)` |
| Caret flip | 120ms | rotate |
| Drawer / panel | `var(--base)` 180ms ease-out | transform |
| Menu / dropdown | 120–150ms ease-out | opacity + 4px translate |

Never: entrance or scroll-reveal animations, staggered cards, animating width/height/top/margin, `transition: all`, anything over 200ms, colour flashes on hover. `globals.css` turns motion off for `prefers-reduced-motion`; loops and tilts started in JS must check it too, and stop when offscreen or the tab is hidden (`AutoRefresh` already skips hidden tabs).

## Writing: British English, plain words

- British spelling: colour, centre, organise, favourite, grey, licence (noun), metres.
- Plain words and short sentences. Say what something is or does. No hype, no jokes and no exclamation marks in interface text (titles, ledes, labels, buttons, messages).
- Capitals: page titles and header links use Title Case. Everything else uses sentence case: card headings, buttons, labels, tabs. Glossary terms keep their capital in the middle of a sentence ("Cancel Request", "Requests by person").
- Buttons start with a verb and say what happens: "Request", "Save seasons", "Try another release". Never "OK", "Submit" or "Click here". Link text says where it goes ("All Requests →").
- Full stops: none on titles, headings, labels or buttons. Ledes, help text and messages are sentences and get one.
- Numbers and dates: digits with thousands commas (1,204), a space before units (64 GB, 5 min, 14 h), dates as day month year (20 Oct 2026).
- Talk to the reader as "you". Contractions are fine (can't, don't). Messages say what happened and what to do, without blame or error codes.

## Content and clutter

- One job per page. One `.btn.primary` per view; everything else is a secondary button or a link.
- One line under the title, not a paragraph. Help text is one muted line where it's needed.
- Text in cards, art on the page. Text, tables and forms sit in `.card`s. Stat rows and grids of covers sit straight on the page under a section heading; never put a card around a grid of cards.
- Overview first, details on click (drawer, `<details>`), raw data last and collapsed.
- Hide what's empty. No empty cards, no "0 results" headings, no "coming soon" sections. One compact prompt at most. A stat card or section with no data is left out, not shown as 0.
- Every state has a sentence: loading says what's loading, errors say what failed and what to do. Never a spinner forever or a raw error object.
- Nothing plays or flashes on load. No autoplay, no popups.
- Muted text instead of extra headings or boxes.
- Credit data sources in the lede or a muted line at the bottom (the footer credits TMDB and OpenLibrary).

## Data, speed and safety

| Budget | Target |
|---|---|
| Content visible on 4G | under 1s |
| Layout shift after load | none |
| Interaction response | under 100ms |
| Render-blocking third-party requests | 0 |

- Next.js App Router with server components and server actions. Pages are complete HTML from the server; forms post to server actions, so they work before any JS loads. A client component (`'use client'`) only where the browser has to do something (`AutoRefresh`, a dialog). No UI or CSS libraries.
- Radarr, Sonarr, qBittorrent, LazyLibrarian, Audiobookshelf and Plex are only called from the server (`src/lib/`); their API keys never reach the browser.
- Big lists render in chunks of about 250 with "Show more"; filters filter in memory.
- Art: the hero image gets `fetchPriority="high"`. The first ~6 covers load eagerly, the rest `loading="lazy" decoding="async"`.
- React escapes text; never use `dangerouslySetInnerHTML` with API or user text. Check every id from a form on the server (`positiveInt`, `bookId` in `actions.ts`).
- Private data (IPs, API keys, passwords) is click-to-reveal and never goes in a URL.

## Accessibility and keyboard

- One `<h1>`, headings in order. `<button>` for actions, `<a>`/`<Link>` for navigation, never a clickable `<div>`.
- Every input has a `<label>` or `aria-label`; every image has `alt` (`alt=""` if decorative, which art behind text and posters next to their title always are).
- The blue `:focus-visible` ring is global. Art cards show the same ring on focus as on hover. Never remove an outline without a replacement.
- Rings and charts carry their numbers in words: `role="img"` with an `aria-label` ("Downloading 35%"), or a `role="progressbar"` with values.
- `aria-current="page"` on the current hero tab and header link, `aria-pressed` on stat cards that switch a chart, `aria-expanded` on toggles, native `popover` for drawers, native `<dialog>` for modals.
- Esc closes the innermost open thing. Enter activates. The search field is focused when the Search page opens.
- Every action answers within 100ms: disable the button and change its text while working.
- External links: `target="_blank" rel="noopener"`.

## Traps: things the reference pages had to fix

- Card links turn blue. `.page a` colours every link. A whole cover or stat card that is an `<a>` needs `color: var(--text); text-decoration: none` (already in `pieces.css` for the `ar-` pieces).
- `hidden` loses to your display. An element with `display: flex` or `grid` in your CSS stays visible when `hidden` is set. `.ar [hidden] { display: none !important; }` is in `pieces.css`.
- Text on art needs a scrim. Never rely on the picture being dark: put a black gradient between art and text, and a text shadow on big titles.
- Art goes missing. Posters can be absent (no poster, an old Request) or fail to load. With no poster the cover shows the name on `--card2`; never a broken-image icon.
- A bare button in your markup needs its own reset; `globals.css` doesn't style bare elements, but browsers do.

## Checklist: every page, before it ships

### Structure

- [ ] A `page.tsx` with `metadata.title`; no hand-written `<head>` or stylesheet imports of the global CSS
- [ ] In `NAV` in `layout.tsx` if it belongs in the header, with `aria-current` when it's the current page

### Look

- [ ] One `h1.page-title` with a one-line `.page-lede`, in a hero if the page has art
- [ ] Pages with art: hero with scrim, stat cards, section headings over art grids, like Steam Stats
- [ ] Only components, the Arrmy pieces and a prefixed page stylesheet; only `var(--…)` colours apart from overlays on art
- [ ] Sizes and spacing from the scales; radius 4 / 8 / 12 / 999
- [ ] One primary button; no empty sections; details behind a click
- [ ] Tables in `.table-wrap`; every form field inside its label; icons only where they help
- [ ] British spelling, plain words, sentence-case buttons and headings

### Screens

- [ ] No sideways scroll at 320 / 390 / 1366 / 2560
- [ ] Grids auto-fill; art has an aspect-ratio; long names ellipsis; images have dimensions

### Speed

- [ ] Server components by default; client components only where the browser must act
- [ ] Posters past the first screen lazy; big lists chunked

### Behaviour

- [ ] Loading, empty and error states all render sensibly; missing art falls back
- [ ] Esc closes, the keyboard reaches everything
- [ ] No API keys in HTML; no `console.log` left in
- [ ] Motion 200ms or less, transform and opacity only
- [ ] Card links in text colour; `[hidden]` works with your display
