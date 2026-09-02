# Apple HIG Designer Skill

A Claude Code skill for designing Apple-style interfaces that follow the [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines).

## What It Does

When activated, this skill enables Claude Code to produce HIG-compliant UI code with:

- **San Francisco typography** with correct Display/Text thresholds
- **Apple system colors** with full light/dark mode support
- **8pt grid spacing** and 44pt minimum touch targets
- **SF Symbols** integration with proper rendering modes
- **WCAG AA accessibility** including VoiceOver, Dynamic Type, reduced motion
- **Platform-specific design** for iOS, iPadOS, macOS, watchOS, tvOS, and visionOS
- **Liquid Glass** support (iOS 26+ / 2025 design language)

## Coverage

| Area | File | Lines |
|------|------|-------|
| Core skill | `SKILL.md` | 455 |
| Extended components | `references/components.md` | 283 |
| UX patterns | `references/patterns.md` | 157 |
| Inputs & platforms | `references/inputs-and-platforms.md` | 246 |
| Liquid Glass | `references/liquid-glass.md` | 273 |
| Technologies | `references/technologies.md` | 194 |
| **Total** | | **1,608** |

### HIG Topics Covered

- **Foundations:** Typography, colors, spacing, layout, safe areas, accessibility, SF Symbols, animation
- **Components:** Buttons, navigation bars, tab bars, cards, sheets, alerts, search, menus, pickers, toggles, progress indicators, popovers, sidebars, segmented controls, sliders, steppers, text fields
- **Patterns:** Navigation, onboarding, settings, loading/empty states, error handling, sharing, drag & drop, feedback/haptics, undo, data entry, authentication, permissions, file management, collaboration
- **Inputs:** Touch gestures, hardware keyboard, pointer/trackpad, Apple Pencil, game controllers
- **Platforms:** iOS, iPadOS (multitasking), macOS (menu bar, windows), watchOS (complications, Digital Crown), tvOS (focus navigation), visionOS (spatial design, eye+hand interaction)
- **Technologies:** Widgets, notifications, Live Activities, App Intents/Siri, SharePlay, App Clips
- **Liquid Glass:** iOS 26+ translucent materials, dynamic tinting, fluid interactions

## Installation

### Claude Code (local)

Copy the skill files to your Claude Code skills directory:

```bash
# Copy SKILL.md
cp SKILL.md ~/.claude/skills/apple-hig-designer.md

# Copy reference files
mkdir -p ~/.claude/skills/references
cp references/*.md ~/.claude/skills/references/
```

### Claude Code (project)

Add to your project's `.claude/skills/` directory for project-scoped use.

## Trigger Phrases

The skill activates when you ask for:
- "Design an Apple-style..." / "苹果风格的界面"
- "Create a HIG-compliant..." / "符合 HIG 的设计"
- "iOS/macOS style component"
- "Make it look native on iPhone"
- "visionOS spatial interface"

## License

MIT
