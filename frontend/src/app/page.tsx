"use client";
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import { useSession, signOut } from "next-auth/react";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSocket } from '@/app/context/SocketProvider';

// Tipe data yang lebih kaya untuk riwayat gabungan
interface UnifiedHistoryItem {
  _id: string;
  title: string;
  type: 'ai' | 'live';
}

// Tipe data universal untuk semua jenis pesan
interface Message {
  role?: 'user' | 'model';
  senderId?: string;
  parts?: string;
  message?: string;
  timestamp?: string;
}

// Komponen untuk menampilkan satu gelembung chat
function ChatMessage({ msg, currentUserId }: { msg: Message, currentUserId?: string }) {
  const isMyMessage = msg.role === 'user' || msg.senderId === currentUserId;

  return (
    <div className={`flex items-start gap-3 my-2 ${isMyMessage ? 'justify-end' : ''}`}>
      {!isMyMessage && (
        <div className="w-8 h-8 rounded-full flex-shrink-0">
          <Image src="/logo.png" alt="CheckYuk! Logo" width={32} height={32} />
        </div>
      )}
      <div className={`p-3 rounded-lg max-w-xl prose prose-sm ${isMyMessage ? 'bg-blue-500 text-white' : 'bg-gray-100 text-black'}`}>
        <ReactMarkdown>{msg.parts || msg.message || ''}</ReactMarkdown>
      </div>
      {isMyMessage && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white bg-gray-700 flex-shrink-0">
          Y
        </div>
      )}
    </div>
  );
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function Home() {
  const { data: session, status } = useSession();
  const { socket } = useSocket();
  const router = useRouter();

  const [activeChat, setActiveChat] = useState<UnifiedHistoryItem | null>(null);
  const [history, setHistory] = useState<UnifiedHistoryItem[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const fetchAllHistory = async () => {
      if (session?.user?.id) {
        try {
          const response = await axios.get(`${API_URL}/api/history/all/${session.user.id}`);
          setHistory(response.data);
        } catch (error) {
          console.error("Gagal mengambil semua riwayat:", error);
        }
      } else {
        setHistory([]);
      }
    };
    if (status === 'authenticated') {
      fetchAllHistory();
    }
  }, [session, status]);

  useEffect(() => {
    if (!socket) return;

    const onReceiveMessage = (data: Message) => {
      if (activeChat && activeChat.type === 'live' && activeChat._id === (data as any).sessionId) {
        setMessages(prev => [...prev, data]);
      }
    };

    const onChatSessionStarted = (data: { sessionId: string }) => {
      alert(`Anda terhubung dengan dokter! Silakan mulai percakapan.`);
      const newLiveChat = { _id: data.sessionId, title: `Konsultasi Live Baru`, type: 'live' as const };
      setHistory(prev => [newLiveChat, ...prev]);
      setActiveChat(newLiveChat);
      setMessages([]);
    };

    socket.on('chat_session_started', onChatSessionStarted);
    socket.on('receive_message', onReceiveMessage);

    return () => {
      socket.off('chat_session_started', onChatSessionStarted);
      socket.off('receive_message', onReceiveMessage);
    };
  }, [socket, activeChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleNewChat = () => {
    const newAiChatSession = {
      _id: `ai-session-${Date.now()}`,
      title: 'Percakapan AI Baru',
      type: 'ai' as const,
    };
    setActiveChat(newAiChatSession);
    setMessages([]);
    setPrompt('');
  };

  const handleRequestDoctorChat = () => {
    if (socket && session?.user?.id) {
      socket.emit('user_requests_chat', { userId: session.user.id });
      alert('Mencari profesional yang tersedia...');
    } else {
      router.push('/login');
    }
  };

  const loadConversation = async (chatItem: UnifiedHistoryItem) => {
    if (!session && chatItem.type === 'ai') {
        // Izinkan tamu untuk membuka chat AI baru (tapi tidak chat lama)
        if(!chatItem._id.startsWith('ai-session-')) {
            router.push('/login');
            return;
        }
    }

    setActiveChat(chatItem);
    setIsLoading(true);
    setMessages([]);

    try {
      if (chatItem.type === 'ai' && !chatItem._id.startsWith('ai-session-')) {
        const response = await axios.get(`${API_URL}/api/conversation/${chatItem._id}`);
        const formattedMessages = response.data.history.map((msg: any) => ({
          ...msg,
          message: msg.parts,
        }));
        setMessages(formattedMessages);
      } else if (chatItem.type === 'live') {
        // Logika memuat riwayat chat live dari DB bisa ditambahkan di sini
      }
    } catch (error) {
      console.error("Gagal memuat percakapan:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, type: 'ai' | 'live') => {
    if (!session) return;
    if (window.confirm("Apakah Anda yakin ingin menghapus percakapan ini?")) {
      try {
        if (type === 'ai' && !id.startsWith('ai-session-')) {
          await axios.delete(`${API_URL}/api/conversation/${id}`);
        }
        setHistory(prevHistory => prevHistory.filter(item => item._id !== id));
        if (activeChat?._id === id) {
          setActiveChat(null);
          setMessages([]);
        }
      } catch (error) {
        console.error("Gagal menghapus percakapan:", error);
        alert("Gagal menghapus percakapan. Coba lagi.");
      }
    }
  };

  const handleSendMessage = async () => {
    if (!prompt.trim() || isLoading || !activeChat) {
      if (!activeChat) alert("Silakan pilih atau mulai percakapan baru.");
      return;
    }

    const currentPrompt = prompt;
    const userMessage: Message = {
      role: 'user',
      senderId: session?.user?.id,
      parts: currentPrompt,
      message: currentPrompt,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setPrompt('');
    setIsLoading(true);

    try {
      if (activeChat.type === 'ai') {
        const payload = {
          prompt: currentPrompt,
          conversationId: activeChat._id.startsWith('ai-session-') ? null : activeChat._id,
          userId: session?.user?.id,
        };
        const response = await axios.post(`${API_URL}/api/chat`, payload);
        const modelMessage: Message = {
          role: 'model',
          parts: response.data.modelResponse,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, modelMessage]);

        if (payload.conversationId === null) {
          const newChatId = response.data.conversationId;
          const newTitle = response.data.title;
          setHistory(prev => prev.map(h => h._id === activeChat._id ? { ...h, _id: newChatId, title: newTitle } : h));
          setActiveChat(prev => prev ? { ...prev, _id: newChatId, title: newTitle } : null);
        }

      } else if (activeChat.type === 'live') {
        socket?.emit('private_message', {
          sessionId: activeChat._id,
          senderId: session?.user?.id,
          message: currentPrompt,
        });
      }
    } catch (error) {
      console.error("Gagal mengirim pesan:", error);
      const errorMessage: Message = {
        role: 'model',
        parts: "Maaf, terjadi kesalahan.",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (status === "loading") {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="flex h-screen bg-white text-black font-sans">
      <aside className="w-72 bg-gray-50 p-3 flex flex-col border-r border-gray-200">
        <div className="flex gap-2 mb-4">
          <button onClick={handleNewChat} className="flex-1 border border-gray-300 hover:bg-gray-200 text-black font-medium py-2 px-3 rounded-lg text-left flex items-center gap-2 text-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path><path d="M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
            Chat AI
          </button>
          <button onClick={handleRequestDoctorChat} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-3 rounded-lg text-left flex items-center gap-2 text-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><circle cx="12" cy="10" r="2"></circle><line x1="8" x2="8" y1="2" y2="4"></line><line x1="16" x2="16" y1="2" y2="4"></line></svg>
            Konsultasi Live
          </button>
        </div>

        <div className="flex-grow overflow-y-auto pr-2">
          {session && history.length > 0 && (
            <>
              <h2 className="text-xs font-semibold text-gray-500 mb-2 px-2 uppercase">Riwayat</h2>
              <ul>
                {history.map((item) => (
                  <li
                    key={item._id}
                    className={`group flex items-center justify-between p-2 my-1 rounded-md cursor-pointer text-sm ${activeChat?._id === item._id ? 'bg-gray-200' : 'hover:bg-gray-100'}`}
                    onClick={() => loadConversation(item)}
                  >
                    <span className="truncate font-medium">{item.title}</span>
                    <button
                      onClick={(event) => { event.stopPropagation(); handleDelete(item._id, item.type); }}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-500 transition-opacity flex-shrink-0 ml-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        
        <div className="border-t border-gray-200 p-2 mt-2">
          {session ? (
            <div className="flex items-center justify-between">
              <span className="text-sm truncate font-medium">{session.user?.email}</span>
              <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm font-semibold text-red-500 hover:underline">Logout</button>
            </div>
          ) : (
            <div className="space-y-2">
              <Link href="/login" className="block w-full text-center bg-black text-white p-2 rounded-lg text-sm font-semibold">Login</Link>
              <Link href="/register" className="block w-full text-center bg-gray-200 text-black p-2 rounded-lg text-sm font-semibold">Register</Link>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-white">
        <div className="flex-1 p-6 overflow-y-auto">
          {!activeChat ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-16 h-16 mb-4">
                <Image src="/logo.png" alt="CheckYuk! Logo" width={64} height={64} />
              </div>
              <h1 className="text-2xl font-semibold text-gray-400">Pilih atau mulai percakapan</h1>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full">
              {messages.map((msg, index) => (
                <ChatMessage key={index} msg={msg} currentUserId={session?.user?.id} />
              ))}
            </div>
          )}
          {isLoading && (
            <div className="max-w-3xl mx-auto w-full">
              <div className="flex items-start gap-3 my-4">
                <div className="w-8 h-8"><Image src="/logo.png" alt="CheckYuk! Logo" width={32} height={32} /></div>
                <div className="p-3 rounded-lg bg-gray-100">
                    <div className="flex items-center gap-2 py-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.2s]"></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:0.4s]"></span>
                    </div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        
        <div className="p-4 bg-white w-full flex justify-center border-t">
          <div className="w-full max-w-3xl relative">
            <form onSubmit={handleFormSubmit}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeChat ? "Ketik pesanmu di sini..." : "Pilih percakapan untuk memulai"}
                className="flex-1 w-full p-4 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
                rows={1}
                disabled={isLoading || !activeChat}
              />
              <button
                type="submit"
                disabled={isLoading || !prompt.trim() || !activeChat}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black text-white rounded-lg disabled:bg-gray-300 disabled:text-gray-500"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}