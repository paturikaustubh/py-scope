# Release Notes

---

## **v0.10.2** — _08 Sep 2025_

**Bug Fixes**

- Minor bug fixes and improvements to highlighting accuracy.

---

## **v0.10.0** — _08 Sep 2025_

**Documentation**

- The `README.md` has been completely revamped with more detailed explanations and embedded videos to better showcase the extension's features.
- The documentation now emphasizes command-based configuration for a more streamlined user experience.

**Bug Fixes & Enhancements**

- **Improved Highlighting Accuracy:** Single-line blocks (e.g., `def hello(): ...`) are now handled correctly. Highlighting will also no longer appear prematurely while you are still typing a new function or class definition.
- **New Single-Line Block Style:** These single-line blocks now get their own distinct highlight style with a full box border, making them easier to spot.

---

## **v0.9.12** — _03 Sep 2025_

**Bug Fixes**

- Fixed a critical bug where code blocks with multi-line headers (e.g., function definitions with parameters spanning multiple lines) were not being detected. Highlighting for these structures now works correctly.

---

## **v0.9.6** — _29 Aug 2025_

**Performance Improvements**

- Optimized highlighting logic to only re-render when the block context changes.
- Reduced unnecessary DOM updates, improving overall responsiveness.

---

## **v0.9.5** — _29 Aug 2025_

**Enhancements**

- Improved highlighting logic for better accuracy and responsiveness.
- Highlights are now restored automatically when the selection is cleared.
- Fixed selection stack issues to handle interrupted command chains.

**Bug Fixes**

- Removed circular dependency in `package.json`.

---

## **v0.9.0** — _12 Aug 2025_

**New Features**

- Added **custom color picker** for highlights.
- Updated commands to manage highlight color preferences.

---

## **v0.8.0** — _27 Jul 2025_

**New Features**

- Introduced **Undo Block Selection** command.
- Improved highlighting refresh logic and selection tracking.

---

## **v0.7.0** — _05 Jul 2025_

**Major Update**

- Added **hierarchical block selection** for better navigation.
- Significant performance improvements during block rendering.

---

## **v0.5.0** — _12 Jun 2025_

**New Commands**

- Added **Select Block** command to quickly highlight code structures.

**Bug Fixes**

- Fixed block detection issues causing incorrect highlights in nested blocks.

---

## **v0.4.0** — _29 May 2025_

**Customizations**

- Added support for **customizable highlight opacity** via settings.
- Improved UX for managing highlight preferences.

---

## **v0.2.0** — _18 Apr 2025_

**New Features**

- Added **custom highlight colors** in settings.
- Introduced commands for quick color switching.

---

## **v0.1.0** — _02 Apr 2025_

**Enhancements**

- Added extension icon for better visibility.
- Improved command palette integration.

---

## **v0.0.1** — _12 Mar 2025_

**Initial Release**

- Introduced **Python block detection & highlighting**.
- Added commands for quick selection and highlighting.
