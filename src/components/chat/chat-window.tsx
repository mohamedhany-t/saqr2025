
"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Paperclip, Send, X, File as FileIcon, Loader2 } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, query, orderBy, writeBatch, doc, getDoc, increment } from 'firebase/firestore';
import type { ChatMessage, User, Chat } from '@/lib/types';
import MessageBubble from './message-bubble';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '../ui/progress';
import { sendPushNotification } from '@/lib/actions';

interface ChatWindowProps {
  chatId: string;
  currentUser: User;
}

interface FileUpload {
    file: File;
    dataUrl: string; // Store the Base64 data URL
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chatId, currentUser }) => {
  const [newMessage, setNewMessage] = useState('');
  const [fileUpload, setFileUpload] = useState<FileUpload | null>(null);
  const [isSending, setIsSending] = useState(false);
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

  useEffect(() => {
    if (firestore && chatId && currentUser) {
      const chatDocRef = doc(firestore, 'chats', chatId);
      const unreadCountKey = `unreadCounts.${currentUser.id}`;
      
      const batch = writeBatch(firestore);
      batch.update(chatDocRef, { [unreadCountKey]: 0 });
      batch.commit().catch(console.error);
    }
  }, [firestore, chatId, currentUser, messages]);

  const handleSendMessage = async () => {
    if (!firestore || (!newMessage.trim() && !fileUpload)) return;
    setIsSending(true);

    const chatDocRef = doc(firestore, 'chats', chatId);
    const messagesCollection = collection(firestore, 'chats', chatId, 'messages');
    let filePayload: Partial<ChatMessage> = {};

    let lastMessageText = newMessage.trim();

    if (fileUpload && fileUpload.dataUrl) {
      if (fileUpload.file.type.startsWith('image/')) {
        filePayload.imageUrl = fileUpload.dataUrl;
        if (!lastMessageText) lastMessageText = "صورة";
      } else {
        // Storing non-image files as Base64 is highly inefficient and generally not recommended.
        // We will primarily support images for this workaround.
        toast({ title: "نوع الملف غير مدعوم", description: "هذا الحل البديل يدعم الصور فقط.", variant: "destructive"});
        setIsSending(false);
        return;
      }
    }
    
    const messagePayload: Omit<ChatMessage, 'id'> = {
        senderId: currentUser.id,
        timestamp: serverTimestamp(),
        ...filePayload,
        ...(newMessage.trim() && { text: newMessage.trim() }),
    };

    const chatSnap = await getDoc(chatDocRef);
    if (!chatSnap.exists()) {
        console.error("Chat does not exist!");
        setIsSending(false);
        return;
    }
    const chatData = chatSnap.data() as Chat;
    const otherParticipantId = chatData.participants.find(p => p !== currentUser.id);

    const batch = writeBatch(firestore);
    
    const newMessageRef = doc(messagesCollection);
    batch.set(newMessageRef, messagePayload);

    const chatUpdatePayload: any = {
        lastMessage: lastMessageText,
        lastMessageTimestamp: serverTimestamp(),
    };
    if (otherParticipantId) {
        chatUpdatePayload[`unreadCounts.${otherParticipantId}`] = increment(1);
    }
    batch.update(chatDocRef, chatUpdatePayload);

    await batch.commit();

    setNewMessage('');
    setFileUpload(null);
    setIsSending(false);
    
    if (otherParticipantId) {
      const notificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '/';
      await sendPushNotification({
        recipientId: otherParticipantId,
        title: currentUser.name || 'رسالة جديدة',
        body: lastMessageText,
        url: notificationUrl, 
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) { // 1MB limit for Base64
        toast({ title: "الملف كبير جدًا", description: "حجم الملف يجب أن يكون أقل من 1 ميجابايت.", variant: "destructive" });
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
            setFileUpload({ file, dataUrl });
        } else {
            toast({ title: "فشل قراءة الملف", variant: "destructive" });
        }
      };
      reader.onerror = () => {
        toast({ title: "خطأ في قراءة الملف", variant: "destructive" });
      };
      reader.readAsDataURL(file);
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
                    {fileUpload.file.type.startsWith('image/') ? (
                        <img src={fileUpload.dataUrl} alt="preview" className="h-10 w-10 object-cover rounded-md" />
                    ) : (
                        <FileIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="truncate flex-1">{fileUpload.file.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFileUpload(null)}>
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
              accept="image/*"
              disabled={isSending}
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
          <Button onClick={handleSendMessage} disabled={isSending || (!newMessage.trim() && !fileUpload)}>
            {isSending ? <Loader2 className="h-5 w-5 animate-spin"/> : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
