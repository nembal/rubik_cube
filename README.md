# 3x3x3 Rubik's Cube Simulator

An interactive 3D Rubik's Cube simulator built with HTML, CSS, JavaScript, and the Three.js library. Allows users to interact with the cube, scramble it, reset, undo moves, and time themselves.

**Live Demo:** [**https://cube.nembal.com/**](https://cube.nembal.com/)

## Features

* **Interactive 3D Cube:** Realistic 3D representation using Three.js.
* **Mouse Controls:**
    * Orbit controls (Right-click/Two-finger drag) to rotate the camera view.
    * Click face labels (F, B, U, D, L, R) to select a face.
    * Drag horizontally or vertically after selecting a face label to perform a move.
* **Button Controls:**
    * Dedicated buttons for each face move (F, F', B, B', etc.) on wider screens.
    * Buttons for Clockwise (CW) / Counter-Clockwise (CCW) mode selection (affects keyboard shortcuts).
    * **Scramble:** Randomly shuffles the cube using a standard algorithm.
    * **Reset:** Returns the cube to the solved state.
    * **Undo:** Reverts the last user move.
* **Keyboard Controls:**
    * Use keys F, B, U, D, L, R to perform moves (respects CW/CCW mode).
    * Use Shift key to temporarily toggle CW/CCW mode.
    * Use Spacebar or Z (or Ctrl+Z) to Undo moves.
* **Timer:** Starts automatically on the first move after a scramble (if scramble isn't revealed) and stops when the cube is solved or scramble is revealed.
* **Scramble Display:** Shows the current scramble sequence, which can be optionally revealed. Clicking moves in the sequence applies the scramble up to that point.
* **Responsive UI:** Adapts controls for different screen sizes.
* **Solve Detection:** Automatically detects when the cube reaches the solved state and stops the timer (includes confetti!).

## Tech Stack

* **HTML5:** Structure and content.
* **CSS3:** Styling and layout, including responsive design.
* **JavaScript (ES Modules):** Application logic, interaction, and state management.
* **Three.js:** Core 3D rendering library for the cube visualization and animation.
* **Font Awesome:** Icons for UI buttons.

## File Structure

* `index.html`: The main HTML file containing the page structure and UI elements. Loads CSS and the main JavaScript module (`ui.js`). Includes SEO and social media meta tags.
* `style.css`: Contains all the CSS rules for styling the page, UI controls, and responsive layout.
* `ui.js`: Handles user interactions (button clicks, key presses, pointer events related to UI), manages the UI state (timer, scramble display, button states, selected face), updates the DOM, and communicates requests (like moves, scramble, reset) to `cube.js`.
* `cube.js`: Manages the Three.js scene (setup, lighting, camera, renderer), creates and manipulates the 3D cube geometry, handles move logic (calculating rotations), performs animations, checks for solved state, manages move history for undo, and handles direct canvas interactions (like face label clicks/drags). It receives requests from `ui.js` and uses callbacks to notify `ui.js` about state changes (e.g., animation start/end, solve).
* `/public/`: Contains static assets like the social media preview image (`preview.png`).
* `/icons/` (Optional): Suggested location for favicon files (`favicon.ico`, `apple-touch-icon.png`, etc.).
* `manifest.json` (Optional): Web app manifest file, linked from `index.html`.

## How to Run Locally

To run this project locally, you need a simple web server because modern browsers restrict loading JavaScript modules (`type="module"`) directly from the `file:///` protocol due to security policies (CORS).

1.  **Ensure Python 3 is installed.** You can check by opening your terminal or command prompt and typing `python --version` or `python3 --version`.
2.  **Clone or download the repository.**
3.  **Navigate to the project directory** in your terminal:
    ```bash
    cd path/to/rubik_cube
    ```
4.  **Start the Python HTTP server** from within that directory:
    ```bash
    python -m http.server
    ```
    (If the above doesn't work, you might have an older Python version; try `python -m SimpleHTTPServer`)
5.  The terminal will show `Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...` (or similar).
6.  **Open your web browser** and go to: `http://localhost:8000` or `http://127.0.0.1:8000`.
7.  The cube simulator should load and function correctly.
8.  To stop the local server, go back to the terminal and press `Ctrl + C`.

Alternatively, if you use VS Code, the "Live Server" extension provides an easy one-click way to run a local server.

## How it Works

The application logic is split into two main JavaScript modules:

1.  **`ui.js` (User Interface Layer):**
    * Initializes by finding all necessary HTML elements.
    * Sets up event listeners for all buttons, key presses, and window resize.
    * Manages UI-specific state like the timer's running status, whether the scramble is revealed, the current interaction mode (CW/CCW), etc.
    * Updates the visual display (timer text, scramble sequence, button enabled/disabled states).
    * When a user action occurs (e.g., clicking "Scramble" or pressing 'F'), it calls corresponding exported functions from `cube.js` (e.g., `requestScramble()`, `requestMove('F')`).

2.  **`cube.js` (Cube Logic & Rendering Layer):**
    * Sets up the entire Three.js environment (scene, camera, renderer, lighting, controls).
    * Creates the 3D representation of the Rubik's Cube.
    * Contains the logic for applying moves (`applyMove`), which calculates which cubies need to rotate and around which axis.
    * Manages an animation queue (`animationQueue`) to process moves sequentially.
    * Runs the main animation loop (`animate`) via `requestAnimationFrame` to render the scene and process animations smoothly.
    * Includes functions for scrambling (`generateScramble`), resetting (`resetCubeState`), checking the solved state (`isSolved`), and handling move history/undo (`moveHistory`, `getInverseMove`, `requestUndo`).
    * Handles pointer events directly on the canvas for face label selection and drag-to-rotate gestures.
    * Accepts callbacks from `ui.js` during initialization (`initializeCube(callbacks)`). It uses these callbacks to notify `ui.js` when significant events occur (e.g., `onAnimationStart`, `onAnimationEnd`, `onSolve`, `onHistoryUpdate`) so the UI can update accordingly (e.g., disable buttons during animation).

This separation makes the code easier to manage: `ui.js` focuses on *what* the user sees and interacts with in the browser DOM, while `cube.js` focuses on the underlying 3D simulation and its rules.

## How to Modify

* **Visual Appearance (Colors, Fonts, Layout):** Most visual styling is controlled in `style.css`. Look for selectors matching the element IDs (e.g., `#ui-controls`, `#timer-display`) or classes (e.g., `.move-button`, `.mode-active`).
* **HTML Structure (Adding/Removing Buttons):** Edit the `index.html` file. Remember to update IDs/classes if needed and potentially adjust corresponding event listeners in `ui.js`.
* **UI Behavior (Button Clicks, Key Bindings):** Modify the event listeners and handlers within `ui.js` (e.g., `handleScrambleClick`, `handleKeyDown`).
* **Cube Appearance (Colors, Gaps):** Look for constants like `COLORS`, `GAP`, `CUBIE_SIZE` at the top of `cube.js`. Modifying `createRubiksCube` in `cube.js` would be needed for more complex geometry changes.
* **Animation Speed:** Change the `ANIMATION_SPEED` constant in `cube.js`.
* **Scramble Length/Algorithm:** Modify `SCRAMBLE_LENGTH` or the `generateScramble` function in `cube.js`.
* **Core Move/Rotation Logic:** The `applyMove` function in `cube.js` determines which cubies move and how they rotate. Changes here are complex.
* **Solve Check Logic:** The `isSolved` function in `cube.js` compares current cubie positions/rotations to their initial states.

## Deployment (Vercel)

This project is deployed as a static site on Vercel. Key settings for correct deployment:

* **Framework Preset:** `Other`
* **Root Directory:** Set to the directory within your Git repository that contains `index.html` (in this case, likely left blank or as `./` since `index.html` is in the repository root).
* **Output Directory:** Override setting enabled, field left **blank**. This prevents Vercel from defaulting to serving only the `/public` directory.
* `vercel.json`: Not strictly required for this basic setup, but if used, ensure it doesn't contain a restrictive `builds` configuration.

## Potential Future Improvements

* Add touch controls for mobile interaction (swipe on faces).
* Implement different cube sizes (2x2x2, 4x4x4).
* Save and display best solve times (using LocalStorage).
* Add cube solving aids or algorithms visualisation.
* Optimize rendering performance.
* Improve drag-to-rotate gesture logic for more intuitive control based on camera angle.
* Add sound effects for moves.
* Create a proper `manifest.json` and icons for PWA functionality.