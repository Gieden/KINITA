import React, { useRef, useEffect } from 'react';
import './IntroVideo.css';

const IntroVideo = ({ onVideoEnd }) => {
    const videoRef = useRef(null);

    useEffect(() => {
        // Attempt to play the video if autoplay is blocked by the browser
        if (videoRef.current) {
            videoRef.current.play().catch(error => {
                console.log("Autoplay was prevented:", error);
                // If autoplay fails (e.g., user hasn't interacted), we can show a play button or just skip.
                // For a seamless app experience, if it fails, we might just want to skip.
                // onVideoEnd(); 
            });
        }
    }, [onVideoEnd]);

    return (
        <div className="intro-video-container fade-in">
            <video
                ref={videoRef}
                className="intro-video"
                autoPlay
                muted       // Muted is often required for browsers to allow autoplay
                playsInline
                onEnded={onVideoEnd}
            >
                {/* 
                  The app expects the video to be placed at:
                  kinita/public/assets/intro.mp4 
                */}
                <source src="./kinita/public/assets/intro.mp4" type="video/mp4" />
                <source src="./assets/intro.mp4" type="video/mp4" /> {/* Fallback for local dev server */}
                Your browser does not support the video tag.
            </video>

            <button className="skip-button" onClick={onVideoEnd}>
                Skip Intro
            </button>
        </div>
    );
};

export default IntroVideo;
