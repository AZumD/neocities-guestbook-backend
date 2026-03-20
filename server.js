const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const dbPath = process.env.DB_PATH || path.join(__dirname, "guestbook.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS guestbook_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

app.get("/api/guestbook", (req, res) => {
  db.all(
    `
    SELECT id, name, message, created_at
    FROM guestbook_messages
    ORDER BY id DESC
    LIMIT 50
    `,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Database read failed" });
      }

      res.json(rows.reverse());
    }
  );
});

app.post("/api/guestbook", (req, res) => {
  const { name, message } = req.body;

  if (!name || !message) {
    return res.status(400).json({ error: "Name and message are required" });
  }

  if (name.length > 30 || message.length > 200) {
    return res.status(400).json({ error: "Input too long" });
  }

  db.run(
    `INSERT INTO guestbook_messages (name, message) VALUES (?, ?)`,
    [name, message],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Database write failed" });
      }

      res.status(201).json({
        id: this.lastID,
        name,
        message,
      });
    }
  );
});

app.listen(PORT, () => {
  console.log(`Guestbook API running on port ${PORT}`);
});


app.delete("/api/guestbook/:id", (req, res) => {
  const { id } = req.params;
  const adminKey = req.headers["x-admin-key"];

  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }

  db.run(
    `DELETE FROM guestbook_messages WHERE id = ?`,
    [id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "Database delete failed" });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: "Message not found" });
      }

      res.json({ success: true });
    }
  );
});
