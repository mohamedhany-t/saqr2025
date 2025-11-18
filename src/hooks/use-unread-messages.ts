"use client";

import { useEffect, useState, useRef } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Chat } from '@/lib/types';

export const useUnreadMessages = (userId: string | undefined) => {
  const firestore = useFirestore();
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const previousTotalCount = useRef(0);

  // Memoize the query
  const chatsQuery = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return query(
      collection(firestore, 'chats'),
      where('participants', 'array-contains', userId)
    );
  }, [firestore, userId]);

  // Use the useCollection hook to get real-time chat data
  const { data: chats } = useCollection<Chat>(chatsQuery);


  // Effect to calculate unread count and play sound
  useEffect(() => {
    if (chats && userId) {
      const newTotal = chats.reduce((sum, chat) => {
        return sum + (chat.unreadCounts?.[userId] || 0);
      }, 0);

      setTotalUnreadCount(newTotal);

      // Sound playing is disabled for now to fix the build error.
      // We can re-enable this later.
      // if (newTotal > previousTotalCount.current) {
      //   audioRef.current?.play().catch(error => {
      //     console.warn("Audio notification was blocked by the browser:", error);
      //   });
      // }

      // Update the ref for the next comparison
      previousTotalCount.current = newTotal;
    }
  }, [chats, userId]);

  return { totalUnreadCount };
};
