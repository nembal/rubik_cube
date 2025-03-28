// Import functions from cube module
import {
    initializeCube,
    requestMove,
    requestScramble,
    requestReset,
    requestUndo,
    getIsAnimating,
    clearFaceSelectionGraphics
} from './cube.js';

// Import the clearFaceSelectionGraphics function explicitly
import { clearFaceSelectionGraphics as clearFaceGraphicsFromCube } from './cube.js';

// Import the highlight/unhighlight functions
import { highlightFaceLabel, unhighlightFaceLabel } from './cube.js';

// --- UI Element References ---
let uiControlsPanel; // The main controls div
let modeCWButton, modeCCWButton;
let scrambleButton, undoButton, resetButton;
let revealScrambleButton;
let timerDisplay;
let scrambleContainer, scrambleSequenceWrapper;
// Keep track of move buttons for responsive hiding/showing based on label click
let allMoveButtons = [];

// --- UI State ---
let isCCWMode = false;
let isTimerRunning = false;
let timerStartTime = 0;
let timerIntervalId = null;
let awaitingFirstMove = false; // True after scramble, waiting for user's first move
let wasScrambledSinceLastSolve = false; // Track if solved state is meaningful
let isScrambleRevealed = false;
let currentScrambleSequence = []; // Store the sequence provided by cube.js
let selectedFace = null; // Track which face label (F, B, U, etc.) is conceptually selected

// --- Tutorial Functionality ---

// Helper function for delays using Promises
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Tutorial state flag
let tutorialOverlay = null;

async function playInteractionTutorial() {
    const tutorialPlayed = localStorage.getItem('cubeTutorialPlayed');
    if (tutorialPlayed) {
        console.log("Tutorial already played.");
        return;
    }
    console.log("Playing interaction tutorial...");

    // Create and show overlay to prevent interaction
    if (!tutorialOverlay) {
        tutorialOverlay = document.createElement('div');
        tutorialOverlay.style.position = 'fixed';
        tutorialOverlay.style.top = '0';
        tutorialOverlay.style.left = '0';
        tutorialOverlay.style.width = '100%';
        tutorialOverlay.style.height = '100%';
        tutorialOverlay.style.background = 'rgba(0, 0, 0, 0.3)';
        tutorialOverlay.style.color = 'white';
        tutorialOverlay.style.zIndex = '100';
        tutorialOverlay.style.display = 'flex';
        tutorialOverlay.style.justifyContent = 'center';
        tutorialOverlay.style.alignItems = 'center';
        tutorialOverlay.style.fontSize = '1.5em';
        tutorialOverlay.style.textAlign = 'center';
        tutorialOverlay.style.padding = '20px';
        tutorialOverlay.innerHTML = '<span>Loading Tutorial...</span>';
        document.body.appendChild(tutorialOverlay);
    }
    tutorialOverlay.style.display = 'flex'; // Make sure it's visible

    await wait(1500); // Initial pause

    // --- Step 1: CW Rotation ---
    tutorialOverlay.innerHTML = '<span>Tap a floating letter (e.g., U)...</span>';
    highlightFaceLabel('U');
    await wait(800);

    tutorialOverlay.innerHTML = '<span>DRAG --> to rotate Clockwise (U)</span>';
    requestMove('U'); // Simulate drag right
    await wait(800); // Wait for animation
    unhighlightFaceLabel('U');
    await wait(800); // Pause after move

    // --- Step 2: CCW Rotation ---
    tutorialOverlay.innerHTML = '<span> DRAG <-- to rotate Counter-Clockwise (U\')</span>';
    highlightFaceLabel('U');
    await wait(800);

    requestMove("U'"); // Simulate drag left
    await wait(800);
    unhighlightFaceLabel('U');
    await wait(800);

    // --- Step 3: Keyboard Hint ---
    tutorialOverlay.innerHTML = '<span>Keyboard: F, B, U, D, L, R .<br>Hold [Shift] for Counter-Clockwise (e.g., Shift + U = U\')</span>';
    await wait(1000);

    // --- Finish ---
    tutorialOverlay.innerHTML = '<span>Enjoy!</span>';
    await wait(500);

    tutorialOverlay.style.display = 'none'; // Hide overlay
    localStorage.setItem('cubeTutorialPlayed', 'true'); // Mark as played
    console.log("Tutorial finished.");
}

// --- Initialization ---

function initUI() {
    // Get references to all UI elements
    uiControlsPanel = document.getElementById('ui-controls');
    modeCWButton = document.getElementById('mode-cw-button');
    modeCCWButton = document.getElementById('mode-ccw-button');
    scrambleButton = document.getElementById('scramble-button');
    undoButton = document.getElementById('undo-button');
    resetButton = document.getElementById('reset-button');
    revealScrambleButton = document.getElementById('reveal-scramble-button');
    timerDisplay = document.getElementById('timer-display');
    scrambleContainer = document.getElementById('scramble-container');
    scrambleSequenceWrapper = document.getElementById('scramble-sequence-wrapper');
    allMoveButtons = document.querySelectorAll('#ui-controls button[data-face]');

    // Setup event listeners for UI elements
    setupEventListeners();

    // Initial UI state setup
    resetTimerDisplay();
    updateScrambleDisplay([]);
    applyScrambleBlur(false);
    if (revealScrambleButton) revealScrambleButton.disabled = true;
    if (undoButton) undoButton.disabled = true;
    updateModeIndicator();
    updateMoveButtonVisibility(); // Initial check based on screen size
    enableUI(true); // Initially enable UI

    console.log("UI Initialized.");
}

// --- Event Listener Setup ---

function setupEventListeners() {
    // Mode buttons
    if (modeCWButton) modeCWButton.addEventListener('click', handleModeCWClick);
    if (modeCCWButton) modeCCWButton.addEventListener('click', handleModeCCWClick);

    // Action buttons
    if (scrambleButton) scrambleButton.addEventListener('click', handleScrambleClick);
    if (resetButton) resetButton.addEventListener('click', handleResetClick);
    if (undoButton) undoButton.addEventListener('click', handleUndoClick);

    // Move buttons (F, F', etc.)
    allMoveButtons.forEach(button => {
        button.addEventListener('click', handleMoveButtonClick);
    });

    // Scramble display interactions
    if (scrambleContainer) scrambleContainer.addEventListener('click', handleScrambleMoveClick);
    if (revealScrambleButton) revealScrambleButton.addEventListener('click', handleRevealScrambleClick);

    // Global listeners
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleWindowResize); // Handle responsive UI changes
}

// --- Event Handlers ---

function handleModeCWClick() {
    if (getIsAnimating()) return;
    isCCWMode = false;
    updateModeIndicator();
}

function handleModeCCWClick() {
    if (getIsAnimating()) return;
    isCCWMode = true;
    updateModeIndicator();
}

function handleScrambleClick() {
    if (getIsAnimating()) return;
    currentScrambleSequence = requestScramble(); // Ask cube.js to scramble and get sequence
    updateScrambleDisplay(currentScrambleSequence);
    applyScrambleBlur(true); // Blur the displayed scramble initially
    isScrambleRevealed = false;
    if (revealScrambleButton) revealScrambleButton.disabled = false;
    stopTimer();
    resetTimerDisplay();
    awaitingFirstMove = true;
    wasScrambledSinceLastSolve = true;
    selectedFace = null; // Clear face selection on scramble
    updateMoveButtonVisibility();
    // enableUI(true) will be called by onAnimationEnd callback from cube.js
}

function handleResetClick() {
    if (getIsAnimating()) return;
    requestReset(); // Ask cube.js to reset
    stopTimer();
    resetTimerDisplay();
    updateScrambleDisplay([]); // Clear scramble display
    applyScrambleBlur(false);
    if (revealScrambleButton) revealScrambleButton.disabled = true;
    isScrambleRevealed = false;
    awaitingFirstMove = false;
    wasScrambledSinceLastSolve = false;
    selectedFace = null;
    updateMoveButtonVisibility();
    // enableUI(true) will be called by onAnimationEnd if needed, or resetCubeState handles it
}

function handleUndoClick() {
     console.log("ui.js: Undo button clicked.");
     // Basic check, cube.js does the more robust check
    if (getIsAnimating() || undoButton.disabled) {
        console.log("ui.js: Undo blocked by animation or disabled state.");
        return;
    }
    console.log("ui.js: Calling requestUndo().");
    requestUndo(); // Ask cube.js to handle undo
    // History update callback will update button state
    selectedFace = null; // Clear face selection on undo
    updateMoveButtonVisibility();
}

function handleMoveButtonClick(event) {
    if (getIsAnimating()) return;
    const button = event.currentTarget;
    const move = button.getAttribute('data-face');
    if (move) {
        if (awaitingFirstMove && !isTimerRunning && !isScrambleRevealed) {
             startTimer();
        }
        isCCWMode = move.includes("'"); // Set mode based on button clicked
        updateModeIndicator();
        requestMove(move); // Ask cube.js to perform the move
        selectedFace = null; // Clear conceptual face selection
        updateMoveButtonVisibility(); // Hide buttons if on mobile after click
    }
}

function handleScrambleMoveClick(event) {
    if (getIsAnimating()) return;
    const target = event.target;
    // Only act on clicks directly on a move span, not the container/button
    if (target.classList.contains('scramble-move')) {
        const indexToApply = parseInt(target.dataset.index, 10);
        if (isNaN(indexToApply) || !currentScrambleSequence || currentScrambleSequence.length === 0) return;

        console.log(`Applying scramble up to step ${indexToApply}`);
        // Need to reset the cube state AND apply partial scramble instantly
        requestReset(); // Reset cube first
        const partialSequence = currentScrambleSequence.slice(0, indexToApply + 1);

        // Apply instantly - cube.js handles the instant application
        cubeCallbacks.onAnimationStart(); // Disable UI during instant apply
        partialSequence.forEach(move => requestMove(move, true)); // Use requestMove with 'isUndo' flag to signify instant application without history
        cubeCallbacks.onAnimationEnd(); // Re-enable UI

        // Update UI state after instant application
        updateScrambleDisplay(currentScrambleSequence, indexToApply); // Highlight applied part
        applyScrambleBlur(!isScrambleRevealed);
        if (revealScrambleButton) revealScrambleButton.disabled = isScrambleRevealed;
        wasScrambledSinceLastSolve = true;
        awaitingFirstMove = true;
        isCCWMode = false;
        updateModeIndicator();
        stopTimer();
        resetTimerDisplay();
        selectedFace = null;
        updateMoveButtonVisibility();
    }
}


function handleRevealScrambleClick() {
    if (isScrambleRevealed || !revealScrambleButton || revealScrambleButton.disabled) return;
    isScrambleRevealed = true;
    applyScrambleBlur(false); // Unblur the text
    stopTimer(); // Stop timer if running when revealed
    if (revealScrambleButton) revealScrambleButton.disabled = true;
    awaitingFirstMove = false; // Revealing cancels the "start timer on first move" logic
}

function handleKeyDown(event) {
    if (getIsAnimating()) return;

    // Check if focus is on an input field to avoid hijacking typing
    const activeElement = document.activeElement;
    const isTyping = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable);

    // Undo key (Ctrl+Z or just Z/Space if not typing)
    const isUndoKey = (event.ctrlKey && event.key.toUpperCase() === 'Z') || (!isTyping && !event.ctrlKey && !event.metaKey && !event.altKey && (event.key.toUpperCase() === 'Z' || event.code === 'Space'));
    if (isUndoKey) {
        event.preventDefault();
        handleUndoClick(); // Trigger undo handler
        return;
    }

    // Shift key toggles mode (only if Shift is pressed alone)
    if (event.key === 'Shift' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        isCCWMode = !isCCWMode;
        updateModeIndicator();
        event.preventDefault();
        return;
    }

    // Ignore key presses with modifiers (except Ctrl+Z handled above) or if typing
    if (isTyping || event.metaKey || event.ctrlKey || event.altKey || ['Control', 'Alt', 'Meta', 'Shift'].includes(event.key)) {
        return;
    }

    // Handle move keys (F, B, U, D, L, R)
    let baseFace = null;
    const key = event.key.toUpperCase();
    switch (key) {
        case 'F': baseFace = 'F'; break;
        case 'B': baseFace = 'B'; break;
        case 'U': baseFace = 'U'; break;
        case 'D': baseFace = 'D'; break;
        case 'L': baseFace = 'L'; break;
        case 'R': baseFace = 'R'; break;
    }

    if (baseFace) {
        event.preventDefault(); // Prevent browser default actions for these keys
        if (awaitingFirstMove && !isTimerRunning && !isScrambleRevealed) {
             startTimer();
        }
        const moveNotation = isCCWMode ? baseFace + "'" : baseFace;
        requestMove(moveNotation); // Ask cube.js to perform the move
        selectedFace = null; // Clear face selection on key move
        updateMoveButtonVisibility();
    }
}

function handleWindowResize() {
    // Update button visibility based on new window size
    updateMoveButtonVisibility();
}


// --- UI Update Functions ---

function updateModeIndicator() {
    if (!modeCWButton || !modeCCWButton) return;
    if (isCCWMode) {
        modeCCWButton.classList.add('mode-active');
        modeCWButton.classList.remove('mode-active');
    } else {
        modeCWButton.classList.add('mode-active');
        modeCCWButton.classList.remove('mode-active');
    }
}

function updateMoveButtonVisibility() {
    const isMobile = window.innerWidth <= 768;
    allMoveButtons.forEach(btn => {
        // Use CSS for default hiding on mobile, only show specific ones if a face is selected
        if (isMobile) {
            btn.style.display = 'none'; // Default hide on mobile
        } else {
            btn.style.display = ''; // Default show on desktop (rely on flex)
        }
    });

    // If on mobile AND a face label is selected, show corresponding buttons
    if (isMobile && selectedFace) {
        const cwButton = document.querySelector(`#ui-controls button[data-face="${selectedFace}"]`);
        const ccwButton = document.querySelector(`#ui-controls button[data-face="${selectedFace}'"]`);
        if (cwButton) cwButton.style.display = 'flex'; // Show CW button
        if (ccwButton) ccwButton.style.display = 'flex'; // Show CCW button
    }
}

function enableUI(enabled) {
    console.log(`UI: enableUI(${enabled}) called. IsAnimating: ${getIsAnimating()}`);
    const shouldDisable = !enabled; // || getIsAnimating(); // Rely on callbacks for animation state

    // Disable all UI controls buttons if not enabled
    document.querySelectorAll('#ui-controls button').forEach(button => {
         button.disabled = shouldDisable;
    });

     // Specifically manage Undo button state based on history *and* enabled state
     if(undoButton) {
         // History length is managed via callback
         // undoButton.disabled should be updated in onHistoryUpdate callback
     }
     // Specifically manage Reveal button state
     if (revealScrambleButton) {
         revealScrambleButton.disabled = shouldDisable || isScrambleRevealed || !wasScrambledSinceLastSolve;
     }

    // Controls enabling/disabling is handled within cube.js based on animation state
}

function updateScrambleDisplay(sequence, activeIndex = -1) {
    if (!scrambleContainer || !scrambleSequenceWrapper) return;
    const labelSpan = scrambleContainer.querySelector('span:first-child');
    scrambleSequenceWrapper.innerHTML = ''; // Clear previous

    if (!sequence || sequence.length === 0) {
        scrambleSequenceWrapper.innerHTML = '(None)';
        if (labelSpan) labelSpan.style.display = 'inline'; // Show "Scramble:" label
    } else {
        if (labelSpan) labelSpan.style.display = 'inline'; // Show "Scramble:" label
        sequence.forEach((move, index) => {
            const span = document.createElement('span');
            span.classList.add('scramble-move');
            span.textContent = move;
            span.dataset.index = index; // Store index for click handler
            if (index === activeIndex) {
                span.classList.add('active'); // Highlight active move
            }
            scrambleSequenceWrapper.appendChild(span);
        });
    }
}

function applyScrambleBlur(shouldBeBlurred) {
    if (!scrambleSequenceWrapper) return;
    if (shouldBeBlurred) {
        scrambleSequenceWrapper.classList.add('blurred');
    } else {
        scrambleSequenceWrapper.classList.remove('blurred');
    }
}

// --- Timer Functions ---

function startTimer() {
    if (isTimerRunning || isScrambleRevealed) return; // Don't start if already running or revealed
    console.log("UI: Timer started!");
    isTimerRunning = true;
    awaitingFirstMove = false; // Timer is running, no longer awaiting
    timerStartTime = performance.now();
    // Update timer immediately and then set interval
    updateTimerDisplay();
    timerIntervalId = setInterval(updateTimerDisplay, 50); // Update roughly 20 times/sec

    // Optionally disable reveal button once timer starts? Or allow reveal to stop timer?
    // Current logic: Reveal stops timer.
}

function stopTimer() {
    if (isTimerRunning) {
        isTimerRunning = false;
        clearInterval(timerIntervalId);
        timerIntervalId = null;
        updateTimerDisplay(); // Update one last time to show final time
        console.log("UI: Timer stopped.");
    }
    awaitingFirstMove = false; // Timer stopped or never started
}

function resetTimerDisplay() {
    if (timerDisplay) timerDisplay.textContent = "0.00";
}

function updateTimerDisplay() {
    if (!timerDisplay) return;
    let elapsedTime = 0;
    if (isTimerRunning) {
        elapsedTime = (performance.now() - timerStartTime) / 1000;
    } else if (timerStartTime > 0 && !timerIntervalId) {
        // If timer was stopped, keep showing the final time (don't reset to 0)
        // This case is handled by stopTimer setting isTimerRunning=false first
        return;
    }
    timerDisplay.textContent = elapsedTime.toFixed(2);
}


// --- Callbacks for Cube Module ---
// These functions are called by cube.js to notify the UI about state changes.
const cubeCallbacks = {
    onAnimationStart: () => {
        console.log("UI Callback: onAnimationStart");
        enableUI(false); // Disable UI during animation
    },
    onAnimationEnd: () => {
        console.log("UI Callback: onAnimationEnd");
        enableUI(true); // Re-enable UI when animation finishes
        // Note: solve check happens in cube.js after animation end
    },
    onHistoryUpdate: (historyLength) => {
        console.log("UI Callback: onHistoryUpdate, length:", historyLength);
        if (undoButton) {
            undoButton.disabled = historyLength === 0 || getIsAnimating(); // Disable if no history or animating
        }
    },
    onSolve: () => {
        console.log("UI Callback: onSolve");
        stopTimer(); // Stop timer on solve
        wasScrambledSinceLastSolve = false; // Mark as solved
        awaitingFirstMove = false;
        // Confetti is triggered by cube.js
    },
    // Provide functions for cube.js to get UI state when needed
    getSelectedFace: () => selectedFace,
    clearFaceSelectionUI: () => {
        console.log(`UI Callback: clearFaceSelectionUI (current: ${selectedFace})`);
        if (selectedFace !== null) {
            selectedFace = null;
            updateMoveButtonVisibility();
            clearFaceGraphicsFromCube(); // Use the imported function directly
        }
    },
    isCCWMode: () => isCCWMode,
    // NEW: Callback for cube.js to set the selected face in the UI
    setSelectedFace: (faceId) => {
        console.log(`UI Callback: setSelectedFace(${faceId})`);
        selectedFace = faceId;
        updateMoveButtonVisibility();
    },
};


// --- Start the Application ---
document.addEventListener('DOMContentLoaded', () => {
    initUI(); // Initialize UI elements and listeners first
    initializeCube(cubeCallbacks); // Then initialize the cube graphics/logic, passing callbacks
    playInteractionTutorial(); // Call the tutorial
});