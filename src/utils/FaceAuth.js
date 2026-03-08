// reliable global script via CDN for FaceAPI
// import * as faceapi from 'face-api.js'; 

// MediaPipe is now loaded globally in index.html to avoid bundler issues with absolute paths
// import { FaceLandmarker, FilesetResolver } from "/mediapipe/vision_bundle.js";

const MODEL_URL = 'models';
let modelsLoaded = false;
let faceLandmarker = null;
// Forced Update 1

// Wait for faceapi global to be available
const waitForFaceApi = () => {
    return new Promise((resolve, reject) => {
        if (window.faceapi) return resolve(window.faceapi);
        let count = 0;
        const interval = setInterval(() => {
            if (window.faceapi) {
                clearInterval(interval);
                resolve(window.faceapi);
            }
            if (count++ > 50) { // 5 seconds timeout
                clearInterval(interval);
                reject("FaceAPI script failed to load.");
            }
        }, 100);
    });
};

// Helper to inject MediaPipe script at runtime (Bypasses Vite's import analysis)
const injectMediaPipe = () => {
    return new Promise((resolve, reject) => {
        if (window.FaceLandmarker && window.FilesetResolver) return resolve();

        console.log("Injecting MediaPipe script manually...");
        const script = document.createElement('script');
        script.type = 'module';
        // Use relative path for Electron compatibility
        script.innerHTML = `
            import { FaceLandmarker, FilesetResolver } from "./mediapipe/vision_bundle.js";
            window.FaceLandmarker = FaceLandmarker;
            window.FilesetResolver = FilesetResolver;
        `;
        document.body.appendChild(script);

        // Polling to wait for window globals to appear
        let count = 0;
        const interval = setInterval(() => {
            if (window.FaceLandmarker && window.FilesetResolver) {
                clearInterval(interval);
                console.log("MediaPipe Globals Detected");
                resolve();
            }
            if (count++ > 100) { // 10 seconds timeout
                clearInterval(interval);
                reject(new Error("MediaPipe failed to initialize via injection. Check console for network errors."));
            }
        }, 100);
    });
};

const checkAssets = async () => {
    const paths = [
        "./mediapipe/vision_bundle.js",
        "./mediapipe/vision_wasm_internal.js",
        "./models/tiny_face_detector_model-weights_manifest.json"
    ];

    for (const path of paths) {
        try {
            const res = await fetch(path, { method: 'HEAD' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (e) {
            throw new Error(`Asset not found: ${path} (${e.message})`);
        }
    }
    console.log("Assets verified.");
};

export const loadModels = async () => {
    if (modelsLoaded) return;

    try {
        await checkAssets();
        await waitForFaceApi();
        console.log("FaceAPI found.");

        // Load FaceAPI Models (for Recognition)
        const faceApiPromise = Promise.all([
            window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        // Load MediaPipe (Injection + Model Load)
        // We wrap this in a separate try/catch so it doesn't block FaceAPI if it fails
        const mediaPipePromise = (async () => {
            try {
                await injectMediaPipe();
                const vision = await window.FilesetResolver.forVisionTasks("./mediapipe/");
                faceLandmarker = await window.FaceLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "./mediapipe/face_landmarker.task",
                        delegate: "GPU"
                    },
                    outputFaceBlendshapes: true,
                    runningMode: "VIDEO",
                    numFaces: 1
                });
                console.log("MediaPipe FaceLandmarker Configured");
            } catch (mpErr) {
                console.warn("MediaPipe failed to load (will look for FaceAPI fallback)", mpErr);
            }
        })();

        // We await both, but since we caught MP error, this won't reject unless FaceAPI fails
        await Promise.all([faceApiPromise, mediaPipePromise]);

        modelsLoaded = true;
        console.log("Hybrid AI Models Fully Loaded (or partially)");
    } catch (error) {
        console.error("Failed to load models:", error);
        // ... (rest of error handling)
        let errorMsg = error.message || error.toString();
        // ...
        alert(`System Error: ${errorMsg} \n\nCheck console for details.`);
        throw new Error("Failed to load models: " + errorMsg);
    }
};

// Helper for drawing
export const drawFaceRect = (canvas, detection) => {
    if (!canvas || !detection) return;
    const ctx = canvas.getContext('2d');

    // Clear previous
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // If detection is from MediaPipe, it's a { box: {x,y,w,h}, score } object
    // If from FaceAPI, it's a detection object. 
    // We standardize to { box, score } in detectFace.

    const box = detection.box;
    const score = detection.score;

    // Custom style
    ctx.strokeStyle = '#a3e635'; // Lime green
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    // Draw score
    ctx.font = '16px monospace';
    ctx.fillStyle = '#a3e635';
    ctx.fillText(`${Math.round(score * 100)}%`, box.x, box.y - 5);
};

// Helper to check brightness (kept same)
export const checkBrightness = (videoElement) => {
    if (!videoElement) return 0;
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let r, g, b, avg;
    let colorSum = 0;
    for (let x = 0, len = data.length; x < len; x += 4) {
        r = data[x];
        g = data[x + 1];
        b = data[x + 2];
        avg = Math.floor((r + g + b) / 3);
        colorSum += avg;
    }
    const brightness = Math.floor(colorSum / (canvas.width * canvas.height));
    return brightness;
};

// HYBRID DETECTION: MediaPipe for Detection
export const detectFace = async (videoElement) => {
    if (!modelsLoaded) {
        console.warn("AI Models not loaded");
        return { source: "Models Not Loaded", features: null };
    }

    // Check dimensions
    if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
        return { source: "Video 0x0", features: null };
    }

    // Try MediaPipe First
    if (faceLandmarker) {
        try {
            const startTimeMs = performance.now();
            console.log("Detecting face...");
            const results = faceLandmarker.detectForVideo(videoElement, startTimeMs);
            console.log("Detection results:", results);

            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                // MediaPipe found a face. It's much better at this than face-api.
                // Convert Landmarks to Bounding Box
                const landmarks = results.faceLandmarks[0]; // 478 points

                // Calculate bounding box from landmarks
                let minX = 1, minY = 1, maxX = 0, maxY = 0;
                landmarks.forEach(pt => {
                    if (pt.x < minX) minX = pt.x;
                    if (pt.y < minY) minY = pt.y;
                    if (pt.x > maxX) maxX = pt.x;
                    if (pt.y > maxY) maxY = pt.y;
                });

                // Convert normalized to pixel coordinates
                const width = videoElement.videoWidth;
                const height = videoElement.videoHeight;

                const box = {
                    x: minX * width,
                    y: minY * height,
                    width: (maxX - minX) * width,
                    height: (maxY - minY) * height
                };

                // Add some padding (increased for better FaceAPI recognition on crops)
                const padding = box.width * 0.5;
                box.x = Math.max(0, box.x - padding);
                box.y = Math.max(0, box.y - padding);
                box.width = Math.min(width - box.x, box.width + (padding * 2));
                box.height = Math.min(height - box.y, box.height + (padding * 2));

                // Check visibility of key features (simple check: are they within frame?)
                // MediaPipe Landmarks: Nose(1), Left Eye(33), Right Eye(263)
                const isVisible = (idx) => {
                    const pt = landmarks[idx];
                    return pt.x >= 0 && pt.x <= 1 && pt.y >= 0 && pt.y <= 1;
                };

                const features = {
                    face: true,
                    leftEye: isVisible(33),
                    rightEye: isVisible(263),
                    nose: isVisible(1)
                };

                // Score & Blendshapes
                const score = results.faceBlendshapes && results.faceBlendshapes[0] ? 0.99 : 0.95;
                let blendshapes = null;

                if (results.faceBlendshapes && results.faceBlendshapes[0]) {
                    const categories = results.faceBlendshapes[0].categories;
                    const leftBlink = categories.find(c => c.categoryName === 'eyeBlinkLeft')?.score || 0;
                    const rightBlink = categories.find(c => c.categoryName === 'eyeBlinkRight')?.score || 0;
                    blendshapes = { leftBlink, rightBlink };
                }

                console.log("MediaPipe Detected", { features, blendshapes });
                return {
                    box: box,
                    score: score,
                    landmarks: landmarks,
                    source: 'mediapipe',
                    features: features,
                    blendshapes: blendshapes
                };
            }
        } catch (err) {
            console.error("MediaPipe Detect Error:", err);
            // Proceed to fallback
        }
    }

    // FALLBACK: FaceAPI
    // If MediaPipe finds nothing OR CRASHED/NOT LOADED, try FaceAPI (TinyFaceDetector)
    console.log("MediaPipe found nothing or unavailable. Trying FaceAPI...");
    try {
        const options = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 });
        const faceApiResult = await window.faceapi.detectSingleFace(videoElement, options);

        if (faceApiResult) {
            console.log("FaceAPI Detected");
            return {
                box: faceApiResult.box,
                score: faceApiResult.score,
                source: 'faceapi',
                features: {
                    face: true,
                    leftEye: true, // TinyFaceDetector doesn't give detailed landmark visibility easily, assume true if face found
                    rightEye: true,
                    nose: true
                }
            };
        }
    } catch (err) {
        console.error("FaceAPI Error:", err);
    }

    return { source: `NONE (${videoElement.videoWidth}x${videoElement.videoHeight})`, features: null };
};

export const getFaceDescriptor = async (videoElement) => {
    if (!modelsLoaded) await loadModels();

    // 1. Detect using MediaPipe (Robust)
    const detection = await detectFace(videoElement);

    if (!detection) {
        throw new Error("No face detected. Please ensure your face is clearly visible.");
    }

    // 2. Crop the face region
    const canvas = document.createElement('canvas');
    canvas.width = detection.box.width;
    canvas.height = detection.box.height;
    const ctx = canvas.getContext('2d');

    // Draw only the face region to the canvas (Cropping)
    ctx.drawImage(
        videoElement,
        detection.box.x, detection.box.y, detection.box.width, detection.box.height,
        0, 0, canvas.width, canvas.height
    );

    // 3. Pass CROP to FaceAPI for Recognition
    // Since it's a crop, we treat it as a "Single Face" input.
    // We use a very permissive detector option because we KNOW it's a face.
    const options = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.1 });

    const faceApiResult = await window.faceapi.detectSingleFace(canvas, options)
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (!faceApiResult) {
        throw new Error("Face detected but could not be processed. Please look directly at the camera.");
    }

    // Check size relative to frame (using original video width)
    const vidWidth = videoElement.videoWidth;
    if (detection.box.width < (vidWidth * 0.15)) {
        throw new Error("Please move closer to the camera.");
    }

    return faceApiResult.descriptor;
};

export const getAverageFaceDescriptor = async (videoElement, sampleCount = 20, onProgress) => {
    if (!modelsLoaded) await loadModels();

    const descriptors = [];

    for (let i = 0; i < sampleCount; i++) {
        if (onProgress) onProgress((i / sampleCount) * 100);

        // Add a small delay between samples to get slight variations
        await new Promise(resolve => setTimeout(resolve, 200));

        try {
            const descriptor = await getFaceDescriptor(videoElement);
            descriptors.push(descriptor);
        } catch (err) {
            console.warn(`Sample ${i + 1} failed:`, err);
            // Don't fail the whole process if one sample fails, just continue
            // unless we have too few samples at the end
        }
    }

    if (descriptors.length === 0) {
        throw new Error("Failed to capture any valid face samples.");
    }

    if (onProgress) onProgress(100);

    // Compute Average Descriptor
    const numSamples = descriptors.length;
    const vectorSize = descriptors[0].length;
    const avgDescriptor = new Float32Array(vectorSize);

    for (let i = 0; i < vectorSize; i++) {
        let sum = 0;
        for (let j = 0; j < numSamples; j++) {
            sum += descriptors[j][i];
        }
        avgDescriptor[i] = sum / numSamples;
    }

    return avgDescriptor;
};

export const createMatcher = (descriptorArray) => {
    return new window.faceapi.FaceMatcher(descriptorArray);
};

export const checkForDuplicateFace = (newDescriptor, existingUsers) => {
    if (!existingUsers || existingUsers.length === 0) return null;

    const matcher = new window.faceapi.FaceMatcher(newDescriptor);
    let bestMatch = { distance: 1.0, user: null };

    for (const user of existingUsers) {
        if (!user.face_descriptor) continue;

        try {
            // Convert stored descriptor (array/object) to Float32Array
            const storedDescriptor = new Float32Array(Object.values(user.face_descriptor));
            const match = matcher.findBestMatch(storedDescriptor);

            if (match.distance < bestMatch.distance) {
                bestMatch = { distance: match.distance, user: user };
            }
        } catch (e) {
            console.warn("Skipping invalid descriptor for user", user.name);
        }
    }

    // Threshold for "Same Person" - usually 0.4-0.5 is good for verify
    if (bestMatch.distance < 0.45) {
        return bestMatch.user;
    }
    return null;
};


