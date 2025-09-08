# Change Log

## [0.10.2] - 08 Sep, 2025

### Fixed

- Made the parser logic for multi-line headers more robust, fixing several edge cases where highlighting would behave incorrectly.

## [0.10.1] - 08 Sep, 2025

### Updated

- Sample videos in README.md

## [0.10.0] - 08 Sep, 2025

### Changed

- Updated the `README.md` with more detailed information, embedded videos, and a focus on command-based configuration.

### Added

- New highlight style for single-line blocks (e.g., `def hello(): pass`) to provide better visual distinction with top and bottom borders.

### Fixed

- The parser now correctly identifies single-line blocks that contain a body on the same line.
- Fixed a bug where typing a block keyword (e.g., `def`) on a new line would cause the parser to greedily match with unrelated code below. Highlighting now only applies after a colon (`:`) is present.

## [0.9.12] - 03 Sep, 2025

### Fixed

- Corrected a bug in the Python parser that prevented multi-line block headers (e.g., function definitions spanning multiple lines) from being properly detected.

## [0.9.11] - 02 Sep, 2025

### Modified

- updated regex to extract description for release

## [0.9.10] - 02 Sep, 2025

### Modified

- updated logic to get version from package.json :) (early realisation)

## [0.9.9] - 02 Sep, 2025

### Modified

- create release to use PAT token instead of GITHUB TOKEN

## [0.9.8] - 02 Sep, 2025

### Added

- New workflow to create release
- RELEASE_NOTES for general audience

## [0.9.6] - 29 Aug, 2025

### Changed

- Optimized highlighting logic to only re-render when the block context changes, improving performance.

## [0.9.5] - 29 Aug, 2025

### Changed

- Improved highlighting logic to be more robust and responsive.
- Highlighting is now correctly restored when a selection is cleared.
- The selection stack is now properly cleared when the selection command chain is broken.

### Fixed

- Removed circular dependency in `package.json`.

## [0.9.4] - 05 Aug, 2025

### Fixed

- Corrected a bug where highlighting would not update properly after pressing Enter after a colon (`:`), ensuring the new line is not incorrectly styled as a header.

## [0.9.3] - 05 Aug, 2025

### Changed

- Updated block highlighting logic to correctly identify inner blocks.

## [0.9.2] - 04 Aug, 2025

### Changed

- Optimized block highlighting by checking if the cursor is within the current block before re-highlighting.

## [0.9.1] - 01 Aug, 2025

### Added

- New action buttons for selecting custom color web view.

### Changed

- Default value of the color picker to the currently set value.

## [0.9.0] - 31 Jul, 2025

### Added

- Custom color picker UI for changing the highlight color when opted for 'Custom' from the changeHighlightColor command.

## [0.8.0] - 15 Jul, 2025

### Added

- Undo Block Selection: A new command (`pyScope.undoBlockSelection`) and keybinding (`ctrl+alt+z` / `cmd+alt+z`) have been added to allow users to undo previous block selections, restoring the editor's selection and the highlighter's state.

### Changed

- Selection Stack Management: The `Select Block` command now pushes and pops selection states onto a stack, enabling the undo functionality.
- Highlighter State Management: The `Highlighter` now exposes `selectedNode` and `lastSelectionTimestamp` publicly and clears the selection stack upon state reset.
- Warning Message Update: The "No more parent blocks to select" message has been changed from an information message to a warning message.

## [0.7.0] - 14 Jul, 2025

### Added

- Hierarchical block selection: The 'Select Block' command now allows selecting parent blocks on successive calls, providing a powerful way to navigate code structure.

### Changed

- Optimized highlighting performance: Highlighting updates are now significantly faster and almost instantaneous, improving the overall responsiveness of the extension.
- Improved block selection logic: The underlying block tree management has been refined to ensure consistent and accurate selection behavior, resolving issues with stale data and unexpected "wrap-around" selections.

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
