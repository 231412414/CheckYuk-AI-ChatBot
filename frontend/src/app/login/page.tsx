"use client";
import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Menampilkan pesan sukses setelah registrasi
    if (searchParams.get('registered') === 'true') {
      setSuccess('Registrasi berhasil! Silakan login.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    
    // Gunakan fungsi 'signIn' dari NextAuth, bukan axios
    const result = await signIn('credentials', {
      redirect: false, // Kita akan handle redirect manual agar bisa menampilkan error
      email,
      password,
    });

    setLoading(false);

    if (result?.error) {
      setError('Email atau password salah. Silakan coba lagi.');
    } else if (result?.ok) {
      // Jika berhasil, arahkan ke halaman chat utama
      router.push('/'); 
    }
  };
  
  const handleGuest = () => {
    // Langsung arahkan ke halaman utama sebagai tamu
    router.push('/'); 
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white rounded-xl shadow-lg w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Login ke CheckYuk!</h1>
        {success && <p className="bg-green-100 text-green-700 text-sm p-3 rounded-lg mb-4 text-center">{success}</p>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2 font-medium" htmlFor="email">Email</label>
            <input 
              type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder:text-gray-400" 
              required 
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 mb-2 font-medium" htmlFor="password">Password</label>
            <input 
              type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder:text-gray-400" 
              required 
            />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-black text-white p-3 rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-400 transition-colors">
             {loading ? 'Memproses...' : 'Login'}
          </button>
          {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
        </form>
        <div className="my-4 flex items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink mx-4 text-gray-500 text-xs">atau</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>
        <button onClick={handleGuest} className="w-full bg-gray-200 text-gray-800 p-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors">Masuk sebagai Tamu</button>
        <p className="mt-6 text-center text-sm text-gray-600">
          Belum punya akun? <Link href="/register" className="text-blue-600 hover:underline font-medium">Daftar gratis</Link>
        </p>
      </div>
    </div>
  );
}