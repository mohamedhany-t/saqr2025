"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Paperclip, Send, X, File as FileIcon, Loader2 } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, query, orderBy, writeBatch, doc, getDoc, increment } from 'firebase/firestore';
import type { ChatMessage, User, Chat } from '@/lib/types';
import MessageBubble from './message-bubble';
import { uploadFile } from '@/firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '../ui/progress';

interface ChatWindowProps {
  chatId: string;
  currentUser: User;
}

interface FileUpload {
    file: File;
    progress: number;
    error?: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chatId, currentUser }) => {
  const [newMessage, setNewMessage] = useState('');
  const [fileUpload, setFileUpload] = useState<FileUpload | null>(null);
  const firestore = useFirestore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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

  // Effect to mark messages as read when the chat window is open
  useEffect(() => {
    if (firestore && chatId && currentUser) {
      const chatDocRef = doc(firestore, 'chats', chatId);
      const unreadCountKey = `unreadCounts.${currentUser.id}`;
      
      const batch = writeBatch(firestore);
      batch.update(chatDocRef, { [unreadCountKey]: 0 });
      batch.commit().catch(console.error);
    }
  }, [firestore, chatId, currentUser, messages]); // Rerun when messages update to catch incoming ones

  const handleSendMessage = async () => {
    if (!firestore || (!newMessage.trim() && !fileUpload)) return;

    const chatDocRef = doc(firestore, 'chats', chatId);
    const messagesCollection = collection(firestore, 'chats', chatId, 'messages');
    let filePayload: Partial<ChatMessage> = {};

    let lastMessageText = newMessage.trim();

    // Handle File Upload First
    if (fileUpload && fileUpload.file) {
        try {
            const filePath = `chat_attachments/${chatId}/${Date.now()}_${fileUpload.file.name}`;
            const downloadURL = await uploadFile(filePath, fileUpload.file, (progress) => {
                setFileUpload(prev => prev ? { ...prev, progress } : null);
            });
            
            if (fileUpload.file.type.startsWith('image/')) {
                filePayload.imageUrl = downloadURL;
                if (!lastMessageText) lastMessageText = "صورة";
            } else {
                filePayload.fileUrl = downloadURL;
                filePayload.fileName = fileUpload.file.name;
                if (!lastMessageText) lastMessageText = fileUpload.file.name;
            }
            setFileUpload(null);
        } catch (error) {
            console.error("File upload failed:", error);
            toast({ title: "فشل رفع الملف", description: "حدث خطأ أثناء رفع الملف. يرجى المحاولة مرة أخرى.", variant: "destructive"});
            setFileUpload(prev => prev ? { ...prev, error: "Upload failed" } : null);
            return;
        }
    }
    
    // Prepare message payload
    const messagePayload: Omit<ChatMessage, 'id'> = {
        senderId: currentUser.id,
        timestamp: serverTimestamp(),
        ...filePayload,
        ...(newMessage.trim() && { text: newMessage.trim() }),
    };

    // Get the other participant's ID to increment their unread count
    const chatSnap = await getDoc(chatDocRef);
    if (!chatSnap.exists()) {
        console.error("Chat does not exist!");
        return;
    }
    const chatData = chatSnap.data() as Chat;
    const otherParticipantId = chatData.participants.find(p => p !== currentUser.id);

    // Create a batch to update everything atomically
    const batch = writeBatch(firestore);
    
    // 1. Add the new message
    const newMessageRef = doc(messagesCollection);
    batch.set(newMessageRef, messagePayload);

    // 2. Update the chat document with last message and increment unread count
    const chatUpdatePayload: any = {
        lastMessage: lastMessageText,
        lastMessageTimestamp: serverTimestamp(),
    };
    if (otherParticipantId) {
        chatUpdatePayload[`unreadCounts.${otherParticipantId}`] = increment(1);
    }
    batch.update(chatDocRef, chatUpdatePayload);

    // Commit the batch
    await batch.commit();

    // Reset input fields
    setNewMessage('');
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading && <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}
        {messages?.map(msg => (
          <MessageBubble key={msg.id} message={msg} isOwnMessage={msg.senderId === currentUser.id} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t bg-muted/50">
        {fileUpload && (
             <div className="mb-2 p-2 border rounded-lg bg-background relative">
                <div className="flex items-center gap-2 text-sm">
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                    <span className="truncate flex-1">{fileUpload.file.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFileUpload(null)}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                {fileUpload.error ? (
                    <p className="text-destructive text-xs mt-1">{fileUpload.error}</p>
                ) : (
                    <Progress value={fileUpload.progress} className="h-1 mt-1" />
                )}
            </div>
        )}
        <div className="flex items-center gap-2">
           <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">إرفاق ملف</span>
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileSelect}
            />
          <Input
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
            placeholder="اكتب رسالتك هنا..."
            className="flex-1"
            dir="rtl"
          />
          <Button onClick={handleSendMessage} disabled={(!newMessage.trim() && !fileUpload) || (!!fileUpload && fileUpload.progress < 100)}>
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
