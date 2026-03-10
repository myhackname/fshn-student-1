import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
// import DatabaseConstructor from "better-sqlite3";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import path from "path";
import multer from "multer";
import fs from "fs";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import cors from "cors";

const JWT_SECRET = process.env.JWT_SECRET || 'fshn-secret-key';

console.log("Server.ts is starting...");

// Firebase Admin Initialization
const getFirebaseAdmin = () => {
  if (admin.apps.length > 0) return admin.apps[0];
  
  const projectId = process.env.FIREBASE_PROJECT_ID?.replace(/^['"]|['"]$/g, '').trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.replace(/^['"]|['"]$/g, '').trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^['"]|['"]$/g, '').trim();

  if (projectId && clientEmail && privateKey) {
    try {
      return admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        storageBucket: `${projectId}.appspot.com`
      });
    } catch (e) {
      console.error("Failed to initialize Firebase Admin:", e);
      return null;
    }
  }
  return null;
};

const firebaseApp = getFirebaseAdmin();
const firestore = firebaseApp ? firebaseApp.firestore() : null;

const getIsNetlify = () => {
  const res = !!process.env.NETLIFY || !!process.env.CONTEXT || !!process.env.DEPLOY_PRIME_URL;
  return res;
};
const getIsVercel = () => !!process.env.VERCEL;
const getIsRender = () => !!process.env.RENDER;
const getIsProduction = () => process.env.NODE_ENV === "production" || getIsVercel() || getIsRender() || getIsNetlify();

console.log("Environment Check:", {
  NODE_ENV: process.env.NODE_ENV,
  isProduction: getIsProduction(),
  isNetlify: getIsNetlify(),
  isVercel: getIsVercel(),
  isRender: getIsRender(),
  cwd: process.cwd()
});

const _dirname = process.cwd();

let db: any;

export const initDb = async () => {
  if (db) return db;
  const isNetlifyEnv = getIsNetlify();
  const isVercelEnv = getIsVercel();
  const dbPath = (isVercelEnv || isNetlifyEnv) ? path.join("/tmp", "platform.db") : path.join(_dirname, "platform.db");
  
  try {
    // In serverless environments, better-sqlite3 might fail to load due to native bindings
    const { default: DatabaseConstructor } = await import("better-sqlite3");
    db = new DatabaseConstructor(dbPath);
    console.log("SQLite initialized successfully at:", dbPath);
  } catch (e) {
    console.error("Database initialization failed, using mock:", e);
    db = {
      prepare: (sql: string) => ({
        run: () => ({ lastInsertRowid: 0, changes: 0 }),
        get: () => {
          if (sql.toLowerCase().includes("count")) return { count: 0 };
          return null;
        },
        all: () => []
      }),
      exec: () => {},
      transaction: (cb: any) => cb()
    };
  }

  // Initialize Database
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    surname TEXT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('STUDENT', 'TEACHER')) NOT NULL,
    phone TEXT,
    bio TEXT,
    program TEXT,
    year TEXT,
    group_name TEXT, -- A, B, C
    study_type TEXT, -- Bachelor, Master
    is_confirmed BOOLEAN DEFAULT 0,
    class_code TEXT,
    profile_photo TEXT,
    email_verified BOOLEAN DEFAULT 0,
    email_verified_shown BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    department TEXT,
    year TEXT,
    group_name TEXT,
    study_type TEXT,
    teacher_id INTEGER,
    admin_id INTEGER, -- Student admin
    FOREIGN KEY(teacher_id) REFERENCES users(id),
    FOREIGN KEY(admin_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS class_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER,
    user_id INTEGER,
    status TEXT CHECK(status IN ('PENDING', 'CONFIRMED', 'REFUSED')) DEFAULT 'PENDING',
    is_admin BOOLEAN DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(class_id) REFERENCES classes(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS teacher_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER,
    class_id INTEGER,
    subject TEXT NOT NULL,
    day_of_week INTEGER, -- 1-5 (Mon-Fri)
    start_time TEXT NOT NULL, -- HH:MM
    end_time TEXT NOT NULL, -- HH:MM
    type TEXT CHECK(type IN ('LECTURE', 'SEMINAR')),
    FOREIGN KEY(teacher_id) REFERENCES users(id),
    FOREIGN KEY(class_id) REFERENCES classes(id)
  );

  CREATE TABLE IF NOT EXISTS library_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT,
    file_path TEXT NOT NULL,
    uploader_id INTEGER,
    class_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(uploader_id) REFERENCES users(id),
    FOREIGN KEY(class_id) REFERENCES classes(id)
  );

  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER,
    semester INTEGER, -- 1, 2, 3
    credits INTEGER,
    teacher_id INTEGER,
    exam_date DATETIME,
    room TEXT,
    status TEXT DEFAULT 'SCHEDULED',
    FOREIGN KEY(teacher_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS lecture_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER,
    status TEXT CHECK(status IN ('OPEN', 'SOON', 'NOT_COMING')),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(schedule_id) REFERENCES teacher_schedule(id)
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at DATETIME NOT NULL
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    class_id INTEGER,
    status TEXT CHECK(status IN ('PRESENT', 'ABSENT', 'OFFLINE')),
    verified_by_teacher BOOLEAN DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(class_id) REFERENCES classes(id)
  );

  CREATE TABLE IF NOT EXISTS tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    test_date DATETIME,
    duration INTEGER, -- in minutes
    total_points INTEGER,
    program TEXT,
    year TEXT,
    teacher_id INTEGER,
    status TEXT CHECK(status IN ('DRAFT', 'ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'IN_GRADING', 'PUBLISHED')) DEFAULT 'DRAFT',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(teacher_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER,
    content TEXT NOT NULL,
    type TEXT CHECK(type IN ('MCQ', 'OPEN')),
    options TEXT, -- JSON string for MCQ
    correct_answer TEXT,
    points INTEGER,
    FOREIGN KEY(test_id) REFERENCES tests(id)
  );

  CREATE TABLE IF NOT EXISTS test_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER,
    user_id INTEGER,
    is_exam BOOLEAN DEFAULT 0,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    status TEXT CHECK(status IN ('STARTED', 'SUBMITTED', 'GRADED')) DEFAULT 'STARTED',
    total_score INTEGER DEFAULT 0,
    grade INTEGER, -- Final grade 4-10
    feedback TEXT,
    FOREIGN KEY(test_id) REFERENCES tests(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS test_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER,
    question_id INTEGER,
    answer_text TEXT,
    points_awarded INTEGER DEFAULT 0,
    is_correct BOOLEAN,
    FOREIGN KEY(attempt_id) REFERENCES test_attempts(id),
    FOREIGN KEY(question_id) REFERENCES questions(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    receiver_id INTEGER, -- NULL for class chat
    class_id INTEGER,
    chat_type TEXT CHECK(chat_type IN ('PRIVATE', 'CLASS', 'SCHOOL')) DEFAULT 'CLASS',
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(receiver_id) REFERENCES users(id),
    FOREIGN KEY(class_id) REFERENCES classes(id)
  );

  CREATE TABLE IF NOT EXISTS live_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER,
    student_id INTEGER,
    content TEXT NOT NULL,
    answer TEXT,
    score INTEGER,
    status TEXT CHECK(status IN ('PENDING', 'CONFIRMED', 'ANSWERED', 'GRADED')) DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(teacher_id) REFERENCES users(id),
    FOREIGN KEY(student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    content TEXT,
    type TEXT,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    deadline DATETIME,
    materials TEXT, -- Links or descriptions of materials
    max_points INTEGER DEFAULT 100,
    submission_type TEXT CHECK(submission_type IN ('FILE', 'TEXT', 'BOTH')) DEFAULT 'BOTH',
    status TEXT CHECK(status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')) DEFAULT 'DRAFT',
    teacher_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(teacher_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER,
    student_id INTEGER,
    content TEXT,
    file_path TEXT,
    points INTEGER,
    grade INTEGER, -- Final grade 4-10
    feedback TEXT,
    status TEXT CHECK(status IN ('SUBMITTED', 'PENDING', 'GRADED')) DEFAULT 'SUBMITTED',
    is_late BOOLEAN DEFAULT 0,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    graded_at DATETIME,
    FOREIGN KEY(assignment_id) REFERENCES assignments(id),
    FOREIGN KEY(student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS study_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER,
    class_id INTEGER,
    subject TEXT,
    duration INTEGER, -- minutes
    status TEXT CHECK(status IN ('ACTIVE', 'COMPLETED')) DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(teacher_id) REFERENCES users(id),
    FOREIGN KEY(class_id) REFERENCES classes(id)
  );

  CREATE TABLE IF NOT EXISTS session_presence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    user_id INTEGER,
    is_verified BOOLEAN DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(session_id) REFERENCES study_sessions(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER,
    day_of_week TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    program TEXT NOT NULL,
    year TEXT NOT NULL,
    group_name TEXT,
    building TEXT NOT NULL,
    classroom TEXT NOT NULL,
    FOREIGN KEY(teacher_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS performance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT CHECK(type IN ('TEST', 'ASSIGNMENT', 'ATTENDANCE')),
    score REAL,
    max_score REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Migration: Add missing columns if they don't exist
const userColumns = db.prepare("PRAGMA table_info(users)").all() as any[];
const userColumnNames = userColumns.map(c => c.name);
if (!userColumnNames.includes('surname')) db.prepare("ALTER TABLE users ADD COLUMN surname TEXT").run();
if (!userColumnNames.includes('phone')) db.prepare("ALTER TABLE users ADD COLUMN phone TEXT").run();
if (!userColumnNames.includes('bio')) db.prepare("ALTER TABLE users ADD COLUMN bio TEXT").run();
if (!userColumnNames.includes('group_name')) db.prepare("ALTER TABLE users ADD COLUMN group_name TEXT").run();
if (!userColumnNames.includes('study_type')) db.prepare("ALTER TABLE users ADD COLUMN study_type TEXT").run();
if (!userColumnNames.includes('program')) db.prepare("ALTER TABLE users ADD COLUMN program TEXT").run();
if (!userColumnNames.includes('year')) db.prepare("ALTER TABLE users ADD COLUMN year TEXT").run();
if (!userColumnNames.includes('is_confirmed')) db.prepare("ALTER TABLE users ADD COLUMN is_confirmed BOOLEAN DEFAULT 0").run();
if (!userColumnNames.includes('profile_photo')) db.prepare("ALTER TABLE users ADD COLUMN profile_photo TEXT").run();
if (!userColumnNames.includes('email_verified')) db.prepare("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0").run();
if (!userColumnNames.includes('email_verified_shown')) db.prepare("ALTER TABLE users ADD COLUMN email_verified_shown BOOLEAN DEFAULT 0").run();

const classColumns = db.prepare("PRAGMA table_info(classes)").all() as any[];
const classColumnNames = classColumns.map(c => c.name);
if (!classColumnNames.includes('department')) db.prepare("ALTER TABLE classes ADD COLUMN department TEXT").run();
if (!classColumnNames.includes('year')) db.prepare("ALTER TABLE classes ADD COLUMN year TEXT").run();
if (!classColumnNames.includes('group_name')) db.prepare("ALTER TABLE classes ADD COLUMN group_name TEXT").run();
if (!classColumnNames.includes('study_type')) db.prepare("ALTER TABLE classes ADD COLUMN study_type TEXT").run();
if (!classColumnNames.includes('admin_id')) db.prepare("ALTER TABLE classes ADD COLUMN admin_id INTEGER").run();

const studySessionColumns = db.prepare("PRAGMA table_info(study_sessions)").all() as any[];
const studySessionColumnNames = studySessionColumns.map(c => c.name);
if (!studySessionColumnNames.includes('class_id')) db.prepare("ALTER TABLE study_sessions ADD COLUMN class_id INTEGER").run();
if (!studySessionColumnNames.includes('subject')) db.prepare("ALTER TABLE study_sessions ADD COLUMN subject TEXT").run();
if (!studySessionColumnNames.includes('duration')) db.prepare("ALTER TABLE study_sessions ADD COLUMN duration INTEGER").run();

const attendanceColumns = db.prepare("PRAGMA table_info(attendance)").all() as any[];
const attendanceColumnNames = attendanceColumns.map(c => c.name);
if (!attendanceColumnNames.includes('class_id')) db.prepare("ALTER TABLE attendance ADD COLUMN class_id INTEGER").run();
if (!attendanceColumnNames.includes('verified_by_teacher')) db.prepare("ALTER TABLE attendance ADD COLUMN verified_by_teacher BOOLEAN DEFAULT 0").run();

const testAttemptColumns = db.prepare("PRAGMA table_info(test_attempts)").all() as any[];
const testAttemptColumnNames = testAttemptColumns.map(c => c.name);
if (!testAttemptColumnNames.includes('is_exam')) db.prepare("ALTER TABLE test_attempts ADD COLUMN is_exam BOOLEAN DEFAULT 0").run();

const testColumns = db.prepare("PRAGMA table_info(tests)").all() as any[];
const testColumnNames = testColumns.map(c => c.name);
if (!testColumnNames.includes('program')) db.prepare("ALTER TABLE tests ADD COLUMN program TEXT").run();
if (!testColumnNames.includes('year')) db.prepare("ALTER TABLE tests ADD COLUMN year TEXT").run();
if (!testColumnNames.includes('group_name')) db.prepare("ALTER TABLE tests ADD COLUMN group_name TEXT").run();

const attemptColumns = db.prepare("PRAGMA table_info(test_attempts)").all() as any[];
const attemptColumnNames = attemptColumns.map(c => c.name);
if (!attemptColumnNames.includes('grade')) db.prepare("ALTER TABLE test_attempts ADD COLUMN grade INTEGER").run();

const submissionColumns = db.prepare("PRAGMA table_info(submissions)").all() as any[];
const submissionColumnNames = submissionColumns.map(c => c.name);
if (!submissionColumnNames.includes('grade')) db.prepare("ALTER TABLE submissions ADD COLUMN grade INTEGER").run();

const msgColumns = db.prepare("PRAGMA table_info(messages)").all() as any[];
const msgColumnNames = msgColumns.map(c => c.name);
if (!msgColumnNames.includes('chat_type')) db.prepare("ALTER TABLE messages ADD COLUMN chat_type TEXT CHECK(chat_type IN ('PRIVATE', 'CLASS', 'SCHOOL')) DEFAULT 'CLASS'").run();

const scheduleColumns = db.prepare("PRAGMA table_info(schedules)").all() as any[];
const scheduleColumnNames = scheduleColumns.map(c => c.name);
if (!scheduleColumnNames.includes('group_name')) db.prepare("ALTER TABLE schedules ADD COLUMN group_name TEXT").run();

const columns = db.prepare("PRAGMA table_info(assignments)").all() as any[];
const columnNames = columns.map(c => c.name);

if (!columnNames.includes('materials')) {
  db.prepare("ALTER TABLE assignments ADD COLUMN materials TEXT").run();
}
if (!columnNames.includes('max_points')) {
  db.prepare("ALTER TABLE assignments ADD COLUMN max_points INTEGER DEFAULT 100").run();
}
if (!columnNames.includes('submission_type')) {
  db.prepare("ALTER TABLE assignments ADD COLUMN submission_type TEXT CHECK(submission_type IN ('FILE', 'TEXT', 'BOTH')) DEFAULT 'BOTH'").run();
}
if (!columnNames.includes('status')) {
  db.prepare("ALTER TABLE assignments ADD COLUMN status TEXT CHECK(status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')) DEFAULT 'DRAFT'").run();
}
if (!columnNames.includes('program')) db.prepare("ALTER TABLE assignments ADD COLUMN program TEXT").run();
if (!columnNames.includes('year')) db.prepare("ALTER TABLE assignments ADD COLUMN year TEXT").run();
if (!columnNames.includes('group_name')) db.prepare("ALTER TABLE assignments ADD COLUMN group_name TEXT").run();

// Seed Data
const seed = () => {
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  if (userCount.count === 0) {
    const teacherPass = bcrypt.hashSync("mesuesi123", 10);
    const studentPass = bcrypt.hashSync("nxenesi123", 10);

    db.prepare("INSERT INTO users (name, email, password, role, is_confirmed, program, year) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      "Prof. Arben Meta", "arben@fshn.edu.al", teacherPass, "TEACHER", 1, "Informatikë", "Viti 1"
    );
    db.prepare("INSERT INTO users (name, email, password, role, class_code, is_confirmed, program, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      "Studenti Shembull", "student@fshnstudent.info", studentPass, "STUDENT", "FSHN-2026", 1, "Informatikë", "Viti 1"
    );

    db.prepare("INSERT INTO tests (title, description, duration, total_points, teacher_id, status, program, year, test_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "Testi i Parë në Analitikë", "Një vlerësim fillestar i njohurive mbi sistemet analitike.", 30, 100, 1, 'ACTIVE', 'Informatikë', 'Viti 1', '2026-03-10 10:00:00'
    );

    db.prepare("INSERT INTO questions (test_id, content, type, options, points, correct_answer) VALUES (?, ?, ?, ?, ?, ?)").run(
      1, "Cila nga këto është një gjuhë programimi për analitikë?", "MCQ", JSON.stringify(["Python", "HTML", "CSS", "Photoshop"]), 50, "Python"
    );
    db.prepare("INSERT INTO questions (test_id, content, type, points) VALUES (?, ?, ?, ?)").run(
      1, "Shpjegoni rëndësinë e analitikës në biznes.", "OPEN", 50
    );

    db.prepare("INSERT INTO assignments (title, description, deadline, teacher_id) VALUES (?, ?, ?, ?)").run(
      "Detyra e Parë: Analiza e Regresionit", "Krijoni një raport mbi zbatimin e regresionit linear në të dhënat e shitjeve.", "2026-03-15 23:59:59", 1
    );

    db.prepare("INSERT INTO submissions (assignment_id, student_id, content) VALUES (?, ?, ?)").run(
      1, 2, "Këtu është raporti im mbi regresionin linear. Kam përdorur metodën e katrorëve më të vegjël për të parashikuar shitjet e muajit të ardhshëm bazuar në trendet e kaluara."
    );

    // Seed Performance Logs
    const students = db.prepare("SELECT id FROM users WHERE role = 'STUDENT'").all() as any[];
    for (const student of students) {
      db.prepare("INSERT INTO performance_logs (user_id, type, score, max_score, timestamp) VALUES (?, 'TEST', ?, 10, datetime('now', '-10 days'))")
        .run(student.id, 7 + Math.floor(Math.random() * 4));
      db.prepare("INSERT INTO performance_logs (user_id, type, score, max_score, timestamp) VALUES (?, 'ASSIGNMENT', ?, 10, datetime('now', '-5 days'))")
        .run(student.id, 6 + Math.floor(Math.random() * 5));
      db.prepare("INSERT INTO performance_logs (user_id, type, score, max_score, timestamp) VALUES (?, 'TEST', ?, 10, datetime('now', '-2 days'))")
        .run(student.id, 8 + Math.floor(Math.random() * 3));
    }
  }
  // Auto-confirm all existing users for development
  db.prepare("UPDATE users SET is_confirmed = 1").run();
};
try {
  seed();
} catch (e) {
  console.error("Seeding failed:", e);
}
};

// Initialize Database before starting the server
// Removed top-level await for Netlify compatibility
// await initDb();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

app.use((req, res, next) => {
  console.log(`[DEBUG] Incoming Request: ${req.method} ${req.url}`);
  console.log(`[DEBUG] Headers: ${JSON.stringify(req.headers)}`);
  next();
});

app.use(async (req, res, next) => {
  try {
    await initDb();
    next();
  } catch (err) {
    console.error("Failed to initialize database in middleware:", err);
    res.status(500).json({ error: "Database initialization failed" });
  }
});

app.use(cors());
app.use((req, res, next) => {
  // Netlify Functions path handling
  const isNetlifyEnv = getIsNetlify();
  if (isNetlifyEnv) {
    console.log(`[NETLIFY DEBUG] Processing request: ${req.method} ${req.url}`);
    // Log the incoming request for debugging in Netlify logs
    console.log(`[NETLIFY REQ] ${req.method} ${req.url} (Path: ${req.path})`);
    
    // Ensure the URL starts with /api for matching Express routes
    if (!req.url.startsWith('/api') && !req.url.startsWith('/.netlify')) {
      const isStaticFile = req.url.split('?')[0].split('/').pop()?.includes('.');
      if (!isStaticFile) {
        const oldUrl = req.url;
        req.url = '/api' + (req.url.startsWith('/') ? '' : '/') + req.url;
        console.log(`[NETLIFY PATH REWRITE] ${oldUrl} -> ${req.url}`);
      }
    }
  }
  next();
});

app.use(express.json());

// Ensure uploads directory exists
const uploadDir = getIsVercel() ? path.join("/tmp", "uploads") : path.join(_dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage });

app.use("/uploads", express.static(uploadDir));

app.get("/api/health", (req, res) => {
  console.log("Health check request received");
  res.json({ status: "ok", database: db?.name || 'mock' });
});

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Pa autorizuar" });
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch (err) {
      res.status(401).json({ error: "Token i pavlefshëm" });
    }
  };

  // Auth Routes
  app.get("/api/auth/check-class-admin", (req, res) => {
    const { program, year, study_type, group_name } = req.query;
    const classroom = db.prepare("SELECT admin_id FROM classes WHERE department = ? AND year = ? AND study_type = ? AND group_name = ?")
      .get(program, year, study_type, group_name) as any;
    
    res.json({ hasAdmin: !!(classroom && classroom.admin_id) });
  });

  app.post("/api/auth/register", async (req, res) => {
    const { name, surname, email, password, role, program, year, group_name, study_type, phone, is_president } = req.body;
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const logoUrl = "https://i.ibb.co/LdsTzhWj/IMG-3202.png";

    if (firestore) {
      try {
        const usersRef = firestore.collection('users');
        const userSnap = await usersRef.where('email', '==', email).get();
        if (!userSnap.empty) return res.status(400).json({ error: "Ky email është i regjistruar" });

        const userDoc = usersRef.doc();
        const userId = userDoc.id;
        let isConfirmed = 0;

        const batch = firestore.batch();
        
        if (role === 'STUDENT') {
          const classesRef = firestore.collection('classes');
          const classSnap = await classesRef
            .where('department', '==', program)
            .where('year', '==', year)
            .where('group_name', '==', group_name)
            .where('study_type', '==', study_type)
            .get();

          let classId;
          if (classSnap.empty) {
            const classDoc = classesRef.doc();
            classId = classDoc.id;
            const classCode = `CLASS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            batch.set(classDoc, {
              id: classId,
              name: `${program} - ${year}`,
              code: classCode,
              department: program,
              year,
              group_name,
              study_type,
              admin_id: is_president ? userId : null
            });

            if (is_president) {
              isConfirmed = 1;
              batch.set(firestore.collection('class_members').doc(), {
                class_id: classId,
                user_id: userId,
                status: 'CONFIRMED',
                is_admin: 1,
                joined_at: admin.firestore.FieldValue.serverTimestamp()
              });
            } else {
              batch.set(firestore.collection('class_members').doc(), {
                class_id: classId,
                user_id: userId,
                status: 'PENDING',
                joined_at: admin.firestore.FieldValue.serverTimestamp()
              });
            }
          } else {
            const classroom = classSnap.docs[0].data();
            classId = classroom.id;
            if (is_president && !classroom.admin_id) {
              isConfirmed = 1;
              batch.update(classesRef.doc(classId), { admin_id: userId });
              batch.set(firestore.collection('class_members').doc(), {
                class_id: classId,
                user_id: userId,
                status: 'CONFIRMED',
                is_admin: 1,
                joined_at: admin.firestore.FieldValue.serverTimestamp()
              });
            } else {
              batch.set(firestore.collection('class_members').doc(), {
                class_id: classId,
                user_id: userId,
                status: 'PENDING',
                joined_at: admin.firestore.FieldValue.serverTimestamp()
              });
            }
          }
        } else {
          isConfirmed = 1;
        }

        batch.set(userDoc, {
          id: userId,
          name, surname, email, password: hashedPassword, role, program, year, group_name, study_type, phone,
          is_confirmed: isConfirmed,
          profile_photo: logoUrl,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        res.json({ message: "Regjistrimi u krye me sukses" });
      } catch (e: any) {
        console.error("Firestore Register Error:", e);
        res.status(500).json({ error: "Gabim gjatë regjistrimit në Firebase" });
      }
      return;
    }

    try {
      db.transaction(() => {
        const info = db.prepare("INSERT INTO users (name, surname, email, password, role, program, year, group_name, study_type, phone, is_confirmed, profile_photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(name, surname, email, hashedPassword, role, program, year, group_name, study_type, phone, 0, logoUrl);
        
        const userId = info.lastInsertRowid;

        if (role === 'STUDENT') {
          // Find or create class
          let classroom = db.prepare("SELECT id, admin_id FROM classes WHERE department = ? AND year = ? AND group_name = ? AND study_type = ?")
            .get(program, year, group_name, study_type) as any;
          
          if (!classroom) {
            // Create class
            const classCode = `CLASS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            const classInfo = db.prepare("INSERT INTO classes (name, code, department, year, group_name, study_type, admin_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
              .run(`${program} - ${year}`, classCode, program, year, group_name, study_type, is_president ? userId : null);
            
            classroom = { id: classInfo.lastInsertRowid, admin_id: is_president ? userId : null };
            
            if (is_president) {
              db.prepare("UPDATE users SET is_confirmed = 1 WHERE id = ?").run(userId);
              db.prepare("INSERT INTO class_members (class_id, user_id, status, is_admin) VALUES (?, ?, 'CONFIRMED', 1)")
                .run(classroom.id, userId);
            } else {
              db.prepare("INSERT INTO class_members (class_id, user_id, status) VALUES (?, ?, 'PENDING')")
                .run(classroom.id, userId);
            }
          } else {
            // Class exists
            if (is_president && !classroom.admin_id) {
              // Set as admin if none exists
              db.prepare("UPDATE classes SET admin_id = ? WHERE id = ?").run(userId, classroom.id);
              db.prepare("UPDATE users SET is_confirmed = 1 WHERE id = ?").run(userId);
              db.prepare("INSERT INTO class_members (class_id, user_id, status, is_admin) VALUES (?, ?, 'CONFIRMED', 1)")
                .run(classroom.id, userId);
            } else {
              // Join as pending
              db.prepare("INSERT INTO class_members (class_id, user_id, status) VALUES (?, ?, 'PENDING')")
                .run(classroom.id, userId);
            }
          }
        } else {
          db.prepare("UPDATE users SET is_confirmed = 1 WHERE id = ?").run(userId);
        }
      })();
      res.json({ success: true });
    } catch (err: any) {
      console.error("Register error:", err);
      res.status(400).json({ error: "Email-i ekziston ose të dhëna të gabuara" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    console.log(`[LOGIN] Request received for: ${email}`);

    if (firestore) {
      try {
        const userSnap = await firestore.collection('users').where('email', '==', email).get();
        if (userSnap.empty) return res.status(401).json({ error: "Email ose fjalëkalim i gabuar" });
        
        const userDoc = userSnap.docs[0];
        const user = userDoc.data();
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: "Email ose fjalëkalim i gabuar" });

        // Get class status
        const memberSnap = await firestore.collection('class_members').where('user_id', '==', user.id).get();
        const member = memberSnap.empty ? null : memberSnap.docs[0].data();

        const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET);
        res.json({ 
          token, 
          user: { 
            ...user, 
            class_status: member?.status, 
            is_class_admin: member?.is_admin 
          } 
        });
      } catch (e) {
        console.error("Firestore Login Error:", e);
        res.status(500).json({ error: "Gabim gjatë hyrjes në Firebase" });
      }
      return;
    }

    try {
      console.log("Login attempt for:", email);
      const userDetails = db.prepare(`
        SELECT u.*, cm.status as class_status, cm.is_admin as is_class_admin
        FROM users u
        LEFT JOIN class_members cm ON u.id = cm.user_id
        WHERE u.email = ?
      `).get(email) as any;

      if (!userDetails) {
        console.log("User not found:", email);
        return res.status(401).json({ error: "Kredenciale të gabuara" });
      }
      
      const isMatch = await bcrypt.compare(password, userDetails.password);
      if (!isMatch) {
        console.log("Invalid password for:", email);
        return res.status(401).json({ error: "Kredenciale të gabuara" });
      }
      
      const token = jwt.sign({ id: userDetails.id, role: userDetails.role, name: userDetails.name }, JWT_SECRET);
      console.log("Login successful for:", email);
      res.json({ 
        token, 
        user: { 
          id: userDetails.id, 
          name: userDetails.name, 
          surname: userDetails.surname,
          role: userDetails.role, 
          email: userDetails.email, 
          program: userDetails.program, 
          year: userDetails.year,
          group_name: userDetails.group_name,
          study_type: userDetails.study_type,
          phone: userDetails.phone,
          profile_photo: userDetails.profile_photo,
          is_confirmed: userDetails.is_confirmed,
          email_verified: userDetails.email_verified,
          class_status: userDetails.class_status,
          is_class_admin: userDetails.is_class_admin
        } 
      });
    } catch (err: any) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Gabim i brendshëm i serverit: " + err.message });
    }
  });

  app.post("/api/auth/firebase", async (req, res) => {
    const { email, name, uid } = req.body;

    if (firestore) {
      try {
        const userSnap = await firestore.collection('users').where('email', '==', email).get();
        if (userSnap.empty) {
          return res.status(404).json({ 
            error: "Llogaria nuk u gjet. Ju lutem regjistrohuni më parë duke zgjedhur degën dhe vitin tuaj.",
            email: email,
            name: name
          });
        }
        
        const user = userSnap.docs[0].data();
        const memberSnap = await firestore.collection('class_members').where('user_id', '==', user.id).get();
        const member = memberSnap.empty ? null : memberSnap.docs[0].data();

        const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET);
        res.json({ 
          token, 
          user: { 
            ...user, 
            class_status: member?.status, 
            is_class_admin: member?.is_admin 
          } 
        });
      } catch (e) {
        console.error("Firestore Firebase Auth Error:", e);
        res.status(500).json({ error: "Gabim gjatë hyrjes me Firebase" });
      }
      return;
    }

    try {
      // Check if user exists
      const userDetails = db.prepare(`
        SELECT u.*, cm.status as class_status, cm.is_admin as is_class_admin
        FROM users u
        LEFT JOIN class_members cm ON u.id = cm.user_id
        WHERE u.email = ?
      `).get(email) as any;
      
      if (!userDetails) {
        return res.status(404).json({ 
          error: "Llogaria nuk u gjet. Ju lutem regjistrohuni më parë duke zgjedhur degën dhe vitin tuaj.",
          email: email,
          name: name
        });
      }

      const token = jwt.sign({ id: userDetails.id, role: userDetails.role, name: userDetails.name }, JWT_SECRET);
      res.json({ 
        token, 
        user: { 
          id: userDetails.id, 
          name: userDetails.name, 
          surname: userDetails.surname,
          role: userDetails.role, 
          email: userDetails.email, 
          program: userDetails.program, 
          year: userDetails.year,
          group_name: userDetails.group_name,
          study_type: userDetails.study_type,
          phone: userDetails.phone,
          profile_photo: userDetails.profile_photo,
          is_confirmed: userDetails.is_confirmed,
          email_verified: userDetails.email_verified,
          class_status: userDetails.class_status,
          is_class_admin: userDetails.is_class_admin
        } 
      });
    } catch (err: any) {
      console.error("Firebase Auth Error:", err);
      res.status(500).json({ error: "Gabim gjatë autentikimit me Firebase: " + err.message });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      
      if (!user) {
        // We don't want to reveal if a user exists or not for security
        return res.json({ message: "Nëse ky email ekziston, një link për rivendosjen e fjalëkalimit është dërguar." });
      }

      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

      db.prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)").run(email, token, expiresAt);

      // Email configuration
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Rivendosja e Fjalëkalimit - FSHN Student',
        text: `Përshëndetje ${user.name},\n\nJu keni kërkuar të rivendosni fjalëkalimin tuaj. Ju lutem klikoni në linkun e mëposhtëm për të vazhduar:\n\n${resetUrl}\n\nKy link do të skadojë pas 1 ore.\n\nNëse nuk e keni kërkuar këtë, ju lutem injoroni këtë email.`
      };

      // If no credentials, just log the token for development
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log("--- MOCK EMAIL SENT ---");
        console.log("To:", email);
        console.log("Reset URL:", resetUrl);
        console.log("-----------------------");
      } else {
        await transporter.sendMail(mailOptions);
      }

      res.json({ message: "Nëse ky email ekziston, një link për rivendosjen e fjalëkalimit është dërguar." });
    } catch (err: any) {
      console.error("Forgot password error:", err);
      res.status(500).json({ error: "Gabim i brendshëm: " + err.message });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      const resetRequest: any = db.prepare("SELECT * FROM password_resets WHERE token = ? AND expires_at > ?").get(token, new Date().toISOString());

      if (!resetRequest) {
        return res.status(400).json({ error: "Token i pavlefshëm ose i skaduar" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      db.prepare("UPDATE users SET password = ? WHERE email = ?").run(hashedPassword, resetRequest.email);
      db.prepare("DELETE FROM password_resets WHERE email = ?").run(resetRequest.email);

      res.json({ message: "Fjalëkalimi u ndryshua me sukses" });
    } catch (err: any) {
      console.error("Reset password error:", err);
      res.status(500).json({ error: "Gabim i brendshëm: " + err.message });
    }
  });

  // Teacher confirmation routes
  app.get("/api/teacher/pending-students", authenticate, (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const students = db.prepare("SELECT id, name, email, program, year FROM users WHERE role = 'STUDENT' AND is_confirmed = 0").all();
    res.json(students);
  });

  app.post("/api/teacher/confirm-student", authenticate, (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { studentId } = req.body;
    db.prepare("UPDATE users SET is_confirmed = 1 WHERE id = ?").run(studentId);
    res.json({ success: true });
  });

  // Admin & Approval Routes
  app.get("/api/admin/pending-members", authenticate, (req: any, res) => {
    // Check if user is admin of any class
    const adminClasses = db.prepare("SELECT id FROM classes WHERE admin_id = ?").all(req.user.id) as any[];
    if (adminClasses.length === 0) return res.json([]);

    const classIds = adminClasses.map(c => c.id);
    
    // Chunk classIds to avoid "Too many parameter values" error (limit is 999)
    const chunkSize = 900;
    let pending: any[] = [];
    
    for (let i = 0; i < classIds.length; i += chunkSize) {
      const chunk = classIds.slice(i, i + chunkSize);
      const chunkPending = db.prepare(`
        SELECT cm.*, u.name, u.surname, u.email, c.name as class_name
        FROM class_members cm
        JOIN users u ON cm.user_id = u.id
        JOIN classes c ON cm.class_id = c.id
        WHERE cm.class_id IN (${chunk.map(() => '?').join(',')}) AND cm.status = 'PENDING'
      `).all(...chunk);
      pending = pending.concat(chunkPending);
    }
    
    res.json(pending);
  });

  app.post("/api/admin/approve-member", authenticate, (req: any, res) => {
    const { memberId, status } = req.body; // status: 'CONFIRMED' or 'REFUSED'
    const member = db.prepare("SELECT * FROM class_members WHERE id = ?").get(memberId) as any;
    if (!member) return res.status(404).json({ error: "Anëtari nuk u gjet" });

    // Check if requester is admin of this class
    const classroom = db.prepare("SELECT admin_id FROM classes WHERE id = ?").get(member.class_id) as any;
    if (classroom.admin_id !== req.user.id) return res.status(403).json({ error: "Pa autorizuar" });

    db.transaction(() => {
      db.prepare("UPDATE class_members SET status = ? WHERE id = ?").run(status, memberId);
      if (status === 'CONFIRMED') {
        db.prepare("UPDATE users SET is_confirmed = 1 WHERE id = ?").run(member.user_id);
      }
    })();

    res.json({ success: true });
  });

  app.post("/api/student/change-classroom", authenticate, (req: any, res) => {
    const { program, year, group_name, study_type } = req.body;
    
    db.transaction(() => {
      // Remove from old class
      db.prepare("DELETE FROM class_members WHERE user_id = ?").run(req.user.id);
      
      // Update user info
      db.prepare("UPDATE users SET program = ?, year = ?, group_name = ?, study_type = ?, is_confirmed = 0 WHERE id = ?")
        .run(program, year, group_name, study_type, req.user.id);
      
      // Join new class
      let classroom = db.prepare("SELECT id FROM classes WHERE department = ? AND year = ? AND group_name = ? AND study_type = ?")
        .get(program, year, group_name, study_type) as any;
      
      if (!classroom) {
        const classCode = `CLASS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const classInfo = db.prepare("INSERT INTO classes (name, code, department, year, group_name, study_type, admin_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(`${program} - ${year}`, classCode, program, year, group_name, study_type, req.user.id);
        
        classroom = { id: classInfo.lastInsertRowid };
        db.prepare("UPDATE users SET is_confirmed = 1 WHERE id = ?").run(req.user.id);
        db.prepare("INSERT INTO class_members (class_id, user_id, status, is_admin) VALUES (?, ?, 'CONFIRMED', 1)")
          .run(classroom.id, req.user.id);
      } else {
        db.prepare("INSERT INTO class_members (class_id, user_id, status) VALUES (?, ?, 'PENDING')")
          .run(classroom.id, req.user.id);
      }
    })();
    
    res.json({ success: true });
  });

  // Lecture Status Routes
  app.get("/api/teacher/current-lecture", authenticate, (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    
    const now = new Date();
    const day = now.getDay(); // 0-6 (Sun-Sat)
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const current = db.prepare(`
      SELECT ts.*, c.name as class_name, ls.status as current_status
      FROM teacher_schedule ts
      JOIN classes c ON ts.class_id = c.id
      LEFT JOIN lecture_status ls ON ts.id = ls.schedule_id AND date(ls.updated_at) = date('now')
      WHERE ts.teacher_id = ? AND ts.day_of_week = ? AND ts.start_time <= ? AND ts.end_time >= ?
    `).get(req.user.id, day, time, time) as any;
    
    res.json(current || null);
  });

  app.post("/api/teacher/lecture-status", authenticate, (req: any, res) => {
    const { scheduleId, status } = req.body;
    
    const existing = db.prepare("SELECT id FROM lecture_status WHERE schedule_id = ? AND date(updated_at) = date('now')").get(scheduleId) as any;
    
    if (existing) {
      db.prepare("UPDATE lecture_status SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, existing.id);
    } else {
      db.prepare("INSERT INTO lecture_status (schedule_id, status) VALUES (?, ?)").run(scheduleId, status);
    }
    
    res.json({ success: true });
  });

  app.get("/api/student/class-status", authenticate, (req: any, res) => {
    const user = db.prepare("SELECT program, year, group_name, study_type FROM users WHERE id = ?").get(req.user.id) as any;
    if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });
    const classroom = db.prepare("SELECT id FROM classes WHERE department = ? AND year = ? AND group_name = ? AND study_type = ?")
      .get(user.program, user.year, user.group_name, user.study_type) as any;
    
    if (!classroom) return res.json(null);

    const now = new Date();
    const day = now.getDay();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const lecture = db.prepare(`
      SELECT ts.*, u.name as teacher_name, ls.status
      FROM teacher_schedule ts
      JOIN users u ON ts.teacher_id = u.id
      LEFT JOIN lecture_status ls ON ts.id = ls.schedule_id AND date(ls.updated_at) = date('now')
      WHERE ts.class_id = ? AND ts.day_of_week = ? AND ts.start_time <= ? AND ts.end_time >= ?
    `).get(classroom.id, day, time, time) as any;

    res.json(lecture || null);
  });
  app.post("/api/user/profile", authenticate, async (req: any, res) => {
    const { name, surname, phone, bio, group_name, study_type } = req.body;
    if (firestore) {
      try {
        await firestore.collection('users').doc(req.user.id.toString()).update({
          name, surname, phone, bio, group_name, study_type
        });
        const userSnap = await firestore.collection('users').doc(req.user.id.toString()).get();
        const user = userSnap.data();
        if (user) delete user.password;
        return res.json(user);
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    try {
      db.prepare(`
        UPDATE users 
        SET name = ?, surname = ?, phone = ?, bio = ?, group_name = ?, study_type = ? 
        WHERE id = ?
      `).run(name, surname, phone, bio, group_name, study_type, req.user.id);
      
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id) as any;
      delete user.password;
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/user/verify-email", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        await firestore.collection('users').doc(req.user.id.toString()).update({ email_verified: 1 });
        return res.json({ success: true, message: "Emaili u verifikua me sukses!" });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    try {
      db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(req.user.id);
      res.json({ success: true, message: "Emaili u verifikua me sukses!" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/classes", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const classSnap = await firestore.collection('classes').get();
        return res.json(classSnap.docs.map(doc => doc.data()));
      } catch (err) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    try {
      const classes = db.prepare("SELECT * FROM classes").all();
      res.json(classes);
    } catch (err) {
      res.status(500).json({ error: "Gabim gjatë marrjes së klasave" });
    }
  });

  app.get("/api/class/members", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const userSnap = await firestore.collection('users').doc(req.user.id).get();
        const user = userSnap.data();
        if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });

        const membersSnap = await firestore.collection('users')
          .where('program', '==', user.program)
          .where('year', '==', user.year)
          .where('group_name', '==', user.group_name)
          .where('study_type', '==', user.study_type)
          .get();

        const members = membersSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: data.id,
            name: data.name,
            surname: data.surname,
            role: data.role,
            profile_photo: data.profile_photo
          };
        });

        const onlineUserIds = new Set(Array.from(onlineUsers.values()).map((u: any) => u.id));
        const membersWithStatus = members.map(m => ({
          ...m,
          isOnline: onlineUserIds.has(m.id)
        }));

        return res.json(membersWithStatus);
      } catch (err) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    try {
      const user = db.prepare("SELECT program, year, group_name, study_type FROM users WHERE id = ?").get(req.user.id) as any;
      if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });

      const members = db.prepare(`
        SELECT id, name, surname, role, profile_photo 
        FROM users 
        WHERE program = ? AND year = ? AND group_name = ? AND study_type = ?
      `).all(user.program, user.year, user.group_name, user.study_type) as any[];

      // Add online status
      const onlineUserIds = new Set(Array.from(onlineUsers.values()).map((u: any) => u.id));
      const membersWithStatus = members.map(m => ({
        ...m,
        isOnline: onlineUserIds.has(m.id)
      }));

      res.json(membersWithStatus);
    } catch (err) {
      res.status(500).json({ error: "Gabim gjatë marrjes së anëtarëve të klasës" });
    }
  });

  app.get("/api/user/me", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const userSnap = await firestore.collection('users').doc(req.user.id.toString()).get();
        const user = userSnap.data();
        if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });

        const memberSnap = await firestore.collection('class_members').where('user_id', '==', user.id).get();
        const member = memberSnap.empty ? null : memberSnap.docs[0].data();

        return res.json({
          ...user,
          class_status: member?.status,
          is_class_admin: member?.is_admin
        });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    const user = db.prepare(`
      SELECT u.id, u.name, u.surname, u.email, u.role, u.class_code, u.program, u.year, u.group_name, u.study_type, u.phone, u.bio, u.profile_photo, u.is_confirmed, u.email_verified,
             cm.status as class_status, cm.is_admin as is_class_admin
      FROM users u
      LEFT JOIN class_members cm ON u.id = cm.user_id
      WHERE u.id = ?
    `).get(req.user.id) as any;
    res.json(user);
  });

  app.post("/api/user/profile-photo", authenticate, upload.single('photo'), async (req: any, res) => {
    if (!req.file) return res.status(400).json({ error: "Nuk u ngarkua asnjë foto" });
    const photoPath = `/uploads/${req.file.filename}`;
    if (firestore) {
      try {
        await firestore.collection('users').doc(req.user.id.toString()).update({ profile_photo: photoPath });
        return res.json({ photoPath });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    db.prepare("UPDATE users SET profile_photo = ? WHERE id = ?").run(photoPath, req.user.id);
    res.json({ photoPath });
  });

  // Study Sessions
  const activeTimeouts = new Map<number, NodeJS.Timeout>();

  app.post("/api/study/start", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { classId, subject, duration } = req.body;
    
    if (firestore) {
      try {
        // Close previous sessions
        const prevSessions = await firestore.collection('study_sessions')
          .where('teacher_id', '==', req.user.id)
          .where('status', '==', 'ACTIVE')
          .get();
        
        const batch = firestore.batch();
        prevSessions.forEach(doc => batch.update(doc.ref, { status: 'COMPLETED' }));
        
        const sessionRef = firestore.collection('study_sessions').doc();
        const sessionId = sessionRef.id;
        batch.set(sessionRef, {
          id: sessionId,
          teacher_id: req.user.id,
          class_id: classId,
          subject,
          duration,
          status: 'ACTIVE',
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        await batch.commit();
        io.emit("study_session_start", { sessionId, classId, subject, duration, teacherName: req.user.name });
        
        // Timeout logic (limited on serverless)
        setTimeout(async () => {
          try {
            await firestore.collection('study_sessions').doc(sessionId).update({ status: 'COMPLETED' });
            io.emit("study_session_end", { sessionId, auto: true });
          } catch (e) {}
        }, duration * 60 * 1000);

        return res.json({ sessionId });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    // Close any previous active sessions for this teacher
    db.prepare("UPDATE study_sessions SET status = 'COMPLETED' WHERE teacher_id = ? AND status = 'ACTIVE'").run(req.user.id);
    
    const info = db.prepare("INSERT INTO study_sessions (teacher_id, class_id, subject, duration) VALUES (?, ?, ?, ?)").run(req.user.id, classId, subject, duration);
    const sessionId = info.lastInsertRowid as number;
    
    io.emit("study_session_start", { sessionId, classId, subject, duration, teacherName: req.user.name });
    
    // Set timeouts for notifications and auto-close
    if (duration > 5) {
      const warningTime = (duration - 5) * 60 * 1000;
      const warningTimeout = setTimeout(() => {
        io.emit("study_session_warning", { sessionId, message: "Ora po përfundon në 5 minuta" });
      }, warningTime);
      activeTimeouts.set(sessionId * 10 + 1, warningTimeout);
    }
    
    const closeTimeout = setTimeout(() => {
      db.prepare("UPDATE study_sessions SET status = 'COMPLETED' WHERE id = ?").run(sessionId);
      io.emit("study_session_end", { sessionId, auto: true });
    }, duration * 60 * 1000);
    activeTimeouts.set(sessionId * 10 + 2, closeTimeout);

    res.json({ sessionId });
  });

  app.post("/api/study/end", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { sessionId } = req.body;
    
    if (firestore) {
      try {
        await firestore.collection('study_sessions').doc(sessionId.toString()).update({ status: 'COMPLETED' });
        io.emit("study_session_end", { sessionId, auto: false });
        return res.json({ success: true });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    db.prepare("UPDATE study_sessions SET status = 'COMPLETED' WHERE id = ?").run(sessionId);
    
    // Clear timeouts
    const t1 = activeTimeouts.get(sessionId * 10 + 1);
    const t2 = activeTimeouts.get(sessionId * 10 + 2);
    if (t1) clearTimeout(t1);
    if (t2) clearTimeout(t2);
    activeTimeouts.delete(sessionId * 10 + 1);
    activeTimeouts.delete(sessionId * 10 + 2);
    
    io.emit("study_session_end", { sessionId, auto: false });
    res.json({ success: true });
  });

  app.post("/api/user/mark-verified-shown", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        await firestore.collection('users').doc(req.user.id.toString()).update({ email_verified_shown: 1 });
        return res.json({ success: true });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    db.prepare("UPDATE users SET email_verified_shown = 1 WHERE id = ?").run(req.user.id);
    res.json({ success: true });
  });

  app.post("/api/study/confirm", authenticate, async (req: any, res) => {
    const { sessionId } = req.body;
    if (firestore) {
      try {
        await firestore.collection('session_presence').add({
          session_id: sessionId,
          user_id: req.user.id,
          is_verified: 0,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        io.emit("presence_confirmed", { sessionId, userId: req.user.id, userName: req.user.name });
        return res.json({ success: true });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    db.prepare("INSERT INTO session_presence (session_id, user_id) VALUES (?, ?)").run(sessionId, req.user.id);
    io.emit("presence_confirmed", { sessionId, userId: req.user.id, userName: req.user.name });
    res.json({ success: true });
  });

  app.post("/api/study/verify", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { sessionId, userId } = req.body;
    
    if (firestore) {
      try {
        const snap = await firestore.collection('session_presence')
          .where('session_id', '==', sessionId)
          .where('user_id', '==', userId)
          .get();
        
        const batch = firestore.batch();
        snap.forEach(doc => batch.update(doc.ref, { is_verified: 1 }));
        
        batch.set(firestore.collection('attendance').doc(), {
          user_id: userId,
          status: 'PRESENT',
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        await batch.commit();
        io.emit("presence_verified", { sessionId, userId });
        return res.json({ success: true });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    db.prepare("UPDATE session_presence SET is_verified = 1 WHERE session_id = ? AND user_id = ?").run(sessionId, userId);
    
    // Log to attendance
    db.prepare("INSERT INTO attendance (user_id, status) VALUES (?, 'PRESENT')").run(userId);
    
    io.emit("presence_verified", { sessionId, userId });
    res.json({ success: true });
  });

  app.get("/api/study/active", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        let session;
        if (req.user.role === 'TEACHER') {
          const snap = await firestore.collection('study_sessions')
            .where('status', '==', 'ACTIVE')
            .where('teacher_id', '==', req.user.id)
            .get();
          
          const sessions = snap.docs.map(doc => doc.data());
          sessions.sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
          session = sessions.length > 0 ? sessions[0] : null;
        } else {
          const memberSnap = await firestore.collection('class_members')
            .where('user_id', '==', req.user.id)
            .where('status', '==', 'CONFIRMED')
            .get();
          
          if (memberSnap.empty) return res.json(null);
          const classId = memberSnap.docs[0].data().class_id;
          
          const snap = await firestore.collection('study_sessions')
            .where('status', '==', 'ACTIVE')
            .where('class_id', '==', classId)
            .get();
          
          const sessions = snap.docs.map(doc => doc.data());
          sessions.sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
          
          if (sessions.length > 0) {
            session = sessions[0];
            const teacherSnap = await firestore.collection('users').doc(session.teacher_id.toString()).get();
            session.teacherName = teacherSnap.data()?.name;
          }
        }

        if (!session) return res.json(null);

        const presenceSnap = await firestore.collection('session_presence')
          .where('session_id', '==', session.id)
          .get();
        
        const presence = await Promise.all(presenceSnap.docs.map(async doc => {
          const data = doc.data();
          const uSnap = await firestore.collection('users').doc(data.user_id.toString()).get();
          return { ...data, userName: uSnap.data()?.name };
        }));

        return res.json({ ...session, presence });
      } catch (e) {
        console.error("Firestore Active Study Error:", e);
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    let session;
    if (req.user.role === 'TEACHER') {
      session = db.prepare("SELECT * FROM study_sessions WHERE status = 'ACTIVE' AND teacher_id = ? ORDER BY created_at DESC LIMIT 1").get(req.user.id);
    } else {
      // Find active session for the student's class
      session = db.prepare(`
        SELECT ss.*, u.name as teacherName 
        FROM study_sessions ss
        JOIN users u ON ss.teacher_id = u.id
        JOIN class_members cm ON ss.class_id = cm.class_id
        WHERE ss.status = 'ACTIVE' AND cm.user_id = ? AND cm.status = 'CONFIRMED'
        ORDER BY ss.created_at DESC LIMIT 1
      `).get(req.user.id);
    }
    
    if (!session) return res.json(null);
    
    const presence = db.prepare(`
      SELECT sp.*, u.name as userName 
      FROM session_presence sp 
      JOIN users u ON sp.user_id = u.id 
      WHERE sp.session_id = ?
    `).all(session.id);
    
    res.json({ ...session, presence });
  });

  app.get("/api/attendance/stats", authenticate, (req: any, res) => {
    const stats = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM attendance 
      WHERE user_id = ? 
      GROUP BY status
    `).all(req.user.id);
    res.json(stats);
  });

  // Tests
  app.get("/api/tests", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        let tests;
        if (req.user.role === 'TEACHER') {
          const snap = await firestore.collection('tests')
            .where('teacher_id', '==', req.user.id)
            .get();
          tests = snap.docs.map(doc => doc.data());
          tests.sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
        } else {
          const snap = await firestore.collection('tests')
            .where('status', 'in', ['ACTIVE', 'IN_PROGRESS', 'PUBLISHED'])
            .where('program', '==', req.user.program)
            .where('year', '==', req.user.year)
            .where('group_name', '==', req.user.group_name)
            .get();
          tests = snap.docs.map(doc => doc.data());
          tests.sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
        }
        return res.json(tests);
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    let tests;
    if (req.user.role === 'TEACHER') {
      tests = db.prepare("SELECT * FROM tests WHERE teacher_id = ? ORDER BY created_at DESC").all(req.user.id);
    } else {
      tests = db.prepare("SELECT * FROM tests WHERE status IN ('ACTIVE', 'IN_PROGRESS', 'PUBLISHED') AND program = ? AND year = ? AND group_name = ? ORDER BY created_at DESC")
        .all(req.user.program, req.user.year, req.user.group_name);
    }
    res.json(tests);
  });

  app.post("/api/tests", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të krijojnë teste" });
    const { title, description, duration, totalPoints, testDate, program, year, group_name } = req.body;
    
    if (firestore) {
      try {
        const testRef = firestore.collection('tests').doc();
        const testId = testRef.id;
        const testData = {
          id: testId,
          title, description, duration, total_points: totalPoints,
          teacher_id: req.user.id,
          test_date: testDate,
          program, year, group_name,
          status: 'DRAFT',
          created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await testRef.set(testData);
        
        // Notifications
        const studentsSnap = await firestore.collection('users')
          .where('role', '==', 'STUDENT')
          .where('program', '==', program)
          .where('year', '==', year)
          .where('group_name', '==', group_name)
          .get();
        
        const batch = firestore.batch();
        studentsSnap.forEach(doc => {
          batch.set(firestore.collection('notifications').doc(), {
            user_id: doc.id,
            title: "Test i Ri: " + title,
            content: `Mësuesi ${req.user.name} ka caktuar një test për datën ${testDate}.`,
            type: 'TEST',
            created_at: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        await batch.commit();

        return res.json({ id: testId });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    const info = db.prepare("INSERT INTO tests (title, description, duration, total_points, teacher_id, test_date, program, year, group_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')")
      .run(title, description, duration, totalPoints, req.user.id, testDate, program, year, group_name);
    
    // Notify students of this program, year and group
    const students = db.prepare("SELECT id FROM users WHERE role = 'STUDENT' AND program = ? AND year = ? AND group_name = ?").all(program, year, group_name) as any[];
    for (const student of students) {
      db.prepare("INSERT INTO notifications (user_id, title, content, type) VALUES (?, ?, ?, 'TEST')")
        .run(student.id, "Test i Ri: " + title, `Mësuesi ${req.user.name} ka caktuar një test për datën ${testDate}.`, 'TEST');
    }

    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/tests/:id/status", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të ndryshojnë statusin" });
    const { status } = req.body;
    
    if (firestore) {
      try {
        await firestore.collection('tests').doc(req.params.id).update({ status });
        if (status === 'ACTIVE') {
          io.emit("test_distributed", { testId: req.params.id, title: "Test i ri u shpërnda!" });
        }
        return res.json({ success: true });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    db.prepare("UPDATE tests SET status = ? WHERE id = ?").run(status, req.params.id);
    
    if (status === 'ACTIVE') {
      io.emit("test_distributed", { testId: req.params.id, title: "Test i ri u shpërnda!" });
    }
    
    res.json({ success: true });
  });

  app.get("/api/tests/:id", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const doc = await firestore.collection('tests').doc(req.params.id).get();
        return res.json(doc.data());
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    const test = db.prepare("SELECT * FROM tests WHERE id = ?").get(req.params.id);
    res.json(test);
  });

  // Questions
  app.get("/api/tests/:id/questions", authenticate, async (req, res) => {
    if (firestore) {
      try {
        const snap = await firestore.collection('questions').where('test_id', '==', req.params.id).get();
        const questions = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            content: data.content,
            type: data.type,
            options: typeof data.options === 'string' ? JSON.parse(data.options) : data.options,
            points: data.points,
            correct_answer: data.correct_answer
          };
        });
        return res.json(questions);
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    const questions = db.prepare("SELECT id, content, type, options, points, correct_answer FROM questions WHERE test_id = ?").all(req.params.id);
    res.json(questions);
  });

  app.post("/api/tests/:id/questions", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të shtojnë pyetje" });
    const { content, type, options, points, correct_answer } = req.body;
    
    if (firestore) {
      try {
        const qRef = firestore.collection('questions').doc();
        await qRef.set({
          id: qRef.id,
          test_id: req.params.id,
          content, type,
          options: options ? JSON.stringify(options) : null,
          points, correct_answer
        });
        return res.json({ id: qRef.id });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    const info = db.prepare("INSERT INTO questions (test_id, content, type, options, points, correct_answer) VALUES (?, ?, ?, ?, ?, ?)")
      .run(req.params.id, content, type, options ? JSON.stringify(options) : null, points, correct_answer);
    res.json({ id: info.lastInsertRowid });
  });

  // Test Attempts & Participation
  app.post("/api/tests/:id/join", authenticate, async (req: any, res) => {
    if (req.user.role !== 'STUDENT') return res.status(403).json({ error: "Vetëm studentët mund të hyjnë në test" });
    
    if (firestore) {
      try {
        const snap = await firestore.collection('test_attempts')
          .where('test_id', '==', req.params.id)
          .where('user_id', '==', req.user.id)
          .get();
        
        if (!snap.empty) return res.json(snap.docs[0].data());

        const attemptRef = firestore.collection('test_attempts').doc();
        const attemptData = {
          id: attemptRef.id,
          test_id: req.params.id,
          user_id: req.user.id,
          status: 'STARTED',
          start_time: admin.firestore.FieldValue.serverTimestamp()
        };
        await attemptRef.set(attemptData);
        
        io.emit("student_joined_test", { testId: req.params.id, studentName: req.user.name, userId: req.user.id });
        return res.json(attemptData);
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    // Check if already joined
    const existing = db.prepare("SELECT * FROM test_attempts WHERE test_id = ? AND user_id = ?").get(req.params.id, req.user.id);
    if (existing) return res.json(existing);

    const info = db.prepare("INSERT INTO test_attempts (test_id, user_id) VALUES (?, ?)")
      .run(req.params.id, req.user.id);
    
    const attempt = { id: info.lastInsertRowid, test_id: req.params.id, user_id: req.user.id, status: 'STARTED' };
    io.emit("student_joined_test", { testId: req.params.id, studentName: req.user.name, userId: req.user.id });
    
    res.json(attempt);
  });

  app.post("/api/attempts/:id/save", authenticate, async (req: any, res) => {
    const { answers } = req.body; // Array of { questionId, answerText }
    
    if (firestore) {
      try {
        const batch = firestore.batch();
        for (const ans of answers) {
          const ansSnap = await firestore.collection('test_answers')
            .where('attempt_id', '==', req.params.id)
            .where('question_id', '==', ans.questionId)
            .get();
          
          if (!ansSnap.empty) {
            batch.update(ansSnap.docs[0].ref, { answer_text: ans.answerText });
          } else {
            batch.set(firestore.collection('test_answers').doc(), {
              attempt_id: req.params.id,
              question_id: ans.questionId,
              answer_text: ans.answerText
            });
          }
        }
        await batch.commit();
        return res.json({ success: true });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    db.transaction(() => {
      for (const ans of answers) {
        const existing = db.prepare("SELECT id FROM test_answers WHERE attempt_id = ? AND question_id = ?")
          .get(req.params.id, ans.questionId) as any;
        
        if (existing) {
          db.prepare("UPDATE test_answers SET answer_text = ? WHERE id = ?")
            .run(ans.answerText, existing.id);
        } else {
          db.prepare("INSERT INTO test_answers (attempt_id, question_id, answer_text) VALUES (?, ?, ?)")
            .run(req.params.id, ans.questionId, ans.answerText);
        }
      }
    })();
    
    res.json({ success: true });
  });

  app.post("/api/attempts/:id/submit", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        await firestore.collection('test_attempts').doc(req.params.id).update({
          status: 'SUBMITTED',
          end_time: admin.firestore.FieldValue.serverTimestamp()
        });
        const attemptSnap = await firestore.collection('test_attempts').doc(req.params.id).get();
        const attempt = attemptSnap.data();
        io.emit("student_submitted_test", { testId: attempt?.test_id, studentName: req.user.name, userId: req.user.id });
        return res.json({ success: true });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    db.prepare("UPDATE test_attempts SET status = 'SUBMITTED', end_time = CURRENT_TIMESTAMP WHERE id = ?")
      .run(req.params.id);
    
    const attempt = db.prepare("SELECT test_id FROM test_attempts WHERE id = ?").get(req.params.id) as any;
    io.emit("student_submitted_test", { testId: attempt.test_id, studentName: req.user.name, userId: req.user.id });
    
    res.json({ success: true });
  });

  app.get("/api/tests/:id/monitoring", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të monitorojnë" });
    
    if (firestore) {
      try {
        const snap = await firestore.collection('test_attempts').where('test_id', '==', req.params.id).get();
        const participants = await Promise.all(snap.docs.map(async doc => {
          const data = doc.data();
          const uSnap = await firestore.collection('users').doc(data.user_id.toString()).get();
          return {
            name: uSnap.data()?.name,
            status: data.status,
            start_time: data.start_time?.toDate()?.toISOString(),
            end_time: data.end_time?.toDate()?.toISOString(),
            attempt_id: doc.id
          };
        }));
        return res.json(participants);
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    const participants = db.prepare(`
      SELECT u.name, ta.status, ta.start_time, ta.end_time, ta.id as attempt_id
      FROM test_attempts ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.test_id = ?
    `).all(req.params.id);
    
    res.json(participants);
  });

  app.get("/api/attempts/:id/details", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const attemptSnap = await firestore.collection('test_attempts').doc(req.params.id).get();
        const attempt = attemptSnap.data();
        if (!attempt) return res.status(404).json({ error: "Tentativa nuk u gjet" });

        const userSnap = await firestore.collection('users').doc(attempt.user_id.toString()).get();
        const testSnap = await firestore.collection('tests').doc(attempt.test_id.toString()).get();
        
        const answersSnap = await firestore.collection('test_answers').where('attempt_id', '==', req.params.id).get();
        const answers = await Promise.all(answersSnap.docs.map(async doc => {
          const data = doc.data();
          const qSnap = await firestore.collection('questions').doc(data.question_id.toString()).get();
          const q = qSnap.data();
          return {
            ...data,
            id: doc.id,
            question_text: q?.content,
            question_type: q?.type,
            options: q?.options,
            max_points: q?.points,
            correct_answer: q?.correct_answer
          };
        }));

        return res.json({
          attempt: {
            ...attempt,
            student_name: userSnap.data()?.name,
            test_title: testSnap.data()?.title
          },
          answers
        });
      } catch (e) {
        console.error("Firestore Attempt Details Error:", e);
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    const attempt = db.prepare(`
      SELECT ta.*, u.name as student_name, t.title as test_title
      FROM test_attempts ta
      JOIN users u ON ta.user_id = u.id
      JOIN tests t ON ta.test_id = t.id
      WHERE ta.id = ?
    `).get(req.params.id);

    const answers = db.prepare(`
      SELECT ta.*, q.content as question_text, q.type as question_type, q.options, q.points as max_points, q.correct_answer
      FROM test_answers ta
      JOIN questions q ON ta.question_id = q.id
      WHERE ta.attempt_id = ?
    `).all(req.params.id);

    res.json({ attempt, answers });
  });

  app.post("/api/attempts/:id/grade", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të vlerësojnë" });
    const { grades, feedback, finalGrade } = req.body; // Array of { answerId, points, isCorrect }, finalGrade 4-10
    
    if (firestore) {
      try {
        const batch = firestore.batch();
        let totalScore = 0;
        for (const g of grades) {
          batch.update(firestore.collection('test_answers').doc(g.answerId), {
            points_awarded: g.points,
            is_correct: g.isCorrect ? 1 : 0
          });
          totalScore += g.points;
        }
        
        batch.update(firestore.collection('test_attempts').doc(req.params.id), {
          total_score: totalScore,
          grade: finalGrade,
          status: 'GRADED',
          feedback
        });
        
        const attemptSnap = await firestore.collection('test_attempts').doc(req.params.id).get();
        const attempt = attemptSnap.data();
        if (attempt) {
          const testSnap = await firestore.collection('tests').doc(attempt.test_id.toString()).get();
          const test = testSnap.data();
          const teacherSnap = await firestore.collection('users').doc(test?.teacher_id.toString()).get();
          const teacher = teacherSnap.data();

          const logType = attempt.is_exam ? 'EXAM' : 'TEST';
          batch.set(firestore.collection('performance_logs').doc(), {
            user_id: attempt.user_id,
            type: logType,
            score: finalGrade,
            max_score: 10,
            created_at: admin.firestore.FieldValue.serverTimestamp()
          });

          const notificationTitle = attempt.is_exam ? "Rezultati i Provimit: " : "Rezultati i Testit: ";
          batch.set(firestore.collection('notifications').doc(), {
            user_id: attempt.user_id,
            title: notificationTitle + test?.title,
            content: `Mësuesi ${teacher?.name} ju ka vlerësuar me notën ${finalGrade}.`,
            type: 'GRADE',
            created_at: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        
        await batch.commit();
        return res.json({ success: true, totalScore });
      } catch (e) {
        console.error("Firestore Grade Error:", e);
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    let totalScore = 0;
    db.transaction(() => {
      for (const g of grades) {
        db.prepare("UPDATE test_answers SET points_awarded = ?, is_correct = ? WHERE id = ?")
          .run(g.points, g.isCorrect ? 1 : 0, g.answerId);
        totalScore += g.points;
      }
      db.prepare("UPDATE test_attempts SET total_score = ?, grade = ?, status = 'GRADED', feedback = ? WHERE id = ?")
        .run(totalScore, finalGrade, feedback, req.params.id);
      
      const attempt = db.prepare(`
        SELECT ta.user_id, ta.is_exam, t.total_points, t.title, t.teacher_id, u.name as teacher_name
        FROM test_attempts ta 
        JOIN tests t ON ta.test_id = t.id 
        JOIN users u ON t.teacher_id = u.id
        WHERE ta.id = ?
      `).get(req.params.id) as any;

      if (attempt) {
        // Log to performance using the 4-10 grade
        const logType = attempt.is_exam ? 'EXAM' : 'TEST';
        db.prepare("INSERT INTO performance_logs (user_id, type, score, max_score) VALUES (?, ?, ?, 10)")
          .run(attempt.user_id, logType, finalGrade);
        
        // Notify student
        const notificationTitle = attempt.is_exam ? "Rezultati i Provimit: " : "Rezultati i Testit: ";
        db.prepare("INSERT INTO notifications (user_id, title, content, type) VALUES (?, ?, ?, 'GRADE')")
          .run(attempt.user_id, notificationTitle + attempt.title, `Mësuesi ${attempt.teacher_name} ju ka vlerësuar me notën ${finalGrade}.`, 'GRADE');
      }
    })();
    
    res.json({ success: true, totalScore });
  });

  app.get("/api/tests/:id/analytics", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const attemptsSnap = await firestore.collection('test_attempts')
          .where('test_id', '==', req.params.id)
          .where('status', '==', 'GRADED')
          .get();
        
        const testSnap = await firestore.collection('tests').doc(req.params.id).get();
        const test = testSnap.data();
        
        if (attemptsSnap.empty) return res.json({ message: "Nuk ka të dhëna për analizë" });

        const scores = attemptsSnap.docs.map(doc => doc.data().total_score);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const passRate = (scores.filter(s => s >= (test?.total_points || 100) * 0.4).length / scores.length) * 100;

        return res.json({
          averageScore: avg,
          passRate,
          totalAttempts: scores.length,
          distribution: scores
        });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    const attempts = db.prepare("SELECT total_score FROM test_attempts WHERE test_id = ? AND status = 'GRADED'").all(req.params.id) as any[];
    const test = db.prepare("SELECT total_points FROM tests WHERE id = ?").get(req.params.id) as any;
    
    if (attempts.length === 0) return res.json({ message: "Nuk ka të dhëna për analizë" });

    const scores = attempts.map(a => a.total_score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const passRate = (scores.filter(s => s >= test.total_points * 0.4).length / scores.length) * 100;

    res.json({
      averageScore: avg,
      passRate,
      totalAttempts: attempts.length,
      distribution: scores
    });
  });

  app.get("/api/analytics/student/:id", authenticate, async (req: any, res) => {
    const userId = req.params.id === 'me' ? req.user.id : req.params.id;
    
    if (firestore) {
      try {
        const logsSnap = await firestore.collection('performance_logs')
          .where('user_id', '==', userId.toString())
          .get();
        
        const logs = logsSnap.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            timestamp: data.created_at?.toDate()?.toISOString()
          };
        });

        // Sort in memory to avoid composite index requirement
        logs.sort((a: any, b: any) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeA - timeB;
        });

        const attendanceSnap = await firestore.collection('attendance')
          .where('user_id', '==', userId.toString())
          .get();
        
        const attendanceCounts: Record<string, number> = {};
        attendanceSnap.docs.forEach(doc => {
          const status = doc.data().status;
          attendanceCounts[status] = (attendanceCounts[status] || 0) + 1;
        });

        const attendance = Object.entries(attendanceCounts).map(([status, count]) => ({ status, count }));

        return res.json({ logs, attendance });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    const logs = db.prepare(`
      SELECT type, score, max_score, timestamp 
      FROM performance_logs 
      WHERE user_id = ? 
      ORDER BY timestamp ASC
    `).all(userId);

    const attendance = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM attendance 
      WHERE user_id = ? 
      GROUP BY status
    `).all(userId);

    res.json({ logs, attendance });
  });

  app.get("/api/analytics/class", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të shohin analitikën e klasës" });
    
    if (firestore) {
      try {
        const logsSnap = await firestore.collection('performance_logs').get();
        const logs = logsSnap.docs.map(doc => doc.data());

        const userPerformance: Record<string, { total: number, count: number }> = {};
        logs.forEach(log => {
          if (!userPerformance[log.user_id]) userPerformance[log.user_id] = { total: 0, count: 0 };
          userPerformance[log.user_id].total += log.score / log.max_score;
          userPerformance[log.user_id].count += 1;
        });

        const topImprovers = await Promise.all(
          Object.entries(userPerformance)
            .map(async ([userId, perf]) => {
              const uSnap = await firestore.collection('users').doc(userId).get();
              return {
                name: uSnap.data()?.name,
                avg_perf: perf.total / perf.count
              };
            })
        );
        topImprovers.sort((a, b) => b.avg_perf - a.avg_perf);

        return res.json({ 
          topImprovers: topImprovers.slice(0, 5),
          classProgress: [] // Simplified for now
        });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    const topImprovers = db.prepare(`
      SELECT u.name, AVG(score/max_score) as avg_perf
      FROM performance_logs pl
      JOIN users u ON pl.user_id = u.id
      GROUP BY user_id
      ORDER BY avg_perf DESC
      LIMIT 5
    `).all();

    const classProgress = db.prepare(`
      SELECT strftime('%Y-%m', timestamp) as month, AVG(score/max_score) as avg_perf
      FROM performance_logs
      GROUP BY month
      ORDER BY month ASC
    `).all();

    res.json({ topImprovers, classProgress });
  });

  app.delete("/api/questions/:id", authenticate, (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    db.prepare("DELETE FROM questions WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Live Questions
  app.get("/api/live-questions", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const snap = await firestore.collection('live_questions').orderBy('created_at', 'desc').get();
        const questions = await Promise.all(snap.docs.map(async doc => {
          const data = doc.data();
          const uSnap = await firestore.collection('users').doc(data.student_id.toString()).get();
          return {
            ...data,
            id: doc.id,
            student_name: uSnap.data()?.name
          };
        }));
        return res.json(questions);
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    const questions = db.prepare(`
      SELECT lq.*, u.name as student_name 
      FROM live_questions lq 
      JOIN users u ON lq.student_id = u.id 
      ORDER BY lq.created_at DESC
    `).all();
    res.json(questions);
  });

  app.post("/api/live-questions", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { content } = req.body;
    
    if (firestore) {
      try {
        const studentsSnap = await firestore.collection('users').where('role', '==', 'STUDENT').where('is_confirmed', '==', 1).get();
        if (studentsSnap.empty) return res.status(400).json({ error: "Nuk ka studentë të konfirmuar në klasë" });
        
        const randomIndex = Math.floor(Math.random() * studentsSnap.size);
        const studentDoc = studentsSnap.docs[randomIndex];
        const student = studentDoc.data();

        const qRef = firestore.collection('live_questions').doc();
        const question = {
          id: qRef.id,
          teacher_id: req.user.id,
          student_id: student.id,
          student_name: student.name,
          content,
          status: 'PENDING',
          created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        
        await qRef.set(question);
        io.emit("new_live_question", question);
        return res.json(question);
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    // Auto-select random student
    const student = db.prepare("SELECT id, name FROM users WHERE role = 'STUDENT' AND is_confirmed = 1 ORDER BY RANDOM() LIMIT 1").get() as any;
    if (!student) return res.status(400).json({ error: "Nuk ka studentë të konfirmuar në klasë" });

    const info = db.prepare("INSERT INTO live_questions (teacher_id, student_id, content) VALUES (?, ?, ?)")
      .run(req.user.id, student.id, content);
    
    const question = {
      id: info.lastInsertRowid,
      content,
      student_id: student.id,
      student_name: student.name,
      status: 'PENDING'
    };

    io.emit("new_live_question", question);
    res.json(question);
  });

  app.post("/api/live-questions/:id/confirm", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const qRef = firestore.collection('live_questions').doc(req.params.id);
        const doc = await qRef.get();
        const question = doc.data();
        if (question?.student_id !== req.user.id) return res.status(403).json({ error: "Pa autorizuar" });
        
        await qRef.update({ status: 'CONFIRMED' });
        const updated = { ...question, status: 'CONFIRMED' };
        io.emit("live_question_update", updated);
        return res.json(updated);
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    const question = db.prepare("SELECT * FROM live_questions WHERE id = ?").get(req.params.id) as any;
    if (question.student_id !== req.user.id) return res.status(403).json({ error: "Pa autorizuar" });
    
    db.prepare("UPDATE live_questions SET status = 'CONFIRMED' WHERE id = ?").run(req.params.id);
    const updated = { ...question, status: 'CONFIRMED' };
    io.emit("live_question_update", updated);
    res.json(updated);
  });

  app.post("/api/live-questions/:id/answer", authenticate, async (req: any, res) => {
    const { answer } = req.body;
    if (firestore) {
      try {
        const qRef = firestore.collection('live_questions').doc(req.params.id);
        const doc = await qRef.get();
        const question = doc.data();
        if (question?.student_id !== req.user.id) return res.status(403).json({ error: "Pa autorizuar" });
        
        await qRef.update({ answer, status: 'ANSWERED' });
        const updated = { ...question, answer, status: 'ANSWERED' };
        io.emit("live_question_update", updated);
        return res.json(updated);
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    const question = db.prepare("SELECT * FROM live_questions WHERE id = ?").get(req.params.id) as any;
    if (question.student_id !== req.user.id) return res.status(403).json({ error: "Pa autorizuar" });
    
    db.prepare("UPDATE live_questions SET answer = ?, status = 'ANSWERED' WHERE id = ?").run(answer, req.params.id);
    const updated = { ...question, answer, status: 'ANSWERED' };
    io.emit("live_question_update", updated);
    res.json(updated);
  });

  app.post("/api/live-questions/:id/grade", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { score } = req.body;
    
    if (firestore) {
      try {
        const qRef = firestore.collection('live_questions').doc(req.params.id);
        await qRef.update({ score, status: 'GRADED' });
        const doc = await qRef.get();
        const question = doc.data();
        
        if (question) {
          await firestore.collection('performance_logs').add({
            user_id: question.student_id,
            type: 'TEST',
            score,
            max_score: 100,
            created_at: admin.firestore.FieldValue.serverTimestamp()
          });
          io.emit("live_question_update", { ...question, score, status: 'GRADED' });
        }
        return res.json({ success: true });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    db.prepare("UPDATE live_questions SET score = ?, status = 'GRADED' WHERE id = ?").run(score, req.params.id);
    const question = db.prepare("SELECT * FROM live_questions WHERE id = ?").get(req.params.id) as any;
    
    // Log to performance
    db.prepare("INSERT INTO performance_logs (user_id, type, score, max_score) VALUES (?, 'TEST', ?, 100)")
      .run(question.student_id, score);

    io.emit("live_question_update", { ...question, score, status: 'GRADED' });
    res.json({ success: true });
  });

  // Notifications
  app.get("/api/notifications", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const snap = await firestore.collection('notifications')
          .where('user_id', '==', req.user.id.toString())
          .get();
        
        const notifications = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        
        // Sort in memory to avoid composite index requirement
        notifications.sort((a: any, b: any) => {
          const timeA = a.created_at?.seconds || 0;
          const timeB = b.created_at?.seconds || 0;
          return timeB - timeA; // Newest first
        });

        return res.json(notifications.slice(0, 20));
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    const notifications = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
    res.json(notifications);
  });

  // Assignments
  app.get("/api/assignments", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        let assignments;
        if (req.user.role === 'TEACHER') {
          const snap = await firestore.collection('assignments').where('teacher_id', '==', req.user.id).get();
          assignments = await Promise.all(snap.docs.map(async doc => {
            const data = doc.data();
            const uSnap = await firestore.collection('users').doc(data.teacher_id.toString()).get();
            return { ...data, teacher_name: uSnap.data()?.name };
          }));
        } else {
          const snap = await firestore.collection('assignments')
            .where('status', '==', 'PUBLISHED')
            .where('program', '==', req.user.program)
            .where('year', '==', req.user.year)
            .where('group_name', '==', req.user.group_name)
            .get();
          assignments = await Promise.all(snap.docs.map(async doc => {
            const data = doc.data();
            const uSnap = await firestore.collection('users').doc(data.teacher_id.toString()).get();
            return { ...data, teacher_name: uSnap.data()?.name };
          }));
        }
        return res.json(assignments);
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    let assignments;
    if (req.user.role === 'TEACHER') {
      assignments = db.prepare(`
        SELECT a.*, u.name as teacher_name 
        FROM assignments a 
        JOIN users u ON a.teacher_id = u.id
        WHERE a.teacher_id = ?
      `).all(req.user.id);
    } else {
      assignments = db.prepare(`
        SELECT a.*, u.name as teacher_name 
        FROM assignments a 
        JOIN users u ON a.teacher_id = u.id
        WHERE a.status = 'PUBLISHED' AND a.program = ? AND a.year = ? AND a.group_name = ?
      `).all(req.user.program, req.user.year, req.user.group_name);
    }
    res.json(assignments);
  });

  app.post("/api/assignments", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të krijojnë detyra" });
    const { title, description, deadline, materials, maxPoints, submissionType, status, program, year, group_name } = req.body;
    
    if (firestore) {
      try {
        const assRef = firestore.collection('assignments').doc();
        const assId = assRef.id;
        await assRef.set({
          id: assId,
          title, description, deadline, materials,
          max_points: maxPoints || 100,
          submission_type: submissionType || 'BOTH',
          status: status || 'DRAFT',
          teacher_id: req.user.id,
          program, year, group_name,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        if (status === 'PUBLISHED') {
          io.emit("new_assignment", { title, teacherName: req.user.name, program, year, group_name });
          
          // Notifications
          const studentsSnap = await firestore.collection('users')
            .where('role', '==', 'STUDENT')
            .where('program', '==', program)
            .where('year', '==', year)
            .where('group_name', '==', group_name)
            .get();
          
          const batch = firestore.batch();
          studentsSnap.forEach(doc => {
            batch.set(firestore.collection('notifications').doc(), {
              user_id: doc.id,
              title: "Detyrë e Re: " + title,
              content: `Mësuesi ${req.user.name} ka caktuar një detyrë të re me afat ${deadline}.`,
              type: 'ASSIGNMENT',
              created_at: admin.firestore.FieldValue.serverTimestamp()
            });
          });
          await batch.commit();
        }

        return res.json({ id: assId });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    const info = db.prepare("INSERT INTO assignments (title, description, deadline, materials, max_points, submission_type, status, teacher_id, program, year, group_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(title, description, deadline, materials, maxPoints || 100, submissionType || 'BOTH', status || 'DRAFT', req.user.id, program, year, group_name);
    
    if (status === 'PUBLISHED') {
      io.emit("new_assignment", { title, teacherName: req.user.name, program, year, group_name });
    }
    
    res.json({ id: info.lastInsertRowid });
  });

  app.post("/api/assignments/:id/submit", authenticate, upload.single('file'), async (req: any, res) => {
    if (req.user.role !== 'STUDENT') return res.status(403).json({ error: "Vetëm studentët mund të dorëzojnë detyra" });
    const { content } = req.body;
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    
    if (firestore) {
      try {
        const assSnap = await firestore.collection('assignments').doc(req.params.id).get();
        const assignment = assSnap.data();
        const isLate = assignment && new Date() > new Date(assignment.deadline) ? 1 : 0;

        const subRef = firestore.collection('submissions').doc();
        await subRef.set({
          id: subRef.id,
          assignment_id: req.params.id,
          student_id: req.user.id,
          content: content || "",
          file_path: filePath,
          is_late: isLate,
          status: 'SUBMITTED',
          submitted_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return res.json({ id: subRef.id });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    const assignment = db.prepare("SELECT deadline FROM assignments WHERE id = ?").get(req.params.id) as any;
    const isLate = assignment && new Date() > new Date(assignment.deadline) ? 1 : 0;

    const info = db.prepare("INSERT INTO submissions (assignment_id, student_id, content, file_path, is_late, status) VALUES (?, ?, ?, ?, ?, 'SUBMITTED')")
      .run(req.params.id, req.user.id, content || "", filePath, isLate);
    
    res.json({ id: info.lastInsertRowid });
  });

  app.use("/uploads", express.static(uploadDir));

  // Chat
  app.get("/api/chat/messages", authenticate, async (req: any, res) => {
    const { type } = req.query;
    
    if (firestore) {
      try {
        let query: any = firestore.collection('messages')
          .where('chat_type', '==', type || 'CLASS');

        if (type === 'CLASS') {
          const userSnap = await firestore.collection('users').doc(req.user.id).get();
          const user = userSnap.data();
          if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });

          const classSnap = await firestore.collection('classes')
            .where('department', '==', user.program)
            .where('year', '==', user.year)
            .where('group_name', '==', user.group_name)
            .where('study_type', '==', user.study_type)
            .get();

          if (!classSnap.empty) {
            query = query.where('class_id', '==', classSnap.docs[0].id);
          }
        }

        const messagesSnap = await query.get();
        const messages = messagesSnap.docs.map((doc: any) => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            timestamp: data.timestamp?.toDate()?.toISOString()
          };
        });

        // Sort in memory to avoid composite index requirement
        messages.sort((a: any, b: any) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeA - timeB; // Oldest first for chat display
        });

        return res.json(messages.slice(-100)); // Return last 100 messages
      } catch (e) {
        console.error("Firestore Chat Error:", e);
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    let query = `
      SELECT m.*, u.name as senderName 
      FROM messages m 
      JOIN users u ON m.sender_id = u.id 
      WHERE m.chat_type = ? 
      AND m.timestamp > datetime('now', '-12 hours')
    `;
    const params: any[] = [type || 'CLASS'];

    if (type === 'CLASS') {
      const user = db.prepare("SELECT program, year, group_name, study_type FROM users WHERE id = ?").get(req.user.id) as any;
      if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });
      const classroom = db.prepare("SELECT id FROM classes WHERE department = ? AND year = ? AND group_name = ? AND study_type = ?")
        .get(user.program, user.year, user.group_name, user.study_type) as any;
      
      if (classroom) {
        query += " AND m.class_id = ?";
        params.push(classroom.id);
      } else {
        return res.json([]);
      }
    }

    query += " ORDER BY m.timestamp ASC";
    const messages = db.prepare(query).all(...params);
    res.json(messages);
  });

  app.get("/api/assignments/:id/submissions", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të shohin dorëzimet" });
    if (firestore) {
      try {
        const snap = await firestore.collection('submissions').where('assignment_id', '==', req.params.id).get();
        const submissions = await Promise.all(snap.docs.map(async doc => {
          const data = doc.data();
          const uSnap = await firestore.collection('users').doc(data.student_id.toString()).get();
          return {
            ...data,
            id: doc.id,
            student_name: uSnap.data()?.name
          };
        }));
        return res.json(submissions);
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    const submissions = db.prepare(`
      SELECT s.*, u.name as student_name 
      FROM submissions s 
      JOIN users u ON s.student_id = u.id 
      WHERE s.assignment_id = ?
    `).all(req.params.id);
    res.json(submissions);
  });

  app.post("/api/submissions/:id/grade", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Vetëm mësuesit mund të vlerësojnë" });
    const { points, feedback, grade } = req.body; // grade 4-10
    
    if (firestore) {
      try {
        const subRef = firestore.collection('submissions').doc(req.params.id);
        await subRef.update({
          points,
          grade,
          feedback,
          status: 'GRADED',
          graded_at: admin.firestore.FieldValue.serverTimestamp()
        });
        
        const subSnap = await subRef.get();
        const sub = subSnap.data();
        if (sub) {
          const assSnap = await firestore.collection('assignments').doc(sub.assignment_id.toString()).get();
          const assignment = assSnap.data();
          const teacherSnap = await firestore.collection('users').doc(assignment?.teacher_id.toString()).get();
          const teacher = teacherSnap.data();

          await firestore.collection('performance_logs').add({
            user_id: sub.student_id,
            type: 'ASSIGNMENT',
            score: grade,
            max_score: 10,
            created_at: admin.firestore.FieldValue.serverTimestamp()
          });

          await firestore.collection('notifications').add({
            user_id: sub.student_id,
            title: "Vlerësim Detyre: " + assignment?.title,
            content: `Mësuesi ${teacher?.name} ju ka vlerësuar me notën ${grade}.`,
            type: 'GRADE',
            created_at: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        return res.json({ success: true });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    db.transaction(() => {
      db.prepare("UPDATE submissions SET points = ?, grade = ?, feedback = ?, status = 'GRADED', graded_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(points, grade, feedback, req.params.id);
      
      const sub = db.prepare(`
        SELECT s.student_id, a.max_points, a.title, u.name as teacher_name
        FROM submissions s 
        JOIN assignments a ON s.assignment_id = a.id 
        JOIN users u ON a.teacher_id = u.id
        WHERE s.id = ?
      `).get(req.params.id) as any;

      if (sub) {
        // Log to performance using the 4-10 grade
        db.prepare("INSERT INTO performance_logs (user_id, type, score, max_score) VALUES (?, 'ASSIGNMENT', ?, 10)")
          .run(sub.student_id, grade, 10);

        // Notify student
        db.prepare("INSERT INTO notifications (user_id, title, content, type) VALUES (?, ?, ?, 'GRADE')")
          .run(sub.student_id, "Vlerësim Detyre: " + sub.title, `Mësuesi ${sub.teacher_name} ju ka vlerësuar me notën ${grade}.`, 'GRADE');
      }
    })();
    
    res.json({ success: true });
  });

  app.get("/api/my-submissions", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const snap = await firestore.collection('submissions').where('student_id', '==', req.user.id.toString()).get();
        const submissions = await Promise.all(snap.docs.map(async doc => {
          const data = doc.data();
          const assSnap = await firestore.collection('assignments').doc(data.assignment_id.toString()).get();
          return {
            ...data,
            id: doc.id,
            assignment_title: assSnap.data()?.title
          };
        }));
        return res.json(submissions);
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    const submissions = db.prepare(`
      SELECT s.*, a.title as assignment_title 
      FROM submissions s 
      JOIN assignments a ON s.assignment_id = a.id 
      WHERE s.student_id = ?
    `).all(req.user.id);
    res.json(submissions);
  });

  // Digital Library
  app.get("/api/library/books", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        const userSnap = await firestore.collection('users').doc(req.user.id.toString()).get();
        const user = userSnap.data();
        if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });

        const classSnap = await firestore.collection('classes')
          .where('department', '==', user.program)
          .where('year', '==', user.year)
          .where('group_name', '==', user.group_name)
          .where('study_type', '==', user.study_type)
          .get();

        if (classSnap.empty) return res.json([]);
        const classId = classSnap.docs[0].id;

        const booksSnap = await firestore.collection('library_books').where('class_id', '==', classId).get();
        return res.json(booksSnap.docs.map(doc => doc.data()));
      } catch (e) {
        console.error("Firestore Library Error:", e);
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    const user = db.prepare("SELECT program, year, group_name, study_type FROM users WHERE id = ?").get(req.user.id) as any;
    if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });
    const classroom = db.prepare("SELECT id FROM classes WHERE department = ? AND year = ? AND group_name = ? AND study_type = ?")
      .get(user.program, user.year, user.group_name, user.study_type) as any;
    
    if (!classroom) return res.json([]);

    const books = db.prepare(`
      SELECT b.*, u.name as uploader_name 
      FROM library_books b 
      JOIN users u ON b.uploader_id = u.id 
      WHERE b.class_id = ?
      ORDER BY b.created_at DESC
    `).all(classroom.id);
    res.json(books);
  });

  app.post("/api/library/upload", authenticate, upload.single('file'), async (req: any, res) => {
    const { title, author } = req.body;
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;
    
    if (!filePath) return res.status(400).json({ error: "File i kërkuar" });

    if (firestore) {
      try {
        const userSnap = await firestore.collection('users').doc(req.user.id.toString()).get();
        const user = userSnap.data();
        if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });

        const memberSnap = await firestore.collection('class_members').where('user_id', '==', req.user.id).get();
        const member = memberSnap.empty ? null : memberSnap.docs[0].data();

        if (user.role !== 'TEACHER' && !member?.is_admin) {
          return res.status(403).json({ error: "Vetëm mësuesit dhe presidenti i klasës mund të publikojnë libra" });
        }

        const classSnap = await firestore.collection('classes')
          .where('department', '==', user.program)
          .where('year', '==', user.year)
          .where('group_name', '==', user.group_name)
          .where('study_type', '==', user.study_type)
          .get();

        if (classSnap.empty) return res.status(400).json({ error: "Klasa nuk u gjet" });
        const classId = classSnap.docs[0].id;

        const bookRef = firestore.collection('library_books').doc();
        await bookRef.set({
          id: bookRef.id,
          title, author: author || "I panjohur",
          file_path: filePath,
          uploader_id: req.user.id,
          class_id: classId,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return res.json({ id: bookRef.id });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    // Check if user is teacher or class admin
    const user = db.prepare(`
      SELECT u.role, cm.is_admin as is_class_admin, u.program, u.year, u.group_name, u.study_type
      FROM users u
      LEFT JOIN class_members cm ON u.id = cm.user_id
      WHERE u.id = ?
    `).get(req.user.id) as any;

    if (user.role !== 'TEACHER' && !user.is_class_admin) {
      return res.status(403).json({ error: "Vetëm mësuesit dhe presidenti i klasës mund të publikojnë libra" });
    }

    const classroom = db.prepare("SELECT id FROM classes WHERE department = ? AND year = ? AND group_name = ? AND study_type = ?")
      .get(user.program, user.year, user.group_name, user.study_type) as any;

    if (!classroom) return res.status(400).json({ error: "Klasa nuk u gjet" });

    const info = db.prepare("INSERT INTO library_books (title, author, file_path, uploader_id, class_id) VALUES (?, ?, ?, ?, ?)")
      .run(title, author || "I panjohur", filePath, req.user.id, classroom.id);
    
    res.json({ id: info.lastInsertRowid });
  });

  // Schedules
  app.get("/api/schedules", authenticate, async (req: any, res) => {
    if (firestore) {
      try {
        if (req.user.role === 'TEACHER') {
          const snap = await firestore.collection('schedules').where('teacher_id', '==', req.user.id).get();
          return res.json(snap.docs.map(doc => doc.data()));
        } else {
          const userSnap = await firestore.collection('users').doc(req.user.id).get();
          const user = userSnap.data();
          if (!user) return res.status(404).json({ error: "Përdoruesi nuk u gjet" });

          const snap = await firestore.collection('schedules')
            .where('program', '==', user.program)
            .where('year', '==', user.year)
            .where('group_name', '==', user.group_name)
            .get();
          return res.json(snap.docs.map(doc => doc.data()));
        }
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }
    let schedules;
    if (req.user.role === 'TEACHER') {
      schedules = db.prepare("SELECT * FROM schedules WHERE teacher_id = ?").all(req.user.id);
    } else {
      // For students, filter by their program, year and group
      const user = db.prepare("SELECT program, year, group_name FROM users WHERE id = ?").get(req.user.id) as any;
      schedules = db.prepare(`
        SELECT s.*, u.name as teacher_name 
        FROM schedules s 
        JOIN users u ON s.teacher_id = u.id 
        WHERE s.program = ? AND s.year = ? AND s.group_name = ?
      `).all(user.program, user.year, user.group_name);
    }
    res.json(schedules);
  });

  app.post("/api/schedules", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    const { day_of_week, start_time, end_time, program, year, group_name, building, classroom, subject } = req.body;
    
    if (firestore) {
      try {
        // Check for conflicts (Simplified for now)
        const snap = await firestore.collection('schedules')
          .where('day_of_week', '==', day_of_week)
          .where('program', '==', program)
          .where('year', '==', year)
          .where('group_name', '==', group_name)
          .get();
        
        const hasConflict = snap.docs.some(doc => {
          const s = doc.data();
          return (start_time < s.end_time && end_time > s.start_time);
        });

        if (hasConflict) return res.status(400).json({ error: "Ka një konflikt në orar për këtë kohë" });

        const schRef = firestore.collection('schedules').doc();
        const schedule = {
          id: schRef.id,
          teacher_id: req.user.id,
          teacher_name: req.user.name,
          day_of_week, start_time, end_time,
          program, year, group_name,
          building, classroom, subject,
          created_at: admin.firestore.FieldValue.serverTimestamp()
        };
        await schRef.set(schedule);
        return res.json(schedule);
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    // Check for conflicts
    const conflict = db.prepare(`
      SELECT * FROM schedules 
      WHERE day_of_week = ? 
      AND (
        (program = ? AND year = ? AND group_name = ?) -- Class conflict
        OR teacher_id = ? -- Teacher conflict
      )
      AND (
        (start_time < ? AND end_time > ?) -- Overlaps
      )
    `).get(day_of_week, program, year, group_name, req.user.id, end_time, start_time);

    if (conflict) {
      return res.status(400).json({ error: "Konflikt orari! Kjo klasë ose mësues ka një orë tjetër në këtë kohë." });
    }

    const info = db.prepare(`
      INSERT INTO schedules (teacher_id, day_of_week, start_time, end_time, program, year, group_name, building, classroom, subject) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, day_of_week, start_time, end_time, program, year, group_name, building, classroom, subject);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/schedules/:id", authenticate, async (req: any, res) => {
    if (req.user.role !== 'TEACHER') return res.status(403).json({ error: "Pa autorizuar" });
    
    if (firestore) {
      try {
        const schRef = firestore.collection('schedules').doc(req.params.id);
        const doc = await schRef.get();
        if (doc.data()?.teacher_id !== req.user.id) return res.status(403).json({ error: "Pa autorizuar" });
        await schRef.delete();
        return res.json({ success: true });
      } catch (e) {
        return res.status(500).json({ error: "Gabim në Firebase" });
      }
    }

    db.prepare("DELETE FROM schedules WHERE id = ? AND teacher_id = ?").run(req.params.id, req.user.id);
    res.json({ success: true });
  });

  // API 404 Handler
  app.all("/api/*", (req, res) => {
    console.log(`[API 404] ${req.method} ${req.url}`);
    res.status(404).json({ error: `Rruga API nuk u gjet: ${req.method} ${req.url}` });
  });

  // Global error handler (should be after routes)
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("GLOBAL ERROR HANDLER:", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({ 
      error: "Gabim i brendshëm i serverit", 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  });

  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[API FALLTHROUGH] ${req.method} ${req.url}`);
    }
    next();
  });

  // Socket.io Logic
  const onlineUsers = new Map();

  function setupSocket() {
    io.on("connection", (socket) => {
    socket.on("join", (userData) => {
      // Ensure we have name and surname
      const user = db.prepare("SELECT name, surname FROM users WHERE id = ?").get(userData.id) as any;
      if (user) {
        userData.name = user.name;
        userData.surname = user.surname;
      }
      
      onlineUsers.set(socket.id, userData);
      
      if (userData.role === 'STUDENT') {
        const user = db.prepare("SELECT program, year, group_name, study_type FROM users WHERE id = ?").get(userData.id) as any;
        if (user) {
          const classroom = db.prepare("SELECT id FROM classes WHERE department = ? AND year = ? AND group_name = ? AND study_type = ?")
            .get(user.program, user.year, user.group_name, user.study_type) as any;
          
          if (classroom) {
            socket.join(`class_${classroom.id}`);
          }
        }
      }
      
      io.emit("user_status", Array.from(onlineUsers.values()));
    });

    // WebRTC Signaling for Screen Share / Live Stream
    socket.on("stream_started", (data) => {
      // data: { type: 'SCREEN' | 'CAMERA', classId: string }
      socket.to(`class_${data.classId}`).emit("stream_available", {
        teacherId: socket.id,
        type: data.type
      });
    });

    socket.on("stream_stopped", (data) => {
      socket.to(`class_${data.classId}`).emit("stream_ended");
    });

    socket.on("request_stream", (data) => {
      // data: { to: teacherSocketId }
      io.to(data.to).emit("student_requested_stream", { from: socket.id });
    });

    socket.on("webrtc_offer", (data) => {
      // data: { to: studentSocketId, offer: sdp }
      io.to(data.to).emit("webrtc_offer", { from: socket.id, offer: data.offer });
    });

    socket.on("webrtc_answer", (data) => {
      // data: { to: teacherSocketId, answer: sdp }
      io.to(data.to).emit("webrtc_answer", { from: socket.id, answer: data.answer });
    });

    socket.on("webrtc_ice_candidate", (data) => {
      // data: { to: targetSocketId, candidate: ice }
      io.to(data.to).emit("webrtc_ice_candidate", { from: socket.id, candidate: data.candidate });
    });

    socket.on("send_message", async (msg) => {
      let classId = null;
      let senderName = "";

      if (firestore) {
        try {
          const userSnap = await firestore.collection('users').doc(msg.senderId.toString()).get();
          const user = userSnap.data();
          if (user) {
            senderName = `${user.name} ${user.surname}`;
            if (msg.chatType === 'CLASS') {
              const classSnap = await firestore.collection('classes')
                .where('department', '==', user.program)
                .where('year', '==', user.year)
                .where('group_name', '==', user.group_name)
                .where('study_type', '==', user.study_type)
                .get();
              if (!classSnap.empty) {
                classId = classSnap.docs[0].id;
              }
            }
          }
          
          const msgData = {
            sender_id: msg.senderId,
            senderName,
            content: msg.content,
            chat_type: msg.chatType || 'CLASS',
            class_id: classId,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          };
          
          await firestore.collection('messages').add(msgData);
          
          const broadcastMsg = { ...msg, senderName, timestamp: new Date().toISOString() };
          if (msg.chatType === 'CLASS' && classId) {
            io.to(`class_${classId}`).emit("new_message", broadcastMsg);
          } else {
            io.emit("new_message", broadcastMsg);
          }
          return;
        } catch (e) {
          console.error("Firestore Socket Error:", e);
        }
      }

      if (msg.chatType === 'CLASS') {
        const user = db.prepare("SELECT program, year, group_name, study_type, name, surname FROM users WHERE id = ?").get(msg.senderId) as any;
        if (user) {
          const classroom = db.prepare("SELECT id FROM classes WHERE department = ? AND year = ? AND group_name = ? AND study_type = ?")
            .get(user.program, user.year, user.group_name, user.study_type) as any;
          classId = classroom?.id;
          msg.senderName = `${user.name} ${user.surname}`;
        }
      } else {
        const user = db.prepare("SELECT name, surname FROM users WHERE id = ?").get(msg.senderId) as any;
        if (user) {
          msg.senderName = `${user.name} ${user.surname}`;
        }
      }

      db.prepare("INSERT INTO messages (sender_id, content, chat_type, class_id) VALUES (?, ?, ?, ?)")
        .run(msg.senderId, msg.content, msg.chatType || 'CLASS', classId);
      
      if (msg.chatType === 'CLASS' && classId) {
        io.to(`class_${classId}`).emit("new_message", msg);
      } else {
        io.emit("new_message", msg);
      }
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(socket.id);
      io.emit("user_status", Array.from(onlineUsers.values()));
    });
  });
}

// Initialize Socket.io
setupSocket();

// Vite middleware or Static serving
const distPath = path.join(_dirname, "dist");
console.log(`distPath: ${distPath}`);
if ((!getIsProduction() && !getIsVercel() && !getIsNetlify()) || (!fs.existsSync(distPath) && !getIsVercel() && !getIsNetlify())) {
  console.log("Initializing Vite middleware...");
  import(String("vite")).then((mod: any) => {
    const createViteServer = mod.createServer;
    createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    }).then(vite => {
      app.use(vite.middlewares);
      console.log("Vite middleware initialized.");
    }).catch(e => {
      console.error("Failed to initialize Vite middleware:", e);
    });
  });
} else {
  // Production mode (Render, etc.) or Vercel
  console.log("Checking for static files at:", distPath);
  if (fs.existsSync(distPath)) {
    console.log("Static files found. Registering static middleware.");
    app.use(express.static(distPath));
  } else {
    console.warn("CRITICAL WARNING: 'dist' directory not found at:", distPath);
    console.warn("The frontend will not be served. Did you run 'npm run build'?");
  }
}

// Catch-all for API routes to ensure JSON response
app.all("/api/*", (req, res) => {
  console.log(`[DEBUG] API 404 hit: ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: "Rruga API nuk u gjet (404)", 
    method: req.method, 
    url: req.url,
    path: req.path,
    env: getIsNetlify() ? 'Netlify' : 'Other'
  });
});

// Always register the catch-all route in production/Vercel
app.get("*", (req, res) => {
  console.log(`[DEBUG] Catch-all route hit: ${req.method} ${req.url}`);
  // API routes should have been handled by now
  if (req.url.startsWith('/api')) {
    console.log(`[API 404] ${req.method} ${req.url}`);
    return res.status(404).json({ error: `Rruga API nuk u gjet: ${req.method} ${req.url}` });
  }

  // Serve index.html for all other routes
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`
      <html>
        <body style="font-family: sans-serif; padding: 2rem; line-height: 1.5;">
          <h1>Frontend Not Found</h1>
          <p>The server is running, but the frontend files (dist) are missing.</p>
          <p><b>Path checked:</b> ${indexPath}</p>
          <p>Please ensure you have run <code>npm run build</code> before starting the server.</p>
          <hr>
          <p>API Health Check: <a href="/api/health">/api/health</a></p>
        </body>
      </html>
    `);
  }
});

const PORT = Number(process.env.PORT) || 3000;
console.log(`Attempting to listen on port ${PORT}...`);
console.log("Starting httpServer.listen...");
// Always listen in AI Studio environment, but avoid blocking in serverless functions
if (!getIsNetlify() && !getIsVercel()) {
  initDb().then(() => {
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is live and listening on port ${PORT}`);
    });
  }).catch(e => {
    console.error("Failed to start server due to DB error:", e);
  });
} else if (process.env.AI_STUDIO) {
  // Special case for AI Studio if it sets an env var, 
  // but usually we just check if it's NOT Netlify/Vercel
  initDb().then(() => {
    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is live and listening on port ${PORT} (AI Studio)`);
    });
  }).catch(e => {
    console.error("Failed to start server (AI Studio) due to DB error:", e);
  });
}

export default app;
