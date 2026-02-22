
"use client";
import React from 'react';
import { cn, formatToCairoTime } from '@/lib/utils';
import type { ChatMessage } from '@/lib/types';
import { Image, File, Download } from 'lucide-react';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwnMessage: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwnMessage }) => {
  const bubbleClasses = cn(
    'p-3 rounded-xl max-w-sm md:max-w-md lg:max-w-lg',
    isOwnMessage ? 'bg-primary text-primary-foreground self-end rounded-br-none' : 'bg-muted text-foreground self-start rounded-bl-none'
  );
  
  const time = formatToCairoTime(message.timestamp);

  return (
    <div className={cn("flex flex-col", isOwnMessage ? "items-end" : "items-start")}>
        <div className={bubbleClasses}>
            {message.text && <p className="text-sm break-words">{message.text}</p>}
            
            {message.imageUrl && (
                 <a href={message.imageUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                    <img src={message.imageUrl} alt="Uploaded content" className="rounded-lg max-w-full h-auto max-h-64" />
                 </a>
            )}

            {message.fileUrl && (
                <a 
                    href={message.fileUrl} 
                    download={message.fileName} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-background/20 hover:bg-background/40 transition-colors"
                >
                    <File className="h-6 w-6 flex-shrink-0" />
                    <span className="text-sm truncate flex-1">{message.fileName}</span>
                    <Download className="h-4 w-4" />
                </a>
            )}
        </div>
        <span className="text-xs text-muted-foreground mt-1 px-1">{time}</span>
    </div>
  );
};

export default MessageBubble;
