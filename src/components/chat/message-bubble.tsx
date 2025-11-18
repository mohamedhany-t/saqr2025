
'use client';
import React from 'react';
import type { Message } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Clock, Download, File as FileIcon } from 'lucide-react';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';
import { Button } from '../ui/button';

interface MessageBubbleProps {
    message: Message;
    isOwnMessage: boolean;
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}


const AttachmentDisplay = ({ attachment }: { attachment: NonNullable<Message['attachments']>[0]}) => {
    const { toast } = useToast();
    const storage = getStorage();

    const handleDownload = async () => {
        try {
            const url = await getDownloadURL(ref(storage, attachment.path));
            // In a real app, you might want to open this in a new tab or use a library to trigger a download.
             const a = document.createElement('a');
             a.href = url;
             a.target = '_blank'; // Open in new tab
             a.download = attachment.filename;
             document.body.appendChild(a);
             a.click();
             document.body.removeChild(a);

        } catch (error) {
            console.error("Error getting download URL:", error);
            toast({ title: "خطأ", description: "لا يمكن تحميل المرفق.", variant: "destructive" });
        }
    };

    if (attachment.mime.startsWith('image/')) {
        return <img src="" alt={attachment.filename} className="rounded-lg max-w-xs mt-2 cursor-pointer" onClick={handleDownload} />;
    }

    return (
        <div className="mt-2 p-2 border rounded-lg flex items-center justify-between gap-2 bg-background/50">
            <div className="flex items-center gap-2 overflow-hidden">
                <FileIcon className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                <div className='overflow-hidden'>
                    <p className="text-sm font-medium truncate">{attachment.filename}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(attachment.size)}</p>
                </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleDownload}>
                <Download className="h-4 w-4" />
            </Button>
        </div>
    );
};


export function MessageBubble({ message, isOwnMessage }: MessageBubbleProps) {
    const isRead = message.readBy.length > 1;
    const time = message.createdAt?.toDate ? message.createdAt.toDate().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';

    const ReadStatus = () => {
        if (!isOwnMessage) return null;
        if(message.isOptimistic) return <Clock className="h-3 w-3 text-muted-foreground" />;
        return isRead ? <CheckCheck className="h-4 w-4 text-blue-500" /> : <Check className="h-4 w-4 text-muted-foreground" />;
    };

    return (
        <div className={cn("flex items-end gap-2", isOwnMessage ? "justify-end" : "justify-start")}>
            <div
                className={cn(
                    "max-w-md rounded-xl px-4 py-2",
                    isOwnMessage
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-muted text-foreground rounded-bl-none"
                )}
            >
                <p className="whitespace-pre-wrap">{message.text}</p>
                 {message.attachments?.map((att, index) => (
                    <AttachmentDisplay key={index} attachment={att} />
                 ))}
                <div className="flex items-center justify-end gap-2 mt-1 text-xs opacity-70">
                    <span>{time}</span>
                    <ReadStatus />
                </div>
            </div>
        </div>
    );
}

