import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

const fallbackChatHistory = new Map();

const fallbackPortfolio = {
  group: {
    id: 1,
    group_name: 'MANIFESTx',
    concept: 'ร่วมสร้างสรรค์เทคโนโลยีและพัฒนาผลงานดิจิทัลด้วยความคิดสร้างสรรค์และการทำงานเป็นทีม',
    highlights: 'กลุ่มผู้พัฒนาเว็บแอปพลิเคชันที่ผสานการออกแบบส่วนติดต่อผู้ใช้ ฐานข้อมูล และปัญญาประดิษฐ์',
  },
  members: [
    { name: 'เตชิน เดชจิตร', role: 'Frontend & UI/UX', skills: ['React', 'JavaScript', 'CSS3', 'Figma'], projects: [{ name: 'MANIFEST CHAT AI - Frontend', detail: 'ออกแบบและพัฒนาหน้าเว็บ Portfolio และหน้าแชตโต้ตอบกับ AI' }] },
    { name: 'จารุยา จรุงพร', role: 'Backend & Database', skills: ['Node.js', 'Express', 'PostgreSQL', 'REST API'], projects: [{ name: 'MANIFEST CHAT AI - Backend & DB', detail: 'ออกแบบฐานข้อมูล PostgreSQL และพัฒนา REST API รับ-ส่งข้อมูล' }] },
    { name: 'เพ็ญพิศุทธิ์ วชิระอารีรัตน์', role: 'AI Integration', skills: ['Gemini API', 'Prompt Engineering', 'GitHub Actions', 'CI/CD'], projects: [{ name: 'MANIFEST CHAT AI - AI & CI/CD', detail: 'เชื่อมต่อระบบ AI พร้อม Context ข้อมูลกลุ่ม และวางระบบ Build/Deploy อัตโนมัติ' }] },
  ],
};

// 1. ตั้งค่าการเชื่อมต่อ PostgreSQL
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

// 2. ตั้งค่า Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 3. สร้างตารางและอัปเดตข้อมูล Portfolio ลง PostgreSQL อัตโนมัติ
async function initDatabase() {
  let client;
  try {
    client = await pool.connect();
    // ตารางเก็บประวัติการสนทนา
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(128),
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`
      ALTER TABLE chat_messages
      ADD COLUMN IF NOT EXISTS session_id VARCHAR(128);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS chat_messages_session_id_id_idx
      ON chat_messages (session_id, id);
    `);

    // ตารางเก็บข้อมูลกลุ่ม
    await client.query(`
      CREATE TABLE IF NOT EXISTS portfolio_group (
        id INTEGER PRIMARY KEY,
        group_name VARCHAR(150) NOT NULL,
        concept TEXT NOT NULL,
        highlights TEXT NOT NULL,
        group_projects JSONB NOT NULL,
        contact JSONB NOT NULL
      );
    `);

    // ตารางเก็บข้อมูลสมาชิกรายบุคคล
    await client.query(`
      CREATE TABLE IF NOT EXISTS portfolio_members (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        role VARCHAR(150) NOT NULL,
        skills TEXT[] NOT NULL,
        projects JSONB NOT NULL
      );
    `);

    // =========================================================================
    // ข้อมูลกลุ่ม MANIFEST และโปรเจกต์ MANIFEST CHAT AI
    // =========================================================================
    await client.query(
      `INSERT INTO portfolio_group (id, group_name, concept, highlights, group_projects, contact)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         group_name = EXCLUDED.group_name,
         concept = EXCLUDED.concept,
         highlights = EXCLUDED.highlights,
         group_projects = EXCLUDED.group_projects,
         contact = EXCLUDED.contact`,
      [
        1,
        'MANIFEST',
        'ร่วมสร้างสรรค์เทคโนโลยีและพัฒนาผลงานดิจิทัลด้วยความคิดสร้างสรรค์และการทำงานเป็นทีม',
        'กลุ่มผู้พัฒนาเว็บแอปพลิเคชันที่ผสานการออกแบบส่วนติดต่อผู้ใช้ ฐานข้อมูล และปัญญาประดิษฐ์ เพื่อสร้างประสบการณ์ใช้งานที่มีประโยชน์และเข้าถึงง่าย',
        JSON.stringify([
          {
            title: 'MANIFEST CHAT AI',
            description: 'เว็บแอปพลิเคชันแสดงผลงานของกลุ่ม MANIFEST พร้อมผู้ช่วย AI ที่ตอบคำถามเกี่ยวกับสมาชิกและผลงานจากฐานข้อมูลจริง',
            tech: ['React', 'Express', 'PostgreSQL', 'Gemini AI'],
          },
        ]),
        JSON.stringify({
          email: 'teamsmanifest@gmail.com',
          github: 'https://github.com/techindetc-ux/project_aie312',
        }),
      ]
    );

    // =========================================================================
    // ข้อมูลสมาชิกทั้ง 3 คนในกลุ่ม MANIFEST
    // =========================================================================
    const members = [
      {
        name: 'เตชิน เดชจิตร',
        role: 'Frontend & UI/UX',
        skills: ['React', 'JavaScript', 'CSS3', 'Figma'],
        projects: [
          { name: 'MANIFEST CHAT AI - Frontend', detail: 'ออกแบบและพัฒนาหน้าเว็บ Portfolio และหน้าแชตโต้ตอบกับ AI' },
        ],
      },
      {
        name: 'จารุยา จรุงพร',
        role: 'Backend & Database',
        skills: ['Node.js', 'Express', 'PostgreSQL', 'REST API'],
        projects: [
          { name: 'MANIFEST CHAT AI - Backend & DB', detail: 'ออกแบบฐานข้อมูล PostgreSQL และพัฒนา REST API รับ-ส่งข้อมูล' },
        ],
      },
      {
        name: 'เพ็ญพิศุทธิ์ วชิระอารีรัตน์',
        role: 'AI Integration' ,
        skills: ['Gemini API', 'Prompt Engineering', 'GitHub Actions', 'CI/CD'],
        projects: [
          { name: 'MANIFEST CHAT AI - AI & CI/CD', detail: 'เชื่อมต่อระบบ AI พร้อม Context ข้อมูลกลุ่ม และวางระบบ Build/Deploy อัตโนมัติ' },
        ],
      },
    ];

    await client.query('TRUNCATE TABLE portfolio_members RESTART IDENTITY');
    for (const m of members) {
      await client.query(
        `INSERT INTO portfolio_members (name, role, skills, projects) VALUES ($1, $2, $3, $4)`,
        [m.name, m.role, m.skills, JSON.stringify(m.projects)]
      );
    }

    console.log('✅ เชื่อมต่อ PostgreSQL และอัปเดตข้อมูล MANIFEST CHAT AI สำเร็จ');
  } catch (err) {
    console.error('❌ Database error:', err);
  } finally {
    if (client) client.release();
  }
}

// 4. API Endpoints

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', group: 'MANIFEST', project: 'MANIFEST CHAT AI' });
});

app.get('/api/portfolio', async (req, res) => {
  try {
    const groupRes = await pool.query('SELECT * FROM portfolio_group WHERE id = 1');
    const membersRes = await pool.query('SELECT * FROM portfolio_members ORDER BY id ASC');
    res.json({
      group: groupRes.rows[0] || null,
      members: membersRes.rows || [],
    });
  } catch (error) {
    res.json({
      group: {
        id: 1,
        group_name: 'MANIFEST',
        concept: 'ร่วมสร้างสรรค์เทคโนโลยีและพัฒนาผลงานดิจิทัลด้วยความคิดสร้างสรรค์และการทำงานเป็นทีม',
        highlights: 'กลุ่มผู้พัฒนาเว็บแอปพลิเคชันที่ผสานการออกแบบส่วนติดต่อผู้ใช้ ฐานข้อมูล และปัญญาประดิษฐ์',
        group_projects: [{
          title: 'MANIFEST CHAT AI',
          description: 'เว็บแอปพลิเคชันแสดงผลงานของกลุ่ม MANIFEST พร้อมผู้ช่วย AI ที่ตอบคำถามเกี่ยวกับสมาชิกและผลงาน',
          tech: ['React', 'Express', 'PostgreSQL', 'Gemini AI'],
        }],
        contact: { email: 'teamsmanifest@gmail.com', github: 'https://github.com/techindetc-ux/project_aie312' },
      },
      members: [
        { name: 'เตชิน เดชจิตร', role: 'Frontend & UI/UX', skills: ['React', 'JavaScript', 'CSS3', 'Figma'], projects: [{ name: 'MANIFEST CHAT AI - Frontend', detail: 'ออกแบบและพัฒนาหน้าเว็บ Portfolio และหน้าแชตโต้ตอบกับ AI' }] },
        { name: 'จารุยา จรุงพร', role: 'Backend & Database', skills: ['Node.js', 'Express', 'PostgreSQL', 'REST API'], projects: [{ name: 'MANIFEST CHAT AI - Backend & DB', detail: 'ออกแบบฐานข้อมูล PostgreSQL และพัฒนา REST API รับ-ส่งข้อมูล' }] },
        { name: 'เพ็ญพิศุทธิ์ วชิระอารีรัตน์', role: 'AI Integration', skills: ['Gemini API', 'Prompt Engineering', 'GitHub Actions', 'CI/CD'], projects: [{ name: 'MANIFEST CHAT AI - AI & CI/CD', detail: 'เชื่อมต่อระบบ AI พร้อม Context ข้อมูลกลุ่ม และวางระบบ Build/Deploy อัตโนมัติ' }] },
      ],
    });
  }
});

function getSessionId(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 128) {
    return null;
  }
  return value.trim();
}

app.get('/api/chat', async (req, res) => {
  const sessionId = getSessionId(req.query.sessionId);
  if (!sessionId) {
    return res.status(400).json({ error: 'กรุณาระบุ sessionId ที่ถูกต้อง' });
  }

  try {
    const result = await pool.query(
      'SELECT id, role, content, created_at FROM chat_messages WHERE session_id = $1 ORDER BY id ASC LIMIT 100',
      [sessionId]
    );
    res.json(result.rows);
  } catch (error) {
    res.json((fallbackChatHistory.get(sessionId) || []).map((item, index) => ({
      id: index + 1,
      role: item.role,
      content: item.content,
    })));
  }
});

app.delete('/api/chat', async (req, res) => {
  const sessionId = getSessionId(req.query.sessionId);
  if (!sessionId) {
    return res.status(400).json({ error: 'กรุณาระบุ sessionId ที่ถูกต้อง' });
  }

  try {
    await pool.query('DELETE FROM chat_messages WHERE session_id = $1', [sessionId]);
  } catch (error) {
    // Continue with in-memory history when PostgreSQL is unavailable.
  }
  fallbackChatHistory.delete(sessionId);
  res.json({ message: 'ล้างประวัติสนทนาเรียบร้อย' });
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body || {};
  const sessionId = getSessionId(req.body?.sessionId);
  if (!sessionId) {
    return res.status(400).json({ error: 'กรุณาระบุ sessionId ที่ถูกต้อง' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'กรุณาพิมพ์ข้อความ' });
  }

  try {
    await pool.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [sessionId, 'user', message.trim()]
    ).catch(() => {});

    let groupRes;
    let membersRes;
    try {
      groupRes = await pool.query('SELECT * FROM portfolio_group WHERE id = 1');
      membersRes = await pool.query('SELECT * FROM portfolio_members ORDER BY id ASC');
    } catch (error) {
      groupRes = { rows: [fallbackPortfolio.group] };
      membersRes = { rows: fallbackPortfolio.members };
    }
    const portfolioContext = JSON.stringify({
      group: groupRes.rows[0],
      members: membersRes.rows,
    });

    const systemInstruction = `
คุณคือผู้ช่วย AI ประจำโปรเจกต์ "MANIFEST CHAT AI" ของกลุ่ม "MANIFEST"
จงตอบคำถามโดยอ้างอิงจากข้อมูล Portfolio JSON ด้านล่างนี้เท่านั้น ตอบให้ตรงคำถาม และไม่เติมคำขวัญหรือคำลงท้ายที่ผู้ใช้ไม่ได้ถาม
สามารถตอบได้ทั้งคำถามภาพรวมของกลุ่ม MANIFEST และคำถามเจาะจงเกี่ยวกับสมาชิกรายบุคคล (ชื่อ บทบาท ทักษะ ผลงาน)
หากไม่มีข้อมูลใน Portfolio ให้แจ้งอย่างสุภาพว่าไม่มีข้อมูลส่วนนี้

ข้อมูล Portfolio:
${portfolioContext}
`;

    let recentHistory;
    try {
      const historyRes = await pool.query(
        'SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY id DESC LIMIT 6',
        [sessionId]
      );
      recentHistory = historyRes.rows
        .reverse()
        .map((r) => `${r.role === 'user' ? 'ผู้ใช้' : 'AI'}: ${r.content}`)
        .join('\n');
    } catch (error) {
      const memoryHistory = fallbackChatHistory.get(sessionId) || [];
      recentHistory = memoryHistory
        .slice(-6)
        .map((r) => `${r.role === 'user' ? 'ผู้ใช้' : 'AI'}: ${r.content}`)
        .join('\n');
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: `ประวัติการสนทนา:\n${recentHistory}\n\nคำถามล่าสุด: ${message.trim()}`,
      config: {
        systemInstruction,
        temperature: 0.4,
      },
    });

    const aiReply = response.text || 'ไม่สามารถประมวลผลคำตอบได้';

    await pool.query('INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)', [
      sessionId,
      'ai',
      aiReply,
    ]);

    res.json({ reply: aiReply });
  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเชื่อมต่อ AI' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Backend โปรเจกต์ MANIFEST CHAT AI พร้อมใช้งานที่ http://localhost:${port}`);
});

initDatabase().catch((error) => {
  console.error('❌ ไม่สามารถเริ่มฐานข้อมูลได้:', error.code || error.message);
});