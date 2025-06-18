require("dotenv").config();
const http = require('http');
const { Server } = require("socket.io");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const bcrypt = require('bcrypt'); 

const app = express();
const server = http.createServer(app); 
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", 
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 5000;
const saltRounds = 10; 

app.use(cors());
app.use(express.json());

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);
  socket.on('private_message', ({ to, message }) => {
    io.to(to).emit('receive_message', { from: socket.id, message });
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
  });
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Berhasil terhubung ke MongoDB Atlas"))
  .catch((err) => console.error("Koneksi MongoDB gagal:", err));

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: { 
    type: String, 
    enum: ['user', 'professional'], 
    default: 'user' 
  },
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "model"],
    required: true,
  },
  parts: {
    type: String,
    required: true,
  },
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    default: "Percakapan Baru",
  },
  history: [messageSchema],
}, { timestamps: true });

const Conversation = mongoose.model("Conversation", conversationSchema);

const liveChatSessionSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  professionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['waiting', 'active', 'closed'], default: 'waiting' },
}, { timestamps: true });
const LiveChatSession = mongoose.model('LiveChatSession', liveChatSessionSchema);

const liveChatMessageSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveChatSession', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
}, { timestamps: true });
const LiveChatMessage = mongoose.model('LiveChatMessage', liveChatMessageSchema);

app.post("/api/chat", async (req, res) => {
  try {
    const { prompt, conversationId, userId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Akses ditolak. ID Pengguna dibutuhkan." });
    }
    if (!prompt) {
      return res.status(400).json({ error: "Prompt tidak boleh kosong." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let conversation;
    let chat;

    if (conversationId) {
      conversation = await Conversation.findOne({ _id: conversationId, userId: userId });
      if (!conversation) {
        return res.status(404).json({ error: "Percakapan tidak ditemukan atau Anda tidak memiliki akses." });
      }
      const geminiHistory = conversation.history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.parts }]
      }));
      chat = model.startChat({ history: geminiHistory });
    } else {
      conversation = new Conversation({ userId: userId, history: [] });
      chat = model.startChat({ history: [] });
    }

    const systemInstruction = `
        ## PERAN DAN TUJUAN UTAMA
        Kamu adalah "CheckYuk!", sebuah Asisten Triase dan Informasi Gejala berbasis AI...
        // (Isi lengkap systemInstruction Anda di sini...)
    `;
    const fullPrompt = `${systemInstruction}\n\n--- PERTANYAAN PENGGUNA ---\n${prompt}`;

    const result = await chat.sendMessage(fullPrompt);
    const response = await result.response;
    const modelResponseText = response.text();

    conversation.history.push({ role: "user", parts: prompt });
    conversation.history.push({ role: "model", parts: modelResponseText });

    if (!conversationId) {
      conversation.title = prompt.substring(0, 30) + (prompt.length > 30 ? "..." : "");
    }

    await conversation.save();

    res.json({
      modelResponse: modelResponseText,
      conversationId: conversation._id,
      title: conversation.title
    });

  } catch (error) {
    console.error("Error di /api/chat:", error);
    res.status(500).json({ error: "Terjadi kesalahan pada server." });
  }
});

app.get("/api/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const histories = await Conversation.find({ userId: userId }, 'title _id createdAt').sort({ createdAt: -1 });
    res.json(histories);
  } catch (error) {
    console.error("Error di /api/history:", error);
    res.status(500).json({ error: "Gagal mengambil riwayat." });
  }
});

app.get("/api/conversation/:id", async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: "Percakapan tidak ditemukan." });
    }
    res.json(conversation);
  } catch (error) {
    console.error("Error di /api/conversation/:id:", error);
    res.status(500).json({ error: "Gagal mengambil percakapan." });
  }
});

app.delete("/api/conversation/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedConversation = await Conversation.findByIdAndDelete(id);
    if (!deletedConversation) {
      return res.status(404).json({ message: "Percakapan tidak ditemukan." });
    }
    res.status(200).json({ message: "Percakapan berhasil dihapus." });
  } catch (error) {
    console.error("Error saat menghapus percakapan:", error);
    res.status(500).json({ message: "Gagal menghapus percakapan." });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email dan password dibutuhkan." });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "Email sudah terdaftar." });
    }
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: "User berhasil dibuat." });
  } catch (error) {
    console.error("Error saat registrasi:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email dan password dibutuhkan." });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Email atau password salah." });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Email atau password salah." });
    }
    res.status(200).json({
      id: user._id,
      email: user.email,
      role: user.role
    });
  } catch (error) {
    console.error("Error saat login:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
});

app.get("/api/history/all/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "User ID tidak valid." });
    }

    const aiConversations = await Conversation.find({ userId: userId }, 'title createdAt').lean();
    
    const liveChatSessions = await LiveChatSession.find({ patientId: userId }, 'professionalId createdAt status').populate('professionalId', 'email');

    const formattedAiHistory = aiConversations.map(c => ({
      _id: c._id.toString(),
      title: c.title,
      type: 'ai', 
      createdAt: c.createdAt,
    }));

    const formattedLiveHistory = liveChatSessions.map(s => ({
      _id: s._id.toString(),
      title: `Konsultasi dengan ${s.professionalId ? 'Dr. ' + s.professionalId.email.split('@')[0] : 'Profesional'}`, 
      type: 'live', 
      createdAt: s.createdAt,
    }));
    const allHistory = [...formattedAiHistory, ...formattedLiveHistory].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(allHistory);
  } catch (error) {
    console.error("Error mengambil semua riwayat:", error);
    res.status(500).json({ error: "Gagal mengambil semua riwayat." });
  }
});

server.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});