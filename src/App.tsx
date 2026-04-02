import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { Send, Download, Monitor, Smartphone, Sparkles, Heart, Star, Circle, Square, Plus, Trash2, LayoutDashboard, ArrowLeft, ExternalLink, Lock, User, LogOut, Image as ImageIcon, X } from 'lucide-react';
import { cn } from './lib/utils';

interface Wish {
  id: number;
  text: string;
  color: string;
  shape: string;
  full_name?: string;
  position_name?: string;
  hotel_code?: string;
  employee_code?: string;
  sender_id?: string;
  created_at: string;
  roomCode?: string;
}

interface Room {
  id: number;
  code: string;
  title: string;
  background_url?: string;
  show_sender_name?: number;
  show_qr?: number;
  created_at: string;
}

const NEON_COLORS = [
  { bg: 'bg-[#ff0055]', border: 'border-[#ff0055]', shadow: 'shadow-[#ff0055]/50', text: 'text-white' },
  { bg: 'bg-[#00fbff]', border: 'border-[#00fbff]', shadow: 'shadow-[#00fbff]/50', text: 'text-black' },
  { bg: 'bg-[#00ff66]', border: 'border-[#00ff66]', shadow: 'shadow-[#00ff66]/50', text: 'text-black' },
  { bg: 'bg-[#ffcc00]', border: 'border-[#ffcc00]', shadow: 'shadow-[#ffcc00]/50', text: 'text-black' },
  { bg: 'bg-[#ff00ff]', border: 'border-[#ff00ff]', shadow: 'shadow-[#ff00ff]/50', text: 'text-white' },
  { bg: 'bg-[#7700ff]', border: 'border-[#7700ff]', shadow: 'shadow-[#7700ff]/50', text: 'text-white' },
  { bg: 'bg-[#ff6600]', border: 'border-[#ff6600]', shadow: 'shadow-[#ff6600]/50', text: 'text-white' },
  { bg: 'bg-[#0066ff]', border: 'border-[#0066ff]', shadow: 'shadow-[#0066ff]/50', text: 'text-white' },
];

const SHAPES = ['bubble', 'cloud', 'gem', 'capsule', 'organic', 'star', 'heart'];

export default function App() {
  const [view, setView] = useState<'super-admin' | 'selection' | 'sender' | 'display'>('sender');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => sessionStorage.getItem('super_admin_logged_in') === 'true');
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [senderInfo, setSenderInfo] = useState({
    fullName: '',
    positionName: '',
    hotelCode: '',
    employeeCode: ''
  });
  const [senderId, setSenderId] = useState<string>("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const params = new URLSearchParams(window.location.search);
  const roomCode = params.get('room');
  const isSuperAdmin = params.get('super') === 'true';

  useEffect(() => {
    // Handle unique sender ID
    let sId = localStorage.getItem('sender_id');
    if (!sId) {
      sId = 'user_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('sender_id', sId);
    }
    setSenderId(sId);

    // Capture sender info from URL
    const fullName = params.get('FullName') || '';
    const positionName = params.get('PositionName') || '';
    const hotelCode = params.get('HotelCode') || '';
    const employeeCode = params.get('employeecode') || '';

    if (fullName || positionName || hotelCode || employeeCode) {
      setSenderInfo({
        fullName,
        positionName,
        hotelCode,
        employeeCode
      });
    }

    if (isSuperAdmin) {
      setView('super-admin');
      fetchRooms();
    } else if (params.get('admin') === 'true') {
      setIsAdmin(true);
      setView('selection');
    }

    const newSocket = io();
    setSocket(newSocket);

    if (roomCode) {
      const normalized = roomCode.toLowerCase().trim();
      newSocket.emit('join_room', normalized);
      fetchRoomDetails(normalized);
    }

    newSocket.on('new_wish', (wish: Wish) => {
      console.log('Received new wish via socket:', wish);
      setWishes((prev) => [...prev, wish]);
    });

    newSocket.on('delete_wish', (wishId: number) => {
      console.log('Received delete wish via socket:', wishId);
      setWishes((prev) => prev.filter(w => w.id !== wishId));
    });

    // Initial fetch for wishes
    const wishesUrl = roomCode ? `/api/wishes?roomCode=${roomCode}` : '/api/wishes';
    window.fetch(wishesUrl)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          console.error(`[Wishes Fetch Error] Status: ${res.status}, Body: ${text.substring(0, 200)}`);
          return [];
        }
        return res.json();
      })
      .then((data) => setWishes(data))
      .catch(err => console.error("[Wishes Fetch Error]", err));

    return () => {
      newSocket.close();
    };
  }, [roomCode, isSuperAdmin]);

  const fetchRooms = async () => {
    try {
      const res = await window.fetch('/api/rooms');
      if (!res.ok) throw new Error(`Status: ${res.status}`);
      const data = await res.json();
      setRooms(data);
    } catch (err) {
      console.error("[Rooms Fetch Error]", err);
    }
  };

  const fetchRoomDetails = async (code: string) => {
    try {
      const res = await window.fetch('/api/rooms');
      if (!res.ok) throw new Error(`Status: ${res.status}`);
      const data: Room[] = await res.json();
      const room = data.find(r => r.code === code);
      if (room) {
        setCurrentRoom(room);
      }
    } catch (err) {
      console.error("[Room Details Fetch Error]", err);
    }
  };

  useEffect(() => {
    if (view === 'display' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [wishes, view]);

  const getRandomColor = () => {
    const color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
    return JSON.stringify(color);
  };

  if (view === 'super-admin' && isSuperAdmin) {
    if (!isLoggedIn) {
      return (
        <LoginView onLogin={() => {
          setIsLoggedIn(true);
          sessionStorage.setItem('super_admin_logged_in', 'true');
        }} />
      );
    }
    return <SuperAdminView rooms={rooms} onRefresh={fetchRooms} onLogout={() => {
      setIsLoggedIn(false);
      sessionStorage.removeItem('super_admin_logged_in');
    }} />;
  }

  if (view === 'selection' && isAdmin) {
    return (
      <div className="min-h-screen display-bg flex items-center justify-center p-6 font-sans relative overflow-hidden">
        <div className="max-w-md w-full space-y-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h1 className="text-5xl font-bold text-white tracking-tighter italic serif">
              {currentRoom?.title || 'Bức tường'}
            </h1>
            <p className="text-neutral-400">Chế độ quản trị phòng: <span className="text-red-500 font-mono">{roomCode}</span></p>
          </motion.div>

          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => setView('display')}
              className="group relative p-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl hover:border-red-500 transition-all text-left"
            >
              <Monitor className="w-8 h-8 text-red-500 mb-4" />
              <h3 className="text-xl font-semibold text-white">Màn hình lớn</h3>
              <p className="text-neutral-400 text-sm">Dành cho máy tính/màn hình hội trường</p>
            </button>

            <button
              onClick={() => setView('sender')}
              className="group relative p-8 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl hover:border-sky-500 transition-all text-left"
            >
              <Smartphone className="w-8 h-8 text-sky-500 mb-4" />
              <h3 className="text-xl font-semibold text-white">Người gửi</h3>
              <p className="text-neutral-400 text-sm">Dành cho điện thoại cá nhân</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'sender') {
    return <SenderView getRandomColor={getRandomColor} roomCode={roomCode} roomTitle={currentRoom?.title} roomBg={currentRoom?.background_url} isAdmin={isAdmin} senderInfo={senderInfo} senderId={senderId} onBackToAdmin={() => setView('selection')} />;
  }

  if (view === 'display' && (isAdmin || isSuperAdmin)) {
    return <DisplayView wishes={wishes} scrollRef={scrollRef} roomCode={roomCode} roomTitle={currentRoom?.title} roomBg={currentRoom?.background_url} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} currentRoom={currentRoom} onBackToAdmin={() => setView('selection')} />;
  }

  return <SenderView getRandomColor={getRandomColor} roomCode={roomCode} roomTitle={currentRoom?.title} roomBg={currentRoom?.background_url} senderInfo={senderInfo} senderId={senderId} />;
}

function LoginView({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'superadmin' && password === 'Admin@123') {
      onLogin();
    } else {
      setError('Tên đăng nhập hoặc mật khẩu không đúng');
    }
  };

  return (
    <div className="min-h-screen display-bg flex flex-col items-center justify-center p-6 font-sans relative">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10"
      >
        <div className="text-center mb-8">
          <h2 className="text-red-500 font-bold text-sm uppercase tracking-[0.3em] mb-2">HỆ THỐNG GỬI TIN NHẮN REALTIME</h2>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/20 text-red-500 mb-4">
            <Lock size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight italic serif">Super Admin Login</h1>
          <p className="text-neutral-400 mt-2">Vui lòng đăng nhập để quản lý hệ thống</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300 flex items-center gap-2">
              <User size={16} /> Tên đăng nhập
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
              placeholder="Nhập tên đăng nhập"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300 flex items-center gap-2">
              <Lock size={16} /> Mật khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
              placeholder="Nhập mật khẩu"
              required
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-sm text-center"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-[0.98]"
          >
            Đăng nhập
          </button>
        </form>
      </motion.div>

      <footer className="absolute bottom-8 text-neutral-500 text-xs font-medium tracking-wider uppercase">
        @Copyright CMTQ - Mường Thanh Hospitality
      </footer>
    </div>
  );
}

function SuperAdminView({ rooms, onRefresh, onLogout }: { rooms: Room[], onRefresh: () => void, onLogout: () => void }) {
  const [newRoomCode, setNewRoomCode] = useState('');
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [newRoomBg, setNewRoomBg] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Ảnh quá lớn. Vui lòng chọn ảnh dưới 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewRoomBg(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomCode || !newRoomTitle) return;
    setIsCreating(true);
    setError(null);
    try {
      const response = await window.fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: newRoomCode, 
          title: newRoomTitle,
          background_url: newRoomBg 
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Không thể tạo phòng');
      }

      setNewRoomCode('');
      setNewRoomTitle('');
      setNewRoomBg(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRoom = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa phòng này?')) return;
    await window.fetch(`/api/rooms/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const handleToggleSenderName = async (id: number, currentStatus: number) => {
    try {
      await window.fetch(`/api/rooms/${id}/toggle-name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_sender_name: currentStatus === 1 ? 0 : 1 }),
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleQr = async (id: number, currentStatus: number) => {
    try {
      await window.fetch(`/api/rooms/${id}/toggle-qr`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_qr: currentStatus === 1 ? 0 : 1 }),
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const [lanIp, setLanIp] = useState<string>('');
  useEffect(() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      window.fetch('/api/lan-ip')
        .then(res => res.json())
        .then(data => { if (data?.ip && data.ip !== 'localhost') setLanIp(data.ip) })
        .catch(console.error);
    }
  }, []);

  const appUrl = import.meta.env.VITE_APP_URL || (lanIp ? `${window.location.protocol}//${lanIp}${window.location.port ? ':' + window.location.port : ''}` : window.location.origin);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/20">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Super Admin Dashboard</h1>
              <div className="flex items-center gap-2 text-neutral-500 text-sm">
                <span>Quản lý các phòng</span>
                <span className="text-neutral-700">•</span>
                <span className="font-mono text-[10px] bg-white/5 px-2 py-0.5 rounded border border-white/5">
                  Link Admin: {appUrl}/?super=true
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all text-neutral-400 hover:text-white"
          >
            <LogOut size={18} />
            Đăng xuất
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create Room Form */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-red-500" />
                Tạo phòng mới
              </h2>
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Mã phòng (Room Code)</label>
                  <input
                    type="text"
                    value={newRoomCode}
                    onChange={(e) => setNewRoomCode(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    placeholder="VD: event-2024"
                    className="w-full p-3 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Tiêu đề hiển thị</label>
                  <input
                    type="text"
                    value={newRoomTitle}
                    onChange={(e) => setNewRoomTitle(e.target.value)}
                    placeholder="VD: event-2024"
                    className="w-full p-3 bg-black/40 border border-white/10 rounded-xl focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Ảnh nền (Background)</label>
                  <div className="space-y-3">
                    {newRoomBg ? (
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/20 group">
                        <img src={newRoomBg} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => setNewRoomBg(null)}
                          className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-red-600 rounded-full transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full aspect-video rounded-xl border-2 border-dashed border-white/10 hover:border-red-500/50 hover:bg-white/5 cursor-pointer transition-all group">
                        <ImageIcon className="w-8 h-8 text-neutral-600 group-hover:text-red-500 mb-2" />
                        <span className="text-xs text-neutral-500 group-hover:text-neutral-300">Tải ảnh lên (Max 5MB)</span>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isCreating || !newRoomCode || !newRoomTitle}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl font-bold transition-all shadow-lg shadow-red-900/20"
                >
                  {isCreating ? 'Đang tạo...' : 'Tạo phòng'}
                </button>
              </form>
            </div>
          </div>

          {/* Room List */}
          <div className="lg:col-span-2">
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="p-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">Phòng</th>
                    <th className="p-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">Mã</th>
                    <th className="p-4 text-xs font-bold text-neutral-500 uppercase tracking-widest text-center">Hiện tên</th>
                    <th className="p-4 text-xs font-bold text-neutral-500 uppercase tracking-widest text-center">Hiện QR</th>
                    <th className="p-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">Liên kết</th>
                    <th className="p-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rooms.map((room) => (
                    <tr key={room.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="font-bold">{room.title}</div>
                        <div className="text-xs text-neutral-500">{new Date(room.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-red-500/10 text-red-500 rounded text-xs font-mono font-bold">
                          {room.code}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleToggleSenderName(room.id, room.show_sender_name || 0)}
                          className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
                            room.show_sender_name 
                              ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/20" 
                              : "bg-white/5 text-neutral-500 border border-white/10"
                          )}
                        >
                          {room.show_sender_name ? 'Hiện' : 'Ẩn'}
                        </button>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleToggleQr(room.id, room.show_qr || 0)}
                          className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
                            room.show_qr 
                              ? "bg-sky-500/20 text-sky-400 border border-sky-500/20" 
                              : "bg-white/5 text-neutral-500 border border-white/10"
                          )}
                        >
                          {room.show_qr ? 'Hiện' : 'Ẩn'}
                        </button>
                      </td>
                      <td className="p-4 space-y-1">
                        <a 
                          href={`${appUrl}?room=${room.code}`} 
                          target="_blank" 
                          className="text-xs text-sky-400 hover:underline flex items-center gap-1"
                        >
                          <Smartphone className="w-3 h-3" /> Người gửi
                        </a>
                        <a 
                          href={`${appUrl}?room=${room.code}&admin=true`} 
                          target="_blank" 
                          className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <Monitor className="w-3 h-3" /> Màn hình
                        </a>
                      </td>
                      <td className="p-4">
                        <button 
                          onClick={() => handleDeleteRoom(room.id)}
                          className="p-2 text-neutral-500 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rooms.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-neutral-500 italic">
                        Chưa có phòng nào được tạo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      <footer className="mt-12 pb-8 text-center">
        <p className="text-neutral-600 text-xs font-medium tracking-widest uppercase">
          @Copyright CMTQ - Mường Thanh Hospitality
        </p>
      </footer>
    </div>
  );
}

function SenderView({ getRandomColor, roomCode, roomTitle, roomBg, isAdmin, senderInfo, senderId, onBackToAdmin }: { getRandomColor: () => string, roomCode: string | null, roomTitle?: string, roomBg?: string, isAdmin?: boolean, senderInfo: any, senderId: string, onBackToAdmin?: () => void }) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSending || !roomCode) return;

    setIsSending(true);
    try {
      const color = getRandomColor();
      const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
      
      await window.fetch('/api/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          color, 
          shape, 
          roomCode,
          full_name: senderInfo.fullName,
          position_name: senderInfo.positionName,
          hotel_code: senderInfo.hotelCode,
          employee_code: senderInfo.employeeCode,
          sender_id: senderId
        }),
      });
      
      setText('');
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSending(false);
    }
  };

  if (!roomCode) {
    return (
      <div className="min-h-screen bg-[#1a0202] flex items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-500">
            <Smartphone className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white">Vui lòng quét mã QR để tham gia</h2>
          <p className="text-white/40">Bạn cần một mã phòng để gửi nội dung.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a0202] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Background Image */}
      {roomBg && (
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-40"
          style={{ backgroundImage: `url(${roomBg})` }}
        />
      )}
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
        <svg className="w-full h-full" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 100 Q 50 100 80 20" fill="none" stroke="white" strokeWidth="0.5" />
        </svg>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white/5 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/10 relative z-10"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-500">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">{roomTitle || 'Gửi nội dung'}</h2>
            <p className="text-white/40 text-sm">Phòng: <span className="font-mono text-red-400">{roomCode}</span></p>
          </div>
          {isAdmin && (
            <button 
              onClick={onBackToAdmin}
              className="ml-auto p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 transition-colors"
              title="Quay lại quản trị"
            >
              <LayoutDashboard className="w-5 h-5" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Nhập nội dung của bạn..."
              className="w-full h-40 p-4 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none text-lg text-white placeholder:text-white/20"
              maxLength={300}
            />
            <div className="absolute bottom-3 right-3 text-xs text-white/20">
              {text.length}/300
            </div>
          </div>

          <button
            type="submit"
            disabled={!text.trim() || isSending}
            className={cn(
              "w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg",
              sent ? "bg-emerald-500" : "bg-red-600 hover:bg-red-700 active:scale-95 disabled:opacity-50 disabled:scale-100"
            )}
          >
            {sent ? (
              <>Đã gửi thành công!</>
            ) : (
              <>
                {isSending ? "Đang gửi..." : "Gửi ngay"}
                <Send className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </motion.div>

      <footer className="mt-8 text-white/20 text-[10px] font-bold tracking-[0.2em] uppercase relative z-10">
        @Copyright CMTQ - Mường Thanh Hospitality
      </footer>
    </div>
  );
}

function DisplayView({ wishes, scrollRef, roomCode, roomTitle, roomBg, isAdmin, isSuperAdmin, currentRoom, onBackToAdmin }: { wishes: Wish[], scrollRef: React.RefObject<HTMLDivElement | null>, roomCode: string | null, roomTitle?: string, roomBg?: string, isAdmin?: boolean, isSuperAdmin?: boolean, currentRoom: Room | null, onBackToAdmin?: () => void }) {
  const [lanIp, setLanIp] = useState<string>('');
  useEffect(() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      window.fetch('/api/lan-ip')
        .then(res => res.json())
        .then(data => { if (data?.ip && data.ip !== 'localhost') setLanIp(data.ip) })
        .catch(console.error);
    }
  }, []);

  // Use the standard Vite env variable or the dynamically fetched LAN IP so mobile can scan and join.
  const appUrl = import.meta.env.VITE_APP_URL || (lanIp ? `${window.location.protocol}//${lanIp}${window.location.port ? ':' + window.location.port : ''}` : window.location.origin);
  const fullUrl = roomCode ? `${appUrl}?room=${roomCode}` : appUrl;

  const [showSenderName, setShowSenderName] = useState(currentRoom?.show_sender_name === 1);
  const [showQr, setShowQr] = useState(currentRoom?.show_qr === 1);

  useEffect(() => {
    const socket = io();
    if (roomCode) {
      socket.emit('join_room', roomCode);
    }
    
    socket.on('toggle_name', (data: { show_sender_name: boolean }) => {
      setShowSenderName(data.show_sender_name);
    });

    socket.on('toggle_qr', (data: { show_qr: boolean }) => {
      setShowQr(data.show_qr);
    });

    return () => {
      socket.close();
    };
  }, [roomCode]);

  useEffect(() => {
    setShowSenderName(currentRoom?.show_sender_name === 1);
    setShowQr(currentRoom?.show_qr === 1);
  }, [currentRoom]);

  const handleExport = () => {
    window.location.href = roomCode ? `/api/export?roomCode=${roomCode}` : '/api/export';
  };

  const handleDeleteWish = async (id: number) => {
    try {
      const res = await window.fetch(`/api/wishes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete wish');
    } catch (err) {
      console.error(err);
      alert('Không thể xóa tin nhắn. Vui lòng thử lại.');
    }
  };

  if (!roomCode) {
    return (
      <div className="h-screen display-bg flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <Monitor className="w-16 h-16 mx-auto text-red-500 opacity-50" />
          <h2 className="text-2xl font-bold">Không tìm thấy mã phòng</h2>
          <p className="text-neutral-400">Vui lòng truy cập thông qua link quản lý phòng.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen display-bg flex flex-col overflow-hidden font-sans relative">
      {/* Background Image */}
      {roomBg && (
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{ backgroundImage: `url(${roomBg})` }}
        />
      )}
      {/* Decorative Arrow Overlay */}
      <div className="absolute bottom-0 right-0 w-2/3 h-2/3 pointer-events-none opacity-20 z-0">
        <svg viewBox="0 0 500 500" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <path 
            d="M50 450 Q 250 450 400 150 L 350 150 L 420 50 L 490 150 L 440 150 Q 300 400 50 450" 
            fill="none" 
            stroke="white" 
            strokeWidth="2"
          />
          <path d="M420 50 L 400 100 L 440 100 Z" fill="white" />
          <path d="M400 150 L 440 150 L 420 100 Z" fill="none" stroke="white" strokeWidth="1" opacity="0.5" />
          <path d="M100 440 L 150 420 L 120 400 Z" fill="none" stroke="white" strokeWidth="1" opacity="0.3" />
        </svg>
      </div>

      {/* Header */}
      <header className="p-6 bg-transparent flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-900/40">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tighter italic serif">{roomTitle || 'Bức Tường'}</h1>
            <p className="text-red-200/60 text-sm">Mã phòng: <span className="font-mono font-bold text-white">{roomCode}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-2">
            {isAdmin && (
              <button 
                onClick={onBackToAdmin}
                className="flex items-center justify-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-colors text-xs"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Quản trị</span>
              </button>
            )}
            <button 
              onClick={handleExport}
              className="flex items-center justify-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-colors text-xs"
            >
              <Download className="w-3 h-3" />
              <span>Xuất Excel</span>
            </button>
          </div>
        </div>
      </header>

      {/* Large QR Popup */}
      <AnimatePresence>
        {showQr && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 50 }}
              className="bg-white p-12 rounded-[3rem] shadow-[0_0_100px_rgba(255,255,255,0.2)] flex flex-col items-center gap-8 max-w-2xl w-full"
            >
              <div className="text-center space-y-2">
                <h2 className="text-4xl font-black text-black tracking-tighter uppercase italic serif">Quét mã để tham gia</h2>
                <p className="text-neutral-500 font-mono text-xl">{fullUrl.replace(/^https?:\/\//, '')}</p>
              </div>
              <div className="bg-white p-4 rounded-3xl shadow-xl border-8 border-neutral-100">
                <QRCodeSVG value={fullUrl} size={400} />
              </div>
              <p className="text-neutral-400 text-sm font-medium uppercase tracking-widest">@Mường Thanh Hospitality</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Wall */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-12 relative scroll-smooth z-10"
      >
        <div className="flex flex-wrap justify-center gap-12 max-w-7xl mx-auto">
          <AnimatePresence mode="popLayout">
            {wishes.map((wish) => (
              <motion.div
                key={wish.id}
                layout
                initial={{ opacity: 0, scale: 0.5, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ 
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                }}
                className="w-full sm:w-[calc(50%-1.5rem)] lg:w-[calc(33.33%-2rem)] xl:w-[calc(25%-2.25rem)] min-w-[280px]"
              >
                <WishContent 
                  wish={wish} 
                  canDelete={isAdmin || isSuperAdmin} 
                  onDelete={handleDeleteWish} 
                  showSenderName={showSenderName}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        {wishes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
                <Heart className="w-10 h-10 text-white/20" />
              </div>
              <p className="text-white/40 text-xl font-medium">Đang chờ những nội dung đầu tiên...</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer Stats */}
      <footer className="p-4 bg-black/20 border-t border-white/5 flex flex-col items-center gap-2 z-20">
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span>{wishes.length} nội dung đã được gửi</span>
        </div>
        <div className="text-white/10 text-[9px] font-bold tracking-[0.3em] uppercase">
          @Copyright CMTQ - Mường Thanh Hospitality
        </div>
      </footer>
    </div>
  );
}

const getShapeClass = (shape: string) => {
  switch (shape) {
    case 'bubble': return 'rounded-[40%_60%_70%_30%/40%_50%_60%_50%]';
    case 'cloud': return 'rounded-[3rem_3rem_2rem_2rem]';
    case 'gem': return 'rounded-[1rem_4rem_1rem_4rem]';
    case 'capsule': return 'rounded-full';
    case 'organic': return 'rounded-[60%_40%_30%_70%/60%_30%_70%_40%]';
    case 'star': return 'rounded-[20%_80%_20%_80%/20%_80%_20%_80%] rotate-45';
    case 'heart': return 'rounded-[50%_50%_0%_0%/40%_40%_0%_0%]';
    default: return 'rounded-3xl';
  }
};

function WishContent({ wish, onDelete, canDelete, showSenderName }: { wish: Wish, onDelete?: (id: number) => void, canDelete?: boolean, showSenderName?: boolean }) {
  let colorData;
  try {
    colorData = JSON.parse(wish.color);
  } catch (e) {
    colorData = { bg: 'bg-rose-400', border: 'border-white/20', shadow: 'shadow-white/20', text: 'text-white' };
  }

  const Icon = () => {
    switch (wish.shape) {
      case 'bubble': return <Circle className="w-4 h-4 opacity-50 mb-2" />;
      case 'cloud': return <Sparkles className="w-4 h-4 opacity-50 mb-2" />;
      case 'gem': return <Star className="w-4 h-4 opacity-50 mb-2" />;
      case 'star': return <Star className="w-4 h-4 opacity-50 mb-2" />;
      case 'heart': return <Heart className="w-4 h-4 opacity-50 mb-2" />;
      default: return <Heart className="w-4 h-4 opacity-50 mb-2" />;
    }
  };

  // Dynamically adjust font size based on text length to prevent overflow
  const getFontSize = (length: number) => {
    if (length > 200) return 'text-sm';
    if (length > 100) return 'text-base';
    return 'text-xl';
  };

  return (
    <div className={cn(
      "group relative p-8 flex flex-col items-center justify-center min-h-[200px] w-full transition-all duration-500",
      "border-2 backdrop-blur-sm shadow-[0_0_30px_rgba(0,0,0,0.3)]",
      "before:absolute before:inset-0 before:rounded-[inherit] before:bg-gradient-to-br before:from-white/40 before:to-transparent before:opacity-50",
      "after:absolute after:top-2 after:left-4 after:w-1/3 after:h-1/4 after:bg-white/30 after:rounded-full after:blur-sm",
      colorData.bg,
      colorData.border,
      colorData.shadow,
      getShapeClass(wish.shape)
    )}>
      {canDelete && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('Bạn có chắc chắn muốn xóa tin nhắn này?')) {
              onDelete(wish.id);
            }
          }}
          className="absolute top-4 right-4 z-30 p-2 bg-black/40 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
          title="Xóa tin nhắn"
        >
          <X size={14} />
        </button>
      )}
      <div className={cn(
        "relative z-10 flex flex-col items-center text-center w-full", 
        colorData.text,
        wish.shape === 'star' ? '-rotate-45' : '' // Counter-rotate text for star shape
      )}>
        <Icon />
        <p className={cn(
          "font-black leading-tight tracking-tight drop-shadow-sm break-words w-full overflow-hidden",
          getFontSize(wish.text.length)
        )}>
          {wish.text}
        </p>
        <div className="mt-4 flex items-center gap-2 opacity-40">
          <div className={cn("w-1 h-1 rounded-full", colorData.text === 'text-white' ? 'bg-white' : 'bg-black')} />
          <span className="text-[10px] font-mono uppercase tracking-widest font-bold">
            {showSenderName && wish.full_name ? wish.full_name : `#${wish.id.toString().padStart(3, '0')}`}
          </span>
        </div>
      </div>
    </div>
  );
}
