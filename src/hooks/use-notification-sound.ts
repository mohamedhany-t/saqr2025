
"use client";

import React, { useEffect, useRef } from 'react';

/**
 * A custom hook to play a notification sound when the number of unread messages increases.
 * @param totalUnreadCount The total number of unread messages.
 */
export function useNotificationSound(totalUnreadCount: number) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevUnreadCountRef = useRef<number>(totalUnreadCount);

  // Initialize Audio object only on the client-side
  useEffect(() => {
    // Ensure this runs only in the browser
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/notification.mp3');
      audioRef.current.load(); // Preload the audio
    }
  }, []);

  useEffect(() => {
    // Check if the new count is greater than the previous count
    if (totalUnreadCount > prevUnreadCountRef.current) {
      const audio = audioRef.current;
      if (audio) {
        // Attempt to play the sound
        audio.play().catch(error => {
          // Log errors, e.g., browser autoplay restrictions
          console.log("Audio play failed:", error);
        });
      }
    }

    // Update the previous count for the next render
    prevUnreadCountRef.current = totalUnreadCount;
  }, [totalUnreadCount]); // This effect runs whenever totalUnreadCount changes
}
