# Implementation Plan - UI Overhaul (Glassmorphism)

## Goal Description
Update the userscript's UI to match the "Glassmorphism/iOS Control Center" style provided in the reference image. This involves refining the CSS to achieve a premium, translucent, and depth-rich appearance.

## Proposed Changes

### [Userscript]
#### [MODIFY] [cdn-server-info.user.js](file:///Users/zhousulong/LocalFiles/GitHub/cdn-server-info-userscript/cdn-server-info.user.js)
- **CSS Update (`getPanelCSS`)**:
    - **Container**:
        - Increase `border-radius` to `24px` or `30px`.
        - Refine `background-color` to be more translucent (e.g., `rgba(20, 20, 20, 0.6)` for dark mode).
        - Enhance `backdrop-filter` to `blur(25px)` or `saturate(180%) blur(20px)` for that "frosted glass" look.
        - Add subtle white border `1px solid rgba(255, 255, 255, 0.1)` to define edges.
        - Add complex `box-shadow` for depth (e.g., soft drop shadow + inner highlight).
    - **Typography**:
        - Ensure font is `SF Pro Display`, `-apple-system`, or similar.
        - Improve contrast and weight (bold labels, lighter values or vice versa).
    - **Layout**:
        - Add more padding (`16px` or `20px`).
        - Refine spacing between items.
    - **Animations**:
        - Smooth hover effects (scale up slightly, brighten background).

## Verification Plan

### Manual Verification
1.  **Visual Check**: Install script and visit a site. Compare the panel against the reference image.
2.  **Theme Check**: Verify both Dark and Light modes (though the image implies a dark/glassy default, we should maintain light mode support or make it adapt nicely).
3.  **Interaction**: Check dragging and hovering behavior.
