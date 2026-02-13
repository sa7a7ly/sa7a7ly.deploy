const User = require('../models/User');
const crypto = require('crypto');

const ROLE = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  ASSISTANT: 'ASSISTANT',
  STUDENT: 'STUDENT',
};

const ASSISTANT_CODE_LENGTH = 8;

function normalizeCode(input) {
  return String(input || '').trim().toUpperCase();
}

function hashAssistantCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function generateAssistantCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';

  for (let i = 0; i < ASSISTANT_CODE_LENGTH; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}

async function createUniqueAssistantCode() {
  // Retry a few times to guarantee uniqueness among teachers.
  for (let i = 0; i < 10; i += 1) {
    const code = generateAssistantCode();
    const assistantCodeHash = hashAssistantCode(code);

    // eslint-disable-next-line no-await-in-loop
    const exists = await User.exists({ role: ROLE.TEACHER, assistantCodeHash });
    if (!exists) {
      return { code, assistantCodeHash };
    }
  }

  throw new Error('Failed to generate unique assistant code');
}

// REGISTER
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (role && role !== ROLE.STUDENT) {
      return res.status(403).json({
        message: 'Only student self-registration is allowed',
      });
    }

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: 'Email already exists' });

    const user = await User.create({
      name,
      email,
      passwordHash: password,
      role: ROLE.STUDENT,
    });

    user.passwordHash = undefined;
    res.status(201).json(user);

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// REGISTER ASSISTANT WITH TEACHER CODE
exports.registerAssistant = async (req, res) => {
  try {
    const { name, email, password, assistantCode } = req.body;
    const normalizedCode = normalizeCode(assistantCode);

    if (!/^[A-Z0-9]{8}$/.test(normalizedCode)) {
      return res.status(400).json({ message: 'Invalid assistant code' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const teacher = await User.findOne({
      role: ROLE.TEACHER,
      assistantCodeHash: hashAssistantCode(normalizedCode),
    });

    if (!teacher) {
      return res.status(400).json({ message: 'Invalid assistant code' });
    }

    const user = await User.create({
      name,
      email,
      passwordHash: password,
      role: ROLE.ASSISTANT,
      assistantTeacherId: teacher._id,
    });

    user.passwordHash = undefined;
    res.status(201).json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ADMIN CREATE TEACHER (ADMIN-ONLY VIA SECRET)
exports.createTeacher = async (req, res) => {
  try {
    const adminSecret = req.header('x-admin-secret');
    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ message: 'Admin authorization required' });
    }

    const { name, email, password, assistantCode } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    let code;
    let assistantCodeHash;
    const normalizedProvidedCode = normalizeCode(assistantCode);

    if (normalizedProvidedCode) {
      if (!/^\d{8}$/.test(normalizedProvidedCode)) {
        return res.status(400).json({ message: 'Teacher assistant key must be 8 digits' });
      }

      assistantCodeHash = hashAssistantCode(normalizedProvidedCode);
      const existingCode = await User.exists({ role: ROLE.TEACHER, assistantCodeHash });
      if (existingCode) {
        return res.status(400).json({ message: 'Teacher assistant key already exists' });
      }

      code = normalizedProvidedCode;
    } else {
      const generated = await createUniqueAssistantCode();
      code = generated.code;
      assistantCodeHash = generated.assistantCodeHash;
    }

    const user = await User.create({
      name,
      email,
      passwordHash: password,
      role: ROLE.TEACHER,
      assistantCodeHash,
      assistantCode: code,
    });

    res.status(201).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      assistantCode: code,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ADMIN CREATE ADMIN (ADMIN-ONLY VIA SECRET)
exports.createAdmin = async (req, res) => {
  try {
    const adminSecret = req.header('x-admin-secret');
    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ message: 'Admin authorization required' });
    }

    const { name, email, password } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const user = await User.create({
      name,
      email,
      passwordHash: password,
      role: ROLE.ADMIN,
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// LOGIN
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user)
      return res.status(400).json({ message: 'Invalid credentials' });

    const match = await user.matchPassword(password);

    if (!match)
      return res.status(400).json({ message: 'Invalid credentials' });

    user.passwordHash = undefined;
    res.json(user);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET assistants linked to a teacher
exports.getTeacherAssistants = async (req, res) => {
  try {
    const { teacherId } = req.params;

    const teacher = await User.findOne({ _id: teacherId, role: ROLE.TEACHER });
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const assistants = await User.find({
      role: ROLE.ASSISTANT,
      assistantTeacherId: teacherId,
    }).select('name email role assistantTeacherId createdAt');

    res.json(assistants);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// GET assistant code for a teacher
exports.getTeacherAssistantCode = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const teacher = await User.findOne({ _id: teacherId, role: ROLE.TEACHER }).select('+assistantCode +assistantCodeHash');

    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    if (!teacher.assistantCode || !teacher.assistantCodeHash) {
      const generated = await createUniqueAssistantCode();
      teacher.assistantCode = generated.code;
      teacher.assistantCodeHash = generated.assistantCodeHash;
      await teacher.save();
    }

    return res.json({ assistantCode: teacher.assistantCode });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

// GET all users
exports.getUsers = async (req, res) => {
  const users = await User.find();
  res.json(users);
};

// GET single user
exports.getUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
};
