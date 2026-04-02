import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import * as XLSX from "xlsx";
import os from "os";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

// Configure database path for persistent storage (e.g., Render.com)
const dataDir = process.env.DATA_DIR || process.cwd();
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, "wishes.db");
const db = new Database(dbPath);
console.log(`Database initialized at: ${dbPath}`);

// Socket.io logic
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  socket.on("join_room", (roomCode) => {
    if (roomCode) {
      const normalizedRoom = String(roomCode).toLowerCase().trim();
      socket.join(normalizedRoom);
      console.log(`Socket ${socket.id} joined room: ${normalizedRoom}`);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Initialize database
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      background_url TEXT,
      show_sender_name INTEGER DEFAULT 0,
      show_qr INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wishes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER,
      text TEXT NOT NULL,
      color TEXT NOT NULL,
      shape TEXT NOT NULL,
      full_name TEXT,
      position_name TEXT,
      hotel_code TEXT,
      employee_code TEXT,
      sender_id TEXT,
      deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );
  `);
  console.log("Database tables ensured.");
} catch (err) {
  console.error("Database initialization error:", err);
}

// Migration: Ensure room_id exists if table was created in older version
try {
  const columns = db.prepare("PRAGMA table_info(wishes)").all() as any[];
  const hasRoomId = columns.some(c => c.name === 'room_id');
  if (!hasRoomId) {
    console.log("Migrating database: adding room_id to wishes table");
    db.exec("ALTER TABLE wishes ADD COLUMN room_id INTEGER");
  }

  const roomColumns = db.prepare("PRAGMA table_info(rooms)").all() as any[];
  const hasBgUrl = roomColumns.some(c => c.name === 'background_url');
  if (!hasBgUrl) {
    console.log("Migrating database: adding background_url to rooms table");
    db.exec("ALTER TABLE rooms ADD COLUMN background_url TEXT");
  }

  const wishColumns = db.prepare("PRAGMA table_info(wishes)").all() as any[];
  const hasDeleted = wishColumns.some(c => c.name === 'deleted');
  if (!hasDeleted) {
    console.log("Migrating database: adding deleted to wishes table");
    db.exec("ALTER TABLE wishes ADD COLUMN deleted INTEGER DEFAULT 0");
  }

  const hasFullName = wishColumns.some(c => c.name === 'full_name');
  if (!hasFullName) {
    console.log("Migrating database: adding sender info columns to wishes table");
    db.exec("ALTER TABLE wishes ADD COLUMN full_name TEXT");
    db.exec("ALTER TABLE wishes ADD COLUMN position_name TEXT");
    db.exec("ALTER TABLE wishes ADD COLUMN hotel_code TEXT");
    db.exec("ALTER TABLE wishes ADD COLUMN employee_code TEXT");
  }

  const hasSenderId = wishColumns.some(c => c.name === 'sender_id');
  if (!hasSenderId) {
    console.log("Migrating database: adding sender_id column to wishes table");
    db.exec("ALTER TABLE wishes ADD COLUMN sender_id TEXT");
  }

  const hasShowName = roomColumns.some(c => c.name === 'show_sender_name');
  if (!hasShowName) {
    console.log("Migrating database: adding show_sender_name to rooms table");
    db.exec("ALTER TABLE rooms ADD COLUMN show_sender_name INTEGER DEFAULT 0");
  }

  const hasShowQr = roomColumns.some(c => c.name === 'show_qr');
  if (!hasShowQr) {
    console.log("Migrating database: adding show_qr to rooms table");
    db.exec("ALTER TABLE rooms ADD COLUMN show_qr INTEGER DEFAULT 0");
  }
} catch (e) {
  console.error("Migration error:", e);
}

app.use(express.json({ limit: '10mb' }));

// API Routes for Rooms
app.get("/api/lan-ip", (req, res) => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return res.json({ ip: net.address });
      }
    }
  }
  res.json({ ip: "localhost" });
});

app.get("/api/health", (req, res) => {
  try {
    const roomCount = db.prepare("SELECT count(*) as count FROM rooms").get() as { count: number };
    const wishCount = db.prepare("SELECT count(*) as count FROM wishes").get() as { count: number };
    res.json({ status: "ok", rooms: roomCount.count, wishes: wishCount.count });
  } catch (error: any) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/api/rooms", (req, res) => {
  try {
    const rooms = db.prepare("SELECT * FROM rooms ORDER BY created_at DESC").all();
    res.json(rooms);
  } catch (error: any) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/rooms", (req, res) => {
  const { code, title, background_url, show_sender_name } = req.body;
  if (!code || !title) return res.status(400).json({ error: "Code and Title are required" });

  try {
    const normalizedCode = String(code).toLowerCase().trim();
    const info = db.prepare("INSERT INTO rooms (code, title, background_url, show_sender_name) VALUES (?, ?, ?, ?)").run(normalizedCode, title, background_url || null, show_sender_name ? 1 : 0);
    res.json({ id: Number(info.lastInsertRowid), code: normalizedCode, title, background_url, show_sender_name: show_sender_name ? 1 : 0 });
  } catch (error: any) {
    console.error("Error creating room:", error);
    res.status(400).json({ error: "Room code already exists or database error" });
  }
});

app.delete("/api/rooms/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM rooms WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting room:", error);
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/rooms/:id/toggle-name", (req, res) => {
  try {
    const { show_sender_name } = req.body;
    const roomId = req.params.id;
    db.prepare("UPDATE rooms SET show_sender_name = ? WHERE id = ?").run(show_sender_name ? 1 : 0, roomId);
    
    const room = db.prepare("SELECT code FROM rooms WHERE id = ?").get(roomId) as { code: string };
    if (room) {
      io.to(room.code).emit("toggle_name", { show_sender_name: !!show_sender_name });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error toggling sender name:", error);
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/rooms/:id/toggle-qr", (req, res) => {
  try {
    const { show_qr } = req.body;
    const roomId = req.params.id;
    db.prepare("UPDATE rooms SET show_qr = ? WHERE id = ?").run(show_qr ? 1 : 0, roomId);
    
    const room = db.prepare("SELECT code FROM rooms WHERE id = ?").get(roomId) as { code: string };
    if (room) {
      io.to(room.code).emit("toggle_qr", { show_qr: !!show_qr });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error toggling QR visibility:", error);
    res.status(500).json({ error: error.message });
  }
});

// API Routes for Wishes
app.get("/api/wishes", (req, res) => {
  try {
    const { roomCode } = req.query;
    console.log(`[API] GET /api/wishes - roomCode: ${roomCode}`);
    
    if (!roomCode) {
      const wishes = db.prepare("SELECT * FROM wishes WHERE deleted = 0 ORDER BY created_at ASC").all();
      return res.json(wishes);
    }

    const normalized = String(roomCode).toLowerCase().trim();
    
    // Check if room exists first to provide better feedback
    const room = db.prepare("SELECT id FROM rooms WHERE code = ?").get(normalized) as { id: number } | undefined;
    
    if (!room) {
      console.log(`[API] Room not found: ${normalized}`);
      return res.json([]); // Return empty array if room doesn't exist
    }

    const wishes = db.prepare("SELECT * FROM wishes WHERE room_id = ? AND deleted = 0 ORDER BY created_at ASC").all(room.id);
    console.log(`[API] Found ${wishes.length} wishes for room: ${normalized}`);
    res.json(wishes);
  } catch (error: any) {
    console.error("[API] Error fetching wishes:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

app.post("/api/wishes", (req, res) => {
  try {
    const { text, color, shape, roomCode, full_name, position_name, hotel_code, employee_code, sender_id } = req.body;
    console.log(`[API] POST /api/wishes - roomCode: ${roomCode}, text: ${text?.substring(0, 20)}...`);
    
    if (!text || !roomCode) {
      return res.status(400).json({ error: "Text and roomCode are required" });
    }

    const normalizedRoomCode = String(roomCode).toLowerCase().trim();
    const room = db.prepare("SELECT id FROM rooms WHERE code = ?").get(normalizedRoomCode) as { id: number } | undefined;
    
    if (!room) {
      console.log(`[API] Room not found for posting: ${normalizedRoomCode}`);
      return res.status(404).json({ error: "Room not found" });
    }

    const info = db.prepare("INSERT INTO wishes (text, color, shape, room_id, full_name, position_name, hotel_code, employee_code, sender_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      text, 
      color, 
      shape, 
      room.id,
      full_name || null,
      position_name || null,
      hotel_code || null,
      employee_code || null,
      sender_id || null
    );
    const newWish = { 
      id: Number(info.lastInsertRowid), 
      text, 
      color, 
      shape, 
      roomCode: normalizedRoomCode,
      full_name,
      position_name,
      hotel_code,
      employee_code,
      sender_id,
      created_at: new Date().toISOString() 
    };
    
    console.log(`[API] Broadcasting new wish to room: ${normalizedRoomCode}`);
    io.to(normalizedRoomCode).emit("new_wish", newWish);
    res.json(newWish);
  } catch (error: any) {
    console.error("[API] Error creating wish:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

app.delete("/api/wishes/:id", (req, res) => {
  try {
    const wishId = req.params.id;
    const wish = db.prepare(`
      SELECT wishes.*, rooms.code as roomCode 
      FROM wishes 
      JOIN rooms ON wishes.room_id = rooms.id 
      WHERE wishes.id = ?
    `).get(wishId) as { id: number, roomCode: string } | undefined;

    if (wish) {
      db.prepare("UPDATE wishes SET deleted = 1 WHERE id = ?").run(wishId);
      io.to(wish.roomCode).emit("delete_wish", Number(wishId));
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Wish not found" });
    }
  } catch (error: any) {
    console.error("Error deleting wish:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/export", (req, res) => {
  try {
    const { roomCode } = req.query;
    console.log(`[API] GET /api/export - roomCode: ${roomCode}`);
    let activeWishes;
    let deletedWishes;
    
    if (roomCode) {
      const normalized = String(roomCode).toLowerCase().trim();
      activeWishes = db.prepare(`
        SELECT wishes.*, rooms.title as room_title FROM wishes 
        JOIN rooms ON wishes.room_id = rooms.id 
        WHERE rooms.code = ? AND wishes.deleted = 0
      `).all(normalized);
      
      deletedWishes = db.prepare(`
        SELECT wishes.*, rooms.title as room_title FROM wishes 
        JOIN rooms ON wishes.room_id = rooms.id 
        WHERE rooms.code = ? AND wishes.deleted = 1
      `).all(normalized);
    } else {
      activeWishes = db.prepare("SELECT wishes.*, rooms.title as room_title FROM wishes JOIN rooms ON wishes.room_id = rooms.id WHERE wishes.deleted = 0").all();
      deletedWishes = db.prepare("SELECT wishes.*, rooms.title as room_title FROM wishes JOIN rooms ON wishes.room_id = rooms.id WHERE wishes.deleted = 1").all();
    }

    const formatData = (data: any[]) => data.map(w => ({
      "ID": w.id,
      "Phòng": w.room_title,
      "Nội dung": w.text,
      "ID Người gửi": w.sender_id || "",
      "Họ và tên": w.full_name || "",
      "Chức danh": w.position_name || "",
      "Đơn vị": w.hotel_code || "",
      "Mã tham gia": w.employee_code || "",
      "Màu sắc": w.color,
      "Hình dạng": w.shape,
      "Ngày gửi": new Date(w.created_at).toLocaleString('vi-VN')
    }));

    // Participant info sheet logic
    let participantsQuery = `
      SELECT 
        sender_id, 
        full_name, 
        position_name, 
        hotel_code, 
        employee_code, 
        COUNT(*) as message_count 
      FROM wishes 
      JOIN rooms ON wishes.room_id = rooms.id
    `;
    
    const queryParams: any[] = [];
    if (roomCode) {
      participantsQuery += " WHERE rooms.code = ?";
      queryParams.push(String(roomCode).toLowerCase().trim());
    }
    
    participantsQuery += " GROUP BY sender_id ORDER BY message_count DESC";
    
    const participants = db.prepare(participantsQuery).all(...queryParams) as any[];
    
    const formatParticipantData = (data: any[]) => data.map(p => ({
      "ID Người gửi": p.sender_id || "N/A",
      "Họ và tên": p.full_name || "",
      "Chức danh": p.position_name || "",
      "Đơn vị": p.hotel_code || "",
      "Mã tham gia": p.employee_code || "",
      "Số lượng tin nhắn": p.message_count
    }));
    
    const workbook = XLSX.utils.book_new();
    
    const activeSheet = XLSX.utils.json_to_sheet(formatData(activeWishes));
    XLSX.utils.book_append_sheet(workbook, activeSheet, "Tin nhắn hiện tại");
    
    const deletedSheet = XLSX.utils.json_to_sheet(formatData(deletedWishes));
    XLSX.utils.book_append_sheet(workbook, deletedSheet, "Tin nhắn đã xóa");

    const participantSheet = XLSX.utils.json_to_sheet(formatParticipantData(participants));
    XLSX.utils.book_append_sheet(workbook, participantSheet, "Thông tin người tham gia");
    
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Disposition", `attachment; filename=wishes${roomCode ? '_' + roomCode : ''}.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (error: any) {
    console.error("[API] Error exporting wishes:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist/index.html"));
    });
  }
}

setupVite().then(() => {
  const PORT = 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
});
