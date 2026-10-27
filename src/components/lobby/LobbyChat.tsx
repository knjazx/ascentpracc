'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageSquare, ShieldAlert } from 'lucide-react';

export interface ChatMsg {
  id: string;
  matchId: string;
  userId?: string | null;
  teamId?: string | null;
  teamTag?: string;
  nickname?: string;
  avatarUrl?: string;
  system: boolean;
  text: string;
  createdAt: string;
}

interface LobbyChatProps {
  matchId: string;
  initialMessages: ChatMsg[];
  socket: Socket | null;
}

export function LobbyChat({ matchId, initialMessages, socket }: LobbyChatProps) {
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Listen to incoming real-time socket events
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: ChatMsg) => {
      setMessages((prev) => [...prev, msg]);
    };

    const handleUserJoined = (data: { nickname: string; teamTag: string }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `join-${Date.now()}`,
          matchId,
          system: true,
          text: `[${data.teamTag}] ${data.nickname} вошел в лобби матча`,
          createdAt: new Date().toISOString(),
        },
      ]);
    };

    socket.on('new_message', handleNewMessage);
    socket.on('user_joined', handleUserJoined);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_joined', handleUserJoined);
    };
  }, [socket, matchId]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !socket || sending) return;

    setSending(true);
    setError(null);

    socket.emit('send_message', { matchId, text: input.trim() }, (res: { success: boolean; error?: string }) => {
      setSending(false);
      if (!res.success) {
        setError(res.error || 'Ошибка отправки');
      } else {
        setInput('');
      }
    });
  };

  return (
    <div className="flex flex-col h-[480px] rounded-xl border border-border bg-card overflow-hidden shadow-xl shadow-black/40">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-border bg-cs-panel flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-white" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">Чат матча</span>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">Антиспам активен</span>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => {
          if (m.system) {
            return (
              <div key={m.id} className="text-center py-1">
                <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-neutral-200 border border-white/20 text-[11px] font-mono">
                  {m.text}
                </span>
              </div>
            );
          }

          const timeStr = new Date(m.createdAt).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div key={m.id} className="flex items-start gap-2.5 text-xs">
              <Avatar src={m.avatarUrl} alt={m.nickname || 'User'} size="sm" />
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="font-bold text-foreground">{m.nickname}</span>
                  {m.teamTag && (
                    <span className="text-[10px] text-neutral-400 font-bold">[{m.teamTag}]</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">{timeStr}</span>
                </div>
                <p className="text-muted-foreground text-xs break-words mt-0.5 leading-relaxed">
                  {m.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error alert if any */}
      {error && (
        <div className="px-4 py-1.5 bg-neutral-900 border-t border-neutral-700 text-neutral-200 text-[11px] flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-white" />
          <span>{error}</span>
        </div>
      )}

      {/* Message Input Box */}
      <form onSubmit={handleSend} className="p-3 border-t border-border bg-cs-panel flex gap-2">
        <Input
          type="text"
          placeholder="Написать сообщение (Enter для отправки)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          className="h-9 text-xs bg-card border-border"
        />
        <Button type="submit" variant="cs" size="sm" disabled={sending || !input.trim()} className="h-9 px-3 shrink-0">
          <Send className="w-3.5 h-3.5" />
        </Button>
      </form>
    </div>
  );
}
