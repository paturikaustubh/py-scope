# Change Log

All notable changes to the "py-scope" extension will be documented in this file.

## [Unreleased]

## [0.6.0] - 09 Jul, 2025
### Fixed
- Resolve firstLastLine color blending issue.

## [0.5.6] - 09 Apr, 2025
### Fixed
- Block header highlight fix for single line header

## [0.5.5] - 08 Apr, 2025
### Changed
- Block header highlight with border bottom logic updated to have border only for the last line in the header.

## [0.5.4] - 28 Mar, 2025
### Changed
- Block detection happens to async methods too.
### Added
- Border for first and last lines.

## [0.5.3] - 28 Feb, 2025
### Changed
- Find block header func to find the header end

## [0.5.2] - 18 Feb, 2025
### Fixed
- Find block header func to handle types too

## [0.5.1] - 17 Feb, 2025
### Fixed
- Block range identification logic handling indentation between pair of `"""` or `'''`

## [0.5.0] - 13 Feb, 2025
### Fixed
- Previously, if the block defining keyword, like def, is in one line, and the colon closing it is on another line (because of having multiple params in multiple lines), the block detection wouldn't happen, with this update, that issu has been fixed.
### Added
- New command that lets you select the entire highlighted block. You can find it in the commands by searching for `Select Block` or by using a shortcut `ctrl+alt+a` for windows, `cmd+alt+a` for mac

## [0.4.2] - 05 Feb, 2025
### Changed
- Segregated code in various file for code readability and structure

## [0.4.1] - 05 Feb, 2025
### Added
- Fixed commands for changing highlight color and opacities

## [0.4.0] - 05 Feb, 2025
### Added
- The user can now customize the opacity for both block highlight and first and last line highlights from settings and from commands

## [0.3.2] - 05 Feb, 2025
### Fixed
- Bug preventing from changing color

## [0.3.1] - 30 Jan, 2025
### Changed
- Included match (switch) and case for block keywords

## [0.3.0] - 29 Jan, 2025
### Changed
- Optimized logic for re-rendering/re-hghlighting the block

## [0.2.2] - 26 Jan, 2025
### Changed
- Updated preview GIFs

## [0.2.1] - 26 Jan, 2025
### Changed
- Fixed README

## [0.2.0] - 26 Jan, 2025
### Changed
- Highlighting color is no longer static
- Updated README.md
### Added
- User can now change the highlighting color from the settings or using a command

## [0.1.0] - 25 Jan, 2025
### Added
- Extension icon
### Changed
- Git repo links

## [0.0.3] - 25 Jan, 2025
### Changed
- Checking if the extension icon is being applied or not.

## [0.0.2] - 25 Jan, 2025
### Changed
- Logic for setting block decoration and identifying block start
### Added
- Logo
- LICENSE

## [0.0.1] - 25 Jan, 2025
### Added
- Identify code block and highlight them with a background color