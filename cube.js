// Import Three.js using full CDN URLs
import * as THREE from 'https://esm.sh/three@0.150.1';
import { OrbitControls } from 'https://esm.sh/three@0.150.1/examples/jsm/controls/OrbitControls.js';

// --- Constants ---
const CUBE_SIZE = 3;
const CUBIE_SIZE = 1;
const GAP = 0.1;
const TOTAL_CUBE_DIM = CUBIE_SIZE * CUBE_SIZE + GAP * (CUBE_SIZE - 1);
const ANIMATION_SPEED = 0.1; // Adjust animation speed (rad/frame)
const ROTATION_ANGLE = Math.PI / 2; // 90 degrees
const SCRAMBLE_LENGTH = 20;
const SOLVED_POS_EPSILON = 0.1; // Tolerance for position check
const SOLVED_QUAT_EPSILON = 0.01; // Tolerance for quaternion check (angle)
const HALF_TOTAL_CUBE_DIM = TOTAL_CUBE_DIM / 2;
const LABEL_OFFSET = HALF_TOTAL_CUBE_DIM + CUBIE_SIZE * 0.6; // Distance of face labels from center
const LABEL_SIZE = TOTAL_CUBE_DIM * 0.3; // Size of the face labels
const COLORS = { // Color palette
    WHITE: 0xffffff, YELLOW: 0xffff00, BLUE: 0x0000ff, GREEN: 0x00ff00,
    RED: 0xff0000, ORANGE: 0xffa500, BLACK: 0x1a1a1a, LABEL: 0xdddddd
};
const SELECTED_LABEL_COLOR = new THREE.Color(0xffaa00); // Highlight color for selected label

// --- Module Scope Variables ---
let scene, camera, renderer, controls;
let allCubies = []; // Array holding all cubie meshes
let initialCubieStates = []; // Stores initial position/rotation for reset and solve check
let pivot = new THREE.Group(); // Helper object for rotations

// Animation State
let isAnimating = false;
let animationQueue = []; // Queue of moves to animate
let currentAnimation = null; // Details of the current animation step

// Cube Logic State
let moveHistory = []; // Tracks user moves for undo

// Interaction State
let raycaster = new THREE.Raycaster();
let pointer = new THREE.Vector2();
let faceLabels = []; // Sprites used for face interaction
let pointerDownOnLabel = false;
let dragStartX = 0, dragStartY = 0;
let isDraggingForRotation = false;
const dragThreshold = 0.05; // How far pointer must move to trigger drag-rotate

// Callbacks for UI interaction
let uiCallbacks = {
    onAnimationStart: () => {},
    onAnimationEnd: () => {},
    onHistoryUpdate: () => {},
    onSolve: () => {},
    getSelectedFace: () => null, // Function provided by UI to get selected face
    clearFaceSelectionUI: () => {}, // Function provided by UI to clear selection visually
    isCCWMode: () => false // Function provided by UI to check mode
};


// --- Core Graphics Functions ---

function initGraphics() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x282c34); // Match body background
    scene.add(pivot); // Add pivot group to the scene

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(TOTAL_CUBE_DIM * 1.5, TOTAL_CUBE_DIM * 1.5, TOTAL_CUBE_DIM * 1.5);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement); // Add canvas to body

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.target.set(0, 0, 0); // Point controls at the center
    controls.enabled = true; // Initially enabled

    // Add event listeners directly related to the canvas
    renderer.domElement.addEventListener('pointerdown', onPointerDown, false);
    renderer.domElement.addEventListener('pointermove', onPointerMove, false);
    renderer.domElement.addEventListener('pointerup', onPointerUp, false);
    window.addEventListener('resize', onWindowResize, false);

    createRubiksCube(); // Create the cubies
    createAllFaceLabels(); // Create interaction labels
    animate(); // Start the render loop

    console.log("Cube Graphics Initialized.");
}

function createRubiksCube() {
    // Clear previous cubies if any
    allCubies.forEach(cubie => scene.remove(cubie));
    allCubies = [];
    initialCubieStates = [];

    const cubieGeometry = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);

    // Create 26 cubies (3x3x3 minus the center)
    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                if (x === 0 && y === 0 && z === 0) continue; // Skip the center cubie

                // Determine face colors based on position
                const materials = [
                    (x === 1) ? new THREE.MeshStandardMaterial({ color: COLORS.RED }) : new THREE.MeshStandardMaterial({ color: COLORS.BLACK }), // Right face (+X)
                    (x === -1) ? new THREE.MeshStandardMaterial({ color: COLORS.ORANGE }) : new THREE.MeshStandardMaterial({ color: COLORS.BLACK }), // Left face (-X)
                    (y === 1) ? new THREE.MeshStandardMaterial({ color: COLORS.WHITE }) : new THREE.MeshStandardMaterial({ color: COLORS.BLACK }), // Top face (+Y)
                    (y === -1) ? new THREE.MeshStandardMaterial({ color: COLORS.YELLOW }) : new THREE.MeshStandardMaterial({ color: COLORS.BLACK }), // Bottom face (-Y)
                    (z === 1) ? new THREE.MeshStandardMaterial({ color: COLORS.BLUE }) : new THREE.MeshStandardMaterial({ color: COLORS.BLACK }), // Front face (+Z)
                    (z === -1) ? new THREE.MeshStandardMaterial({ color: COLORS.GREEN }) : new THREE.MeshStandardMaterial({ color: COLORS.BLACK }), // Back face (-Z)
                ];

                const cubie = new THREE.Mesh(cubieGeometry, materials);
                const position = new THREE.Vector3(
                    x * (CUBIE_SIZE + GAP),
                    y * (CUBIE_SIZE + GAP),
                    z * (CUBIE_SIZE + GAP)
                );
                cubie.position.copy(position);
                cubie.updateMatrixWorld(); // Ensure world matrix is up to date

                // Store initial state for reset and solve check
                initialCubieStates.push({
                    mesh: cubie,
                    position: cubie.position.clone(),
                    quaternion: cubie.quaternion.clone()
                });

                scene.add(cubie);
                allCubies.push(cubie);
            }
        }
    }
}

function createAllFaceLabels() {
    faceLabels.forEach(label => scene.remove(label));
    faceLabels = [];
    const labelColor = new THREE.Color(COLORS.LABEL);

    const labelsData = [
        { text: 'F', position: new THREE.Vector3(0, 0, LABEL_OFFSET) },
        { text: 'B', position: new THREE.Vector3(0, 0, -LABEL_OFFSET) },
        { text: 'U', position: new THREE.Vector3(0, LABEL_OFFSET, 0) },
        { text: 'D', position: new THREE.Vector3(0, -LABEL_OFFSET, 0) },
        { text: 'R', position: new THREE.Vector3(LABEL_OFFSET, 0, 0) },
        { text: 'L', position: new THREE.Vector3(-LABEL_OFFSET, 0, 0) },
    ];

    labelsData.forEach(data => {
        const label = createFaceLabel(data.text, data.position, labelColor, LABEL_SIZE);
        faceLabels.push(label);
        scene.add(label);
    });
}

function createFaceLabel(text, position, color, size) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const fontFace = "Arial";
    const fontSize = 64; // High resolution for texture
    context.font = `Bold ${fontSize}px ${fontFace}`;
    const textWidth = context.measureText(text).width;

    // Adjust canvas size to fit text
    canvas.width = textWidth + 20; // Add padding
    canvas.height = fontSize + 20;

    // Redraw text on sized canvas
    context.font = `Bold ${fontSize}px ${fontFace}`;
    context.fillStyle = `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, 1.0)`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, color: color.clone() });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);

    // Scale sprite based on canvas aspect ratio
    const aspect = canvas.width / canvas.height;
    sprite.scale.set(size * aspect, size, 1);
    sprite.userData.face = text; // Store face identifier

    return sprite;
}

function clearFaceSelectionGraphics() {
    faceLabels.forEach(label => label.material.color.set(COLORS.LABEL));
    isDraggingForRotation = false;
    // Let UI module handle actual 'selectedFace' state if needed elsewhere
}

function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Required if enableDamping is true

    if (currentAnimation) {
        const { targetAngle, rotationAxis } = currentAnimation;
        let { currentAngle } = currentAnimation;

        const deltaAngle = Math.sign(targetAngle) * ANIMATION_SPEED;
        const remainingAngle = targetAngle - currentAngle;

        // Don't overshoot the target angle
        const rotateBy = Math.abs(deltaAngle) > Math.abs(remainingAngle) ? remainingAngle : deltaAngle;

        pivot.rotateOnWorldAxis(rotationAxis, rotateBy);
        currentAnimation.currentAngle += rotateBy;

        // Check if animation step is complete
        if (Math.abs(currentAnimation.currentAngle - targetAngle) < 0.001) {
            // Ensure exact final rotation
            // pivot.rotation.setFromAxisAngle(rotationAxis, targetAngle); // Alternative: Force exact final state

            pivot.updateMatrixWorld(true); // Update world matrix of pivot

            // Detach cubies from pivot and attach back to scene
            const childrenToDetach = [...pivot.children];
            childrenToDetach.forEach(cubie => scene.attach(cubie));

            pivot.rotation.set(0, 0, 0); // Reset pivot rotation
            currentAnimation = null;
            startNextAnimation(); // Start next animation in queue or signal end
        }
    }

    renderer.render(scene, camera);
}

function startNextAnimation() {
    if (animationQueue.length === 0) {
        isAnimating = false;
        controls.enabled = true; // Re-enable orbit controls
        uiCallbacks.onAnimationEnd(); // Notify UI
        checkSolveState(); // Check if solved after moves complete
        return;
    }

    // Start next animation if queue is not empty
    isAnimating = true;
    controls.enabled = false; // Disable orbit controls during animation
    uiCallbacks.onAnimationStart(); // Notify UI

    const move = animationQueue.shift();
    applyMove(move, false); // Start the animation for this move
}


// --- Cube Logic Functions ---

function applyMove(moveNotation, instant = false) {
    let axis = null, layer = 0, direction = 1, angleMultiplier = 1;
    const face = moveNotation.charAt(0);
    const modifier = moveNotation.substring(1);

    if (modifier === "'") { // Prime move (counter-clockwise)
        direction = -1;
    } else if (modifier === '2') { // Double move
        angleMultiplier = 2;
    }

    // Determine axis, layer index, and rotation direction based on face
    switch (face) {
        case 'F': axis = 'z'; layer = 1; direction *= 1; break;
        case 'B': axis = 'z'; layer = -1; direction *= -1; break;
        case 'U': axis = 'y'; layer = 1; direction *= 1; break;
        case 'D': axis = 'y'; layer = -1; direction *= -1; break;
        case 'R': axis = 'x'; layer = 1; direction *= 1; break;
        case 'L': axis = 'x'; layer = -1; direction *= -1; break;
        default:
            console.warn("Unknown move face:", face);
            if (!instant) startNextAnimation(); // Continue queue if animating
            return;
    }

    // Find cubies belonging to the layer to be rotated
    const cubiesToRotate = [];
    const layerPositionThreshold = (CUBIE_SIZE + GAP) * layer; // Position of the layer center
    const epsilon = 0.01; // Small tolerance for float comparison

    if (allCubies.length === 0) {
        console.error("Cannot apply move: allCubies array is empty!");
        if (!instant) startNextAnimation();
        return;
    }

    allCubies.forEach(cubie => {
        const position = new THREE.Vector3();
        cubie.getWorldPosition(position); // Use world position relative to scene origin

        let checkCoord;
        if (axis === 'x') checkCoord = position.x;
        else if (axis === 'y') checkCoord = position.y;
        else checkCoord = position.z;

        // Check if the cubie's coordinate along the axis matches the layer
        if (Math.abs(checkCoord - layerPositionThreshold) < epsilon) {
            cubiesToRotate.push(cubie);
        }
    });

    if (cubiesToRotate.length === 0) {
        // This shouldn't happen with a correct setup, but good to handle
        console.warn("No cubies found for move:", moveNotation);
        if (!instant) startNextAnimation();
        return;
    }

    // Prepare rotation
    const targetAngle = direction * ROTATION_ANGLE * angleMultiplier;
    const rotationAxisVec = new THREE.Vector3(
        axis === 'x' ? 1 : 0,
        axis === 'y' ? 1 : 0,
        axis === 'z' ? 1 : 0
    );

    // Reset pivot and attach cubies
    pivot.position.set(0, 0, 0);
    pivot.rotation.set(0, 0, 0);
    pivot.updateMatrixWorld(true);
    cubiesToRotate.forEach(cubie => pivot.attach(cubie)); // Attach cubies, preserving world transforms

    if (instant) {
        // Apply rotation instantly
        pivot.rotateOnWorldAxis(rotationAxisVec, targetAngle);
        pivot.updateMatrixWorld(true);

        // Detach cubies back to the scene
        const childrenToDetach = [...pivot.children];
        childrenToDetach.forEach(cubie => scene.attach(cubie));

        // If this was the last instant move (e.g., during scramble setup), render final state
        if (animationQueue.length === 0 && !isAnimating) {
             renderer.render(scene, camera);
        }

    } else {
        // Set up for animation
        currentAnimation = {
            targetAngle: targetAngle,
            currentAngle: 0,
            rotationAxis: rotationAxisVec,
            cubies: cubiesToRotate // Keep track (though maybe not needed if using pivot)
        };
        // Animation loop will handle the rotation
    }
}

function resetCubeState() {
    // Stop any ongoing animation immediately
    if (isAnimating) {
        if (currentAnimation) {
            // Detach cubies immediately if mid-animation
            const childrenToDetach = [...pivot.children];
            childrenToDetach.forEach(cubie => scene.attach(cubie));
            pivot.rotation.set(0,0,0);
        }
        currentAnimation = null;
        isAnimating = false;
        animationQueue = [];
        controls.enabled = true; // Ensure controls are re-enabled
        uiCallbacks.onAnimationEnd(); // Signal animation end to UI
    }


    if (initialCubieStates.length === 0) return; // Safety check

    // Reset each cubie to its initial state
    initialCubieStates.forEach((state) => {
        if (!state || !state.mesh) return; // Skip if state is invalid

        // Ensure cubie is attached directly to the scene
        if (state.mesh.parent !== scene) {
            scene.attach(state.mesh);
        }
        state.mesh.position.copy(state.position);
        state.mesh.quaternion.copy(state.quaternion);
        state.mesh.updateMatrixWorld(); // Update matrix after changes
    });

    // Reset logic state
    moveHistory = [];
    uiCallbacks.onHistoryUpdate(moveHistory.length); // Notify UI about history change

    // Reset interaction state
    clearFaceSelectionGraphics();
    uiCallbacks.clearFaceSelectionUI(); // Tell UI to clear its state too

    renderer.render(scene, camera); // Render the reset state
    console.log("Cube reset to initial state.");
}

function generateScramble(length = SCRAMBLE_LENGTH) {
    const faces = ['F', 'B', 'U', 'D', 'L', 'R'];
    const modifiers = ['', "'", '2']; // Standard modifiers
    const axisMap = { F: 'z', B: 'z', U: 'y', D: 'y', L: 'x', R: 'x' };
    let scramble = [];
    let lastAxis = null;

    for (let i = 0; i < length; i++) {
        let currentFace;
        let currentAxis;
        // Ensure the new move doesn't affect the same axis as the last move
        do {
            currentFace = faces[Math.floor(Math.random() * faces.length)];
            currentAxis = axisMap[currentFace];
        } while (currentAxis === lastAxis);

        const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
        const move = currentFace + modifier;
        scramble.push(move);
        lastAxis = currentAxis; // Remember the axis used
    }
    // console.log("Generated Scramble:", scramble.join(' '));
    return scramble;
}

function isSolved() {
    if (initialCubieStates.length !== allCubies.length || allCubies.length === 0) {
        return false; // Should not happen if initialized correctly
    }

    for (let i = 0; i < initialCubieStates.length; i++) {
        const initialState = initialCubieStates[i];
        const currentCubie = initialState.mesh;

        // 1. Check Position
        if (currentCubie.position.distanceTo(initialState.position) > SOLVED_POS_EPSILON) {
            // console.log(`Cubie ${i} position mismatch: ${currentCubie.position.distanceTo(initialState.position)}`);
            return false;
        }

        // 2. Check Orientation (Quaternion)
        // Normalize quaternions before comparing angles to avoid issues with non-unit quaternions
        const currentQuat = currentCubie.quaternion.clone().normalize();
        const initialQuat = initialState.quaternion.clone().normalize();

        // Calculate the angle between the two orientations
        if (currentQuat.angleTo(initialQuat) > SOLVED_QUAT_EPSILON) {
             // console.log(`Cubie ${i} orientation mismatch: ${currentQuat.angleTo(initialQuat)}`);
             return false;
        }
    }
    return true; // All cubies match their initial state
}

function checkSolveState() {
    // Only notify if the cube IS solved. UI module tracks if it was scrambled.
    if (isSolved()) {
        console.log("Cube Solved!");
        triggerConfetti();
        uiCallbacks.onSolve(); // Notify UI module
    }
}

function triggerConfetti() {
    // Ensure confetti function exists globally (loaded from CDN)
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 } // Start confetti slightly above center
        });
    } else {
        console.warn("Confetti function not found.");
    }
}

function getInverseMove(move) {
    if (!move) return null;
    if (move.includes('2')) return move; // Double move is its own inverse
    else if (move.includes("'")) return move.replace("'", ""); // Prime becomes normal
    else return move + "'"; // Normal becomes prime
}

// --- Event Handlers ---

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.render(scene, camera); // Re-render on resize
}

function onPointerDown(event) {
    // Only handle pointer events on the canvas itself
    if (event.target !== renderer.domElement) return;

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const intersectsLabels = raycaster.intersectObjects(faceLabels);

    pointerDownOnLabel = false;

    if (isAnimating) return; // Ignore clicks during animation

    if (intersectsLabels.length > 0) {
        const clickedLabelSprite = intersectsLabels[0].object;
        const faceId = clickedLabelSprite.userData.face;

        clearFaceSelectionGraphics(); // Clear visual highlight on labels
        // uiCallbacks.setSelectedFace(faceId); // Let UI module know which face is selected
        uiCallbacks.clearFaceSelectionUI(); // Clear previous UI state first
        // Let UI module handle the selection logic and visual update of *buttons*
        // This module only handles the *label* highlight

        clickedLabelSprite.material.color.set(SELECTED_LABEL_COLOR); // Highlight clicked label
        pointerDownOnLabel = true;
        controls.enabled = false; // Disable orbit controls when interacting with labels
        console.log("OrbitControls DISABLED on label select.");
        event.stopPropagation(); // Prevent OrbitControls from processing

        // Store start position for drag detection
        dragStartX = pointer.x;
        dragStartY = pointer.y;
        isDraggingForRotation = false; // Reset drag flag
        event.preventDefault(); // Prevent default browser actions
    } else {
        // Click was on canvas but not on a label
        clearFaceSelectionGraphics();
        uiCallbacks.clearFaceSelectionUI();
        controls.enabled = true; // Ensure orbit controls are enabled
    }
}

function onPointerMove(event) {
    // Only process if primary button is pressed and interaction started on a label
    if (event.buttons !== 1 || !pointerDownOnLabel || isAnimating) {
        isDraggingForRotation = false; // Reset drag if button released or not started on label
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Calculate distance moved
    const deltaX = pointer.x - dragStartX;
    const deltaY = pointer.y - dragStartY;
    const dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Only trigger drag rotation if moved beyond threshold
    if (!isDraggingForRotation && dragDistance > 0.01) { // Small initial threshold to confirm drag
        isDraggingForRotation = true;
    }

    if (isDraggingForRotation) {
        event.stopPropagation(); // Prevent OrbitControls while dragging on label
        event.preventDefault();

        // Determine move based on drag direction and distance
        if (dragDistance > dragThreshold) { // Larger threshold to trigger move
             let moveNotation = null;
             const selectedFace = uiCallbacks.getSelectedFace(); // Get selected face from UI module
             if (!selectedFace) { // Safety check
                pointerDownOnLabel = false;
                isDraggingForRotation = false;
                controls.enabled = true;
                return;
             }

            // Determine move based on dominant drag direction and selected face context
            // (This logic needs careful review based on camera orientation - simplified version)
            if (Math.abs(deltaX) > Math.abs(deltaY)) { // Horizontal drag dominant
                const direction = deltaX > 0 ? 1 : -1; // Right or Left drag
                 // Simplified mapping (assumes standard view) - This might need refinement
                 switch(selectedFace){
                      case 'F': moveNotation = direction > 0 ? "U" : "U'"; break; // Drag Right on F -> U, Drag Left -> U'
                      case 'B': moveNotation = direction > 0 ? "U'" : "U"; break; // Drag Right on B -> U', Drag Left -> U
                      case 'U': moveNotation = direction > 0 ? "B'" : "F"; break; // Horizontal drag on U affects F/B
                      case 'D': moveNotation = direction > 0 ? "F'" : "B"; break; // Horizontal drag on D affects F/B
                      case 'R': moveNotation = direction > 0 ? "U" : "U'"; break; // Drag Right on R -> U, Drag Left -> U'
                      case 'L': moveNotation = direction > 0 ? "U'" : "U"; break; // Drag Right on L -> U', Drag Left -> U
                 }
            } else { // Vertical drag dominant
                const direction = deltaY > 0 ? 1 : -1; // Up or Down drag
                 // Simplified mapping (assumes standard view)
                 switch(selectedFace){
                      case 'F': moveNotation = direction > 0 ? "L'" : "R"; break; // Drag Up on F -> L', Drag Down -> R
                      case 'B': moveNotation = direction > 0 ? "R'" : "L"; break; // Drag Up on B -> R', Drag Down -> L
                      case 'U': moveNotation = direction > 0 ? "L'" : "R"; break; // Drag Up on U -> L', Drag Down -> R
                      case 'D': moveNotation = direction > 0 ? "R'" : "L"; break; // Drag Up on D -> R', Drag Down -> L
                      case 'R': moveNotation = direction > 0 ? "F'" : "B"; break; // Drag Up on R -> F', Drag Down -> B
                      case 'L': moveNotation = direction > 0 ? "B'" : "F"; break; // Drag Up on L -> B', Drag Down -> F
                 }
            }

            if (moveNotation) {
                console.log("Triggering move from drag:", moveNotation);
                requestMove(moveNotation); // Queue the detected move

                // Reset interaction state after triggering move
                clearFaceSelectionGraphics();
                uiCallbacks.clearFaceSelectionUI();
                pointerDownOnLabel = false;
                isDraggingForRotation = false;
                controls.enabled = true; // Re-enable controls
            } else {
                 // No valid move detected from drag direction/face combo
                 // Optionally reset state here too if needed
            }
        }
    }
}


function onPointerUp(event) {
    // If interaction was a drag, it should have been handled by onPointerMove
    // If it was just a click (no significant move), we don't trigger a move here
    if (pointerDownOnLabel && !isDraggingForRotation) {
        // Potential place to handle simple clicks on labels if needed
        // Currently, clicks just select the face (handled in onPointerDown/UI)
    }

    // Always reset flags and potentially re-enable controls on pointer up
    if (!isAnimating) { // Don't enable controls if an animation started
       controls.enabled = true;
    }
    pointerDownOnLabel = false;
    isDraggingForRotation = false;
    // Don't clear selection here, let UI handle it or next click/action
}

// --- Public Interface ---

// Called by UI module to set up the cube
export function initializeCube(callbacks) {
    uiCallbacks = { ...uiCallbacks, ...callbacks }; // Merge provided callbacks
    initGraphics();
    resetCubeState(); // Set to initial solved state
}

// Called by UI module to request a move
export function requestMove(moveNotation, isUndo = false) {
    if (isAnimating && !isUndo) return; // Don't queue new moves if animating (allow undo)

    if (!isUndo) {
        moveHistory.push(moveNotation);
        uiCallbacks.onHistoryUpdate(moveHistory.length); // Notify UI
    }

    animationQueue.push(moveNotation);
    if (!isAnimating) {
        startNextAnimation(); // Start immediately if queue was empty
    }
}

// Called by UI module to request a scramble
export function requestScramble() {
    if (isAnimating) return []; // Don't scramble if animating

    resetCubeState(); // Reset visually and logically first
    const sequence = generateScramble();

    if (!sequence || sequence.length === 0) return [];

    // Apply scramble instantly (no animation)
    uiCallbacks.onAnimationStart(); // Briefly disable UI
    sequence.forEach(move => applyMove(move, true));
    uiCallbacks.onAnimationEnd(); // Re-enable UI

    renderer.render(scene, camera); // Ensure final state is drawn
    moveHistory = []; // Scramble clears history
    uiCallbacks.onHistoryUpdate(moveHistory.length);
    console.log("Cube scrambled instantly.");
    return sequence; // Return the sequence to the UI
}

// Called by UI module to request a reset
export function requestReset() {
    if (isAnimating) return;
    resetCubeState();
    // UI module should handle resetting timer etc.
}

// Called by UI module to request an undo
export function requestUndo() {
    console.log("cube.js: requestUndo called");
    if (isAnimating || moveHistory.length === 0) {
         console.log(`cube.js: requestUndo blocked (animating: ${isAnimating}, history: ${moveHistory.length})`);
        return; // Don't undo if animating or no history
    }

    const lastMove = moveHistory.pop();
    uiCallbacks.onHistoryUpdate(moveHistory.length); // Notify UI
    const inverseMove = getInverseMove(lastMove);

    if (inverseMove) {
        console.log("cube.js: Queueing inverse move:", inverseMove);
        requestMove(inverseMove, true); // Queue the inverse move as an undo
    } else {
        console.error("Could not determine inverse for:", lastMove);
    }
}

// Allow UI to check animation status
export function getIsAnimating() {
    return isAnimating;
}