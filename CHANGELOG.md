# Change Log

All notable changes to the "py-scope" extension will be documented in this file.

## v0.5.4 - 28 Mar, 2025

### Updated

- Block detection happens to async methods too.

### Added

- Border for first and last lines.

## v0.5.3 - 28 Feb, 2025

### Updated

- Find block header func to find the header end

---

## v0.5.2 - 18 Feb, 2025

### Fixed

- Find block header func to handle types too

---

## v0.5.1 - 17 Feb, 2025

### Fixed

- Block range identification logic handling indentation between pair of `"""` or `'''`

---

## v0.5.0 - 13 Feb, 2025

### Fixed

- Previously, if the block defining keyword, like def, is in one line, and the colon closing it is on another line (because of having multiple params in multiple lines), the block detection wouldn't happen, with this update, that issu has been fixed.

### Added

- New command that lets you select the entire highlighted block. You can find it in the commands by searching for `Select Block` or by using a shortcut `ctrl+alt+a` for windows, `cmd+alt+a` for mac

---

## v0.4.2 - 05 Feb, 2025

### Updated

- Segregated code in various file for code readability and structure

## v0.4.1 - 05 Feb, 2025

### Added

- Fixed commands for changing highlight color and opacities

---

## v0.4.0 - 05 Feb, 2025

### Added

- The user can now customize the opacity for both block highlight and first and last line highlights from settings and from commands

---

## v0.3.2 - 05 Feb, 2025

### Fixed

- Bug preventing from changing color

---

## v0.3.1 - 30 Jan, 2025

### Changed

- Included match (switch) and case for block keywords

---

## v0.3.0 - 29 Jan, 2025

### Changed

- Optimized logic for re-rendering/re-hghlighting the block

---

## v0.2.2 - 26 Jan, 2025

### Changed

- Updated preview GIFs

---

## v0.2.1 - 26 Jan, 2025

### Changed

- Fixed README

---

## v0.2.0 - 26 Jan, 2025

### Changed

- Highlighting color is no longer static
- Updated README.md

### Added

- User can now change the highlighting color from the settings or using a command

---

## v0.1.0 - 25 Jan, 2025

Stable release of the extension

### Added

- Extension icon

### Changed

- Git repo links

---

## v0.0.3 - 25 Jan, 2025

Checking if the extension icon is being applied or not.

---

## v0.0.2 - 25 Jan, 2025

### Changed

- Logic for setting block decoration and identifying block start

### Addded

- Logo
- LICENSE

---

## v0.0.1 - 25 Jan, 2025

### Added

- Identify code block and highlight them with a background color
