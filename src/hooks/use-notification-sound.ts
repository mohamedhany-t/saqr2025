
"use client";

import React, { useEffect, useRef, useCallback } from 'react';

/**
 * A custom hook to play a notification sound when a condition is met (e.g., new message).
 * This version is designed to be more compatible with browser autoplay policies.
 * @param trigger A value that, when it changes, should trigger the sound.
 */
export function useNotificationSound(trigger: any) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevTriggerRef = useRef(trigger);
  
  const playSound = useCallback(() => {
    if (audioRef.current) {
      // Reset time to play again if it was already playing
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(error => {
        // This error often happens if the user hasn't interacted with the page yet.
        console.log("Audio play failed, likely due to browser policy. User interaction is required first.", error);
      });
    }
  }, []);

  // Initialize Audio object only on the client-side
  useEffect(() => {
    if (typeof window !== 'undefined' && !audioRef.current) {
        audioRef.current = new Audio('/notification.mp3');
        audioRef.current.load();
    }

    // A one-time event listener to enable audio on first user interaction
    const enableAudio = () => {
        if(audioRef.current?.paused) {
            audioRef.current.play().then(() => audioRef.current?.pause()).catch(() => {});
        }
        window.removeEventListener('click', enableAudio);
        window.removeEventListener('keydown', enableAudio);
    };

    window.addEventListener('click', enableAudio, { once: true });
    window.addEventListener('keydown', enableAudio, { once: true });

    return () => {
        window.removeEventListener('click', enableAudio);
        window.removeEventListener('keydown', enableAudio);
    };
  }, []);

  useEffect(() => {
    // We only want to play the sound if the trigger value has increased (e.g., more unread messages)
    // and is not the initial render.
    if (typeof trigger === 'number' && typeof prevTriggerRef.current === 'number') {
        if (trigger > prevTriggerRef.current) {
            playSound();
        }
    }
    
    // Update the ref to the current trigger value for the next comparison
    prevTriggerRef.current = trigger;
  }, [trigger, playSound]);

}
