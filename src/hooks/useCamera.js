import { useState, useEffect, useRef, useCallback } from 'react';

export const useCamera = () => {
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [error, setError] = useState(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
            });
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCameraOpen(false);
        setError(null);
    }, []);

    const startCamera = useCallback(async () => {
        stopCamera(); // Ensure clean state
        setError(null);

        const constraintsList = [
            { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } }, // HD
            { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } },  // VGA
            { video: true } // Any video
        ];

        for (const constraints of constraintsList) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);

                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    // Wait for video to be ready
                    await new Promise((resolve) => {
                        videoRef.current.onloadedmetadata = () => {
                            videoRef.current.play().then(resolve).catch(e => console.warn("Play interrupted", e));
                        };
                    });
                }

                setIsCameraOpen(true);
                return stream;
            } catch (err) {
                console.warn(`Camera attempt failed for constraints: ${JSON.stringify(constraints)}`, err);
                // Continue to next constraint if available
                if (constraints === constraintsList[constraintsList.length - 1]) {
                    // All attempts failed
                    console.error("All camera attempts failed.", err);
                    let msg = "Unable to access camera.";
                    if (err.name === 'NotAllowedError') msg = "Camera permission denied. Please allow access.";
                    if (err.name === 'NotFoundError') msg = "No camera device found.";
                    if (err.name === 'NotReadableError') msg = "Camera is currently in use by another application.";
                    setError(msg);
                    setIsCameraOpen(false);
                    throw err;
                }
            }
        }
    }, [stopCamera]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [stopCamera]);

    // Re-attach stream when camera opens (and video element mounts)
    useEffect(() => {
        if (isCameraOpen && videoRef.current && streamRef.current && !videoRef.current.srcObject) {
            videoRef.current.srcObject = streamRef.current;
            videoRef.current.play().catch(e => console.warn("Play error during re-attach", e));
        }
    }, [isCameraOpen]);

    return {
        videoRef,
        isCameraOpen,
        startCamera,
        stopCamera,
        error
    };
};
