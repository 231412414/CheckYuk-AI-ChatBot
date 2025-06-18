"use client";
import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`, { email, password });
      
      router.push('/login?registered=true'); 
    } catch (err: any) {
      // Jika ada error dari backend, tampilkan pesannya
      setError(err.response?.data?.message || 'Registrasi gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white rounded-xl shadow-lg w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Buat Akun CheckYuk!</h1>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-800 mb-2 font-medium" htmlFor="email">Email</label>
            <input 
                type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder:text-gray-400" 
                required 
            />      
          </div>
         
          <div className="mb-6">
            <label className="block text-gray-800 mb-2 font-medium" htmlFor="password">Password</label>
              <input 
               type="password" 
               id="password" 
              value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder:text-gray-400" 
                required 
            />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300 transition-colors">
            {loading ? 'Mendaftarkan...' : 'Register'}
          </button>
          {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Sudah punya akun? <Link href="/login" className="text-blue-600 hover:underline font-medium">Login di sini</Link>
        </p>
      </div>
    </div>
  );
}