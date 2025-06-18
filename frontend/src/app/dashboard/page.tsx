"use client";
import { useState } from "react";
import { useSocket } from "../context/SocketProvider";
import { useSession } from "next-auth/react";

export default function DashboardPage() {
  const { socket, isConnected } = useSocket();
  const { data: session } = useSession();
  const [isOnline, setIsOnline] = useState(false);

 
  if (session?.user?.role !== 'professional') {
    return <div className="p-8">Akses ditolak. Halaman ini hanya untuk profesional.</div>;
  }

  const toggleOnlineStatus = () => {
    if (!socket || !session?.user?.id) return;

    if (isOnline) {
      
      setIsOnline(false);
      alert("Anda sekarang offline.");
    } else {
      socket.emit('professional_online', session.user.id);
      setIsOnline(true);
      alert("Anda sekarang online dan siap menerima pasien.");
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Dashboard Profesional</h1>
      <p className="mb-4">Status Koneksi: {isConnected ? 'Terhubung' : 'Terputus'}</p>

      <button
        onClick={toggleOnlineStatus}
        className={`px-6 py-3 rounded-lg text-white font-bold ${isOnline ? 'bg-red-500' : 'bg-green-500'}`}
      >
        {isOnline ? 'Go Offline' : 'Go Online'}
      </button>

      <div className="mt-8">
        <h2 className="text-xl font-semibold">Pasien Menunggu:</h2>
        <p className="text-gray-500 mt-2">Belum ada pasien.</p>
      </div>
    </div>
  );
}