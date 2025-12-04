
"use client";
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Paperclip, Send, X, File as FileIcon, Loader2 } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUploader, useFirebaseApp } from '@/firebase';
import { collection, serverTimestamp, query, orderBy, writeBatch, doc, getDoc, increment } from 'firebase/firestore';
import type { ChatMessage, User, Chat } from '@/lib/types';
import MessageBubble from './message-bubble';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '../ui/progress';
import { sendPushNotification } from '@/lib/actions';
import { getStorage } from 'firebase/storage';

interface ChatWindowProps {
  chatId: string;
  currentUser: User;
}

interface FileUpload {
    file: File;
    progress: number;
    error?: string;
}

const ChatWindowContent: React.FC<ChatWindowProps> = ({ chatId, currentUser }) => {
  const [newMessage, setNewMessage] = useState('');
  const [fileUpload, setFileUpload] = useState<FileUpload | null>(null);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { uploadFile } = useUploader();
  const firestore = useFirestore();

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !chatId) return null;
    return query(collection(firestore, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
  }, [firestore, chatId]);

  const { data: messages, isLoading } = useCollection<ChatMessage>(messagesQuery);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (firestore && chatId && currentUser?.id && messages) {
      const chatDocRef = doc(firestore, 'chats', chatId);
      const unreadCountKey = `unreadCounts.${currentUser.id}`;
      
      const batch = writeBatch(firestore);
      batch.update(chatDocRef, { [unreadCountKey]: 0 });
      batch.commit().catch(console.error);
    }
  }, [firestore, chatId, currentUser?.id, messages]);

  const handleSendMessage = async () => {
    if (!firestore || (!newMessage.trim() && !fileUpload?.file)) return;
    setIsSending(true);

    try {
        const chatDocRef = doc(firestore, 'chats', chatId);
        const messagesCollection = collection(firestore, 'chats', chatId, 'messages');
        const filePayload: Partial<ChatMessage> = {};

        let lastMessageText = newMessage.trim();

        // 1. Handle File Upload if it exists
        if (fileUpload && fileUpload.file) {
            const file = fileUpload.file;
            const filePath = `chat-uploads/${chatId}/${Date.now()}_${file.name}`;
            
            const downloadURL = await uploadFile(filePath, file, (progress) => {
                setFileUpload(prev => prev ? { ...prev, progress } : null);
            });

            if (file.type.startsWith('image/')) {
                filePayload.imageUrl = downloadURL;
                if (!lastMessageText) lastMessageText = "صورة";
            } else {
                filePayload.fileUrl = downloadURL;
                filePayload.fileName = file.name;
                 if (!lastMessageText) lastMessageText = "ملف";
            }
        }
        
        // 2. Prepare message and chat update payloads
        const messagePayload: Omit<ChatMessage, 'id'> = {
            senderId: currentUser.id,
            timestamp: serverTimestamp(),
            ...filePayload,
            ...(newMessage.trim() && { text: newMessage.trim() }),
        };

        const chatSnap = await getDoc(chatDocRef);
        if (!chatSnap.exists()) {
            throw new Error("Chat does not exist!");
        }
        const chatData = chatSnap.data() as Chat;
        const otherParticipantId = chatData.participants.find(p => p !== currentUser.id);

        const chatUpdatePayload: any = {
            lastMessage: lastMessageText,
            lastMessageTimestamp: serverTimestamp(),
        };
        if (otherParticipantId) {
            chatUpdatePayload[`unreadCounts.${otherParticipantId}`] = increment(1);
        }

        // 3. Commit to Firestore
        const batch = writeBatch(firestore);
        const newMessageRef = doc(messagesCollection);
        batch.set(newMessageRef, messagePayload);
        batch.update(chatDocRef, chatUpdatePayload);
        await batch.commit();

        // 4. Send Push Notification
        if (otherParticipantId) {
            const notificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '/';
            await sendPushNotification({
                recipientId: otherParticipantId,
                title: currentUser.name || 'رسالة جديدة',
                body: lastMessageText,
                url: notificationUrl,
            });
        }
        
        // 5. Clean up state
        setNewMessage('');
        setFileUpload(null);

    } catch (error) {
        console.error("Error sending message:", error);
        toast({
            title: "فشل إرسال الرسالة",
            description: "حدث خطأ أثناء محاولة إرسال الرسالة. يرجى المحاولة مرة أخرى.",
            variant: "destructive"
        });
        setFileUpload(prev => prev ? { ...prev, error: "فشل الرفع" } : null);
    } finally {
        // ALWAYS reset the sending state, regardless of success or failure
        setIsSending(false);
    }
  };


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "الملف كبير جدًا", description: "حجم الملف يجب أن يكون أقل من 5 ميجابايت.", variant: "destructive" });
        return;
      }
      setFileUpload({ file, progress: 0 });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages?.map(msg => (
          <MessageBubble key={msg.id} message={msg} isOwnMessage={msg.senderId === currentUser.id} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t bg-muted/50">
        {fileUpload && (
             <div className="mb-2 p-2 border rounded-lg bg-background relative">
                <div className="flex items-center gap-2 text-sm">
                    <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 overflow-hidden">
                        <p className="truncate">{fileUpload.file.name}</p>
                         <Progress value={fileUpload.progress} className="h-1 mt-1" />
                        {fileUpload.error && <p className="text-xs text-destructive">{fileUpload.error}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFileUpload(null)} disabled={isSending}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        )}
        <div className="flex items-center gap-2">
           <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isSending}>
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">إرفاق ملف</span>
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileSelect}
              accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={isSending || !!fileUpload}
            />
          <Input
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && !isSending && handleSendMessage()}
            placeholder="اكتب رسالتك هنا..."
            className="flex-1"
            dir="rtl"
            disabled={isSending}
          />
          <Button onClick={handleSendMessage} disabled={isSending || (!newMessage.trim() && !fileUpload?.file)}>
            {isSending ? <Loader2 className="h-5 w-5 animate-spin"/> : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
};


const ChatWindow: React.FC<ChatWindowProps> = ({ chatId, currentUser }) => {
    const firestore = useFirestore();

    // The parent component now only worries about making sure firestore is ready.
    // This ensures all firebase services are initialized before the content, including storage, is used.
    if (!firestore) {
      return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return <ChatWindowContent chatId={chatId} currentUser={currentUser} />
}

export default ChatWindow;
