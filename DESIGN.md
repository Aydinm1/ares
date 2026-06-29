# Aydin Design System

This document describes the design system currently implemented by the
Assignments and 4 Year Plan pages. It is a maintenance guide, not a second
stylesheet.

## Sources of Truth

Use this order when sources disagree:

1. The current rendered Assignments and 4 Year Plan pages.
2. Tokens in `app/globals.css`.
3. Component rules in the CSS modules under `components/`.
4. This document.
5. The archived Stitch export in `design-reference/stitch/`.

The Stitch screen establishes the visual direction, but exported Tailwind,
Material Symbols, inactive navigation, search, profile, resources, and
dashboard widgets are not part of the product.

## Product Character

Aydin is a quiet academic workspace built for repeated daily use. It should
feel precise, compact, and easy to scan.

- Favor information density over decorative presentation.
- Use open page layouts and bordered working surfaces, not nested cards.
- Use color to communicate action or status, not as decoration.
- Keep labels direct and short.
- Preserve stable geometry while data loads or changes.

## Foundation

### Color Tokens

| Token | Value | Use |
| --- | --- | --- |
| `--assignment-bg` | `#f7f9ff` | Application canvas |
| `--assignment-surface` | `#ffffff` | Sidebar, panels, rows, overlays |
| `--assignment-text` | `#181c20` | Primary text |
| `--assignment-muted` | `#5f6673` | Metadata and secondary labels |
| `--assignment-border` | `#d9dee8` | Standard dividers and panel borders |
| `--assignment-border-strong` | `#c1c8d5` | Controls and stronger boundaries |
| `--assignment-blue` | `#005bc0` | Primary actions and active navigation |
| `--assignment-blue-hover` | `#004da3` | Primary-action hover |
| `--assignment-blue-soft` | `#e7efff` | Selected and hover backgrounds |
| `--assignment-success` | `#168447` | Successful Airtable synchronization |
| `--assignment-danger` | `#ba1a1a` | Errors and destructive status |

Feature-specific course markers may use additional accessible colors, but
page chrome must continue using the shared tokens.

### Typography

- Font family: Figtree from `next/font`, with Arial as fallback.
- Page headings: `28-36px`, weight `700`, responsive through `clamp()`.
- Panel and row titles: `14px`, weight `700`.
- Navigation and controls: `12-13px`, weight `500-700`.
- Dense course rows: `11px` names and `10px` metadata.
- Supporting text: `11-13px`.
- Letter spacing remains `0`; hierarchy comes from size, weight, and color.
- Do not reduce interactive or essential text below the current course-row
  sizes.

### Spacing and Shape

- Use a 4px base spacing rhythm, with 8px increments for normal layout.
- Working panels use `12-14px` radii and crisp 1px borders.
- Controls use `5-8px` radii unless they are established pill actions.
- Shadows are reserved for temporary overlays such as course details.
- Do not introduce decorative gradients, blobs, or floating page sections.

## Application Shell

Desktop uses a fixed `204px` navigation rail and a fluid content region.
Assignments and 4 Year Plan are the only primary destinations.

- The sidebar and mobile header share the Academic Precision brand.
- Active navigation uses the blue-soft background and blue icon/text.
- Main content keeps a readable maximum width and consistent left alignment.
- The Airtable sync surface sits opposite the page heading on desktop and
  becomes full-width below it on narrow screens.
- Mobile replaces the sidebar with the compact top navigation.

## Assignments

- Desktop presents the assignment list and month calendar together.
- The list is the primary surface; the calendar is a narrower companion.
- Assignment rows use a native checkbox, title/course metadata, and a
  right-aligned due state.
- Course identity is shown with a small stable color marker.
- Completion is optimistic, but saving and error states must remain visible.
- Filtering lives in the panel header. Secondary options open from the filter
  icon and close on outside interaction.
- On mobile, List and Calendar use a segmented switch rather than rendering
  both cramped side by side.

## 4 Year Plan

- All 13 quarters remain visible on one page; quarter tabs are prohibited.
- Desktop groups quarters into four horizontal academic-year bands.
- Each quarter contains compact course rows with name, units, and grade.
- Year 2 may contain four quarter columns; the other years contain three.
- Course details open as a small anchored overlay on desktop and a bottom
  sheet on mobile.
- GE and major requirements use restrained blue and green tags only inside
  the detail overlay.
- At tablet width, quarters become a two-column grid. At `430px` and below,
  they become one column.

## Interaction and Accessibility

- Use Lucide icons for recognizable actions and navigation.
- Icon-only controls require an accessible label and visible hover tooltip
  when their meaning is not obvious.
- All controls require visible `:focus-visible` treatment.
- Native checkboxes remain keyboard operable.
- Selected, saving, success, error, overdue, and disabled states must not rely
  on color alone.
- Clicking outside temporary menus or overlays closes them; Escape closes
  dialogs and course details.
- Loading skeletons must preserve the final layout footprint.
- Pages must have no horizontal overflow at `1440x900`, `1280x800`,
  `390x844`, or `360x800`.

## Extension Rules

New pages must reuse the existing shell, header, tokens, typography, and
control patterns before introducing new primitives. Add a shared abstraction
only when at least two active product surfaces need it.

Do not reintroduce archived dashboard, calendar integration, attendance,
resource, syllabus intake, or class-creation UI as inactive navigation or
placeholder cards. A feature joins the shell only when its complete workflow
is implemented and tested.
