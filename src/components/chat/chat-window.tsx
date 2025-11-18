
'use client';
import React, { useEffect, useRef, useState } from 'react';
import type { Conversation, Message, User as CurrentUser } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc, writeBatch, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Loader2, Paperclip, SendHorizonal, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { MessageBubble } from './message-bubble';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useToast } from '@/hooks/use-toast';
import { Progress } from '../ui/progress';

interface ChatWindowProps {
    conversation: Conversation;
    currentUser: CurrentUser;
}

export function ChatWindow({ conversation, currentUser }: ChatWindowProps) {
    const firestore = useFirestore();
    const storage = getStorage();
    const { toast } = useToast();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [text, setText] = useState('');
    const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
    
    const [file, setFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const otherParticipant = conversation.participantDetails[conversation.participantIds.find(id => id !== currentUser.uid)!];

    const messagesQuery = useMemoFirebase(() => {
        if (!firestore || !conversation) return null;
        return query(
            collection(firestore, `conversations/${conversation.id}/messages`),
            orderBy('createdAt', 'desc'),
            limit(50)
        );
    }, [firestore, conversation.id]);

    const { data: messages, isLoading } = useCollection<Message>(messagesQuery);
    
    const combinedMessages = React.useMemo(() => {
        const serverMessages = messages ? [...messages].reverse() : [];
        return [...serverMessages, ...optimisticMessages];
    }, [messages, optimisticMessages]);

    // Scroll to bottom effect
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, optimisticMessages]);

    // Mark messages as read effect
    useEffect(() => {
        if (firestore && conversation.unreadCounts[currentUser.uid] > 0) {
            const batch = writeBatch(firestore);
            const convRef = doc(firestore, 'conversations', conversation.id);
            batch.update(convRef, {
                [`unreadCounts.${currentUser.uid}`]: 0
            });
            batch.commit().catch(console.error);
        }
    }, [firestore, conversation.id, conversation.unreadCounts, currentUser.uid, messages]);

    const handleSendMessage = async (attachment?: { path: string, filename: string, mime: string, size: number }) => {
        if ((!text.trim() && !attachment) || !firestore) return;

        const batch = writeBatch(firestore);
        const convRef = doc(firestore, 'conversations', conversation.id);
        const msgRef = doc(collection(firestore, `conversations/${conversation.id}/messages`));
        const otherUserId = conversation.participantIds.find(id => id !== currentUser.uid)!;
        
        const newMessage: Omit<Message, 'id'> = {
            senderId: currentUser.uid,
            createdAt: serverTimestamp(),
            readBy: [currentUser.uid],
        };
        if(text.trim()) newMessage.text = text.trim();
        if(attachment) newMessage.attachments = [attachment];

        // Optimistic UI
        const optimisticId = msgRef.id + '_optimistic';
        const optimisticMessage: Message = {
            ...newMessage,
            id: optimisticId,
            isOptimistic: true,
            createdAt: new Date(), // Use local time for optimistic update
        };
        setOptimisticMessages(prev => [...prev, optimisticMessage]);


        batch.set(msgRef, newMessage);
        batch.update(convRef, {
            lastMessageText: text.trim() || attachment?.filename || 'Attachment',
            lastMessageAt: serverTimestamp(),
            lastMessageSenderId: currentUser.uid,
            [`unreadCounts.${otherUserId}`]: (conversation.unreadCounts[otherUserId] || 0) + 1
        });

        try {
            await batch.commit();
        } catch (error) {
            console.error("Error sending message:", error);
            toast({ title: "خطأ", description: "لم نتمكن من إرسال الرسالة.", variant: "destructive" });
        } finally {
            // Remove the optimistic message once the real one arrives via snapshot
            setOptimisticMessages(prev => prev.filter(m => m.id !== optimisticId));
        }

        setText('');
        setFile(null);
        setUploadProgress(null);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
                toast({ title: "حجم الملف كبير", description: "الحد الأقصى لحجم الملف هو 5 ميجابايت.", variant: "destructive" });
                return;
            }
            setFile(selectedFile);
        }
    };
    
    const handleUploadAndSend = () => {
        if (!file) return;

        const filePath = `attachments/${conversation.id}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                console.error("Upload failed:", error);
                toast({ title: "فشل الرفع", description: "حدث خطأ أثناء رفع الملف.", variant: "destructive" });
                setUploadProgress(null);
            },
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then(() => { // We don't need the URL on the client, just the path.
                    handleSendMessage({
                        path: filePath,
                        filename: file.name,
                        mime: file.type,
                        size: file.size,
                    });
                });
            }
        );
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if(file) {
                handleUploadAndSend();
            } else {
                handleSendMessage();
            }
        }
    };


    return (
        <div className="flex flex-col h-full bg-card">
            <header className="flex items-center gap-3 p-3 border-b">
                <Avatar>
                    <AvatarImage src={otherParticipant?.avatarUrl} />
                    <AvatarFallback>{otherParticipant?.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <h3 className="font-semibold">{otherParticipant?.name}</h3>
                    <p className="text-xs text-muted-foreground">{otherParticipant?.role === 'admin' ? 'مسؤول' : 'مندوب'}</p>
                </div>
            </header>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                ) : (
                    <>
                        {combinedMessages.map(msg => (
                            <MessageBubble key={msg.id} message={msg} isOwnMessage={msg.senderId === currentUser.uid} />
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>
            <footer className="p-4 border-t">
                 {file && (
                    <div className="mb-2 p-2 border rounded-md flex items-center justify-between bg-muted/50">
                        <div className="flex-1">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            {uploadProgress !== null && <Progress value={uploadProgress} className="h-1 mt-1" />}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                 )}
                <div className="relative">
                    <Textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="اكتب رسالتك هنا..."
                        className="pr-28 pl-12"
                        rows={1}
                        onKeyDown={handleKeyDown}
                    />
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
                         <Button
                            variant="ghost"
                            size="icon"
                            onClick={file ? handleUploadAndSend : handleSendMessage}
                            disabled={!text.trim() && !file}
                        >
                            <SendHorizonal className="h-5 w-5" />
                        </Button>
                    </div>
                     <div className="absolute right-2 top-1/2 -translate-y-1/2">
                         <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
                            <Paperclip className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </footer>
        </div>
    );
}

