const User = require('../models/User');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ROLE = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  ASSISTANT: 'ASSISTANT',
  STUDENT: 'STUDENT',
};

const ASSISTANT_CODE_LENGTH = 8;
const SUBSCRIPTION_STATUS = {
  TRIAL: 'TRIAL',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELED: 'CANCELED',
};

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

function addMonths(date, months) {
  const base = new Date(date);
  const d = new Date(base);
  const targetMonth = d.getMonth() + Number(months);
  d.setMonth(targetMonth);
  if (d.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    d.setDate(0);
  }
  return d;
}

function signAuthToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT secret is not configured');
  }

  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    },
    secret,
    { expiresIn: '7d' }
  );
}

async function refreshTeacherSubscriptionStatus(user) {
  if (user.role !== ROLE.TEACHER) return user;
  if (
    user.subscriptionEndDate &&
    [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIAL].includes(
      user.subscriptionStatus
    ) &&
    new Date() > new Date(user.subscriptionEndDate)
  ) {
    user.subscriptionStatus = SUBSCRIPTION_STATUS.PAST_DUE;
    await user.save();
  }
  return user;
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
    const token = signAuthToken(user);
    res.status(201).json({ user, token });

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
    const token = signAuthToken(user);
    res.status(201).json({ user, token });
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

    const startDate = new Date();
    const endDate = addMonths(startDate, 1);

    const user = await User.create({
      name,
      email,
      passwordHash: password,
      role: ROLE.TEACHER,
      assistantCodeHash,
      assistantCode: code,
      subscriptionStatus: SUBSCRIPTION_STATUS.TRIAL,
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
    });

    res.status(201).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionStartDate: user.subscriptionStartDate,
        subscriptionEndDate: user.subscriptionEndDate,
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

    await refreshTeacherSubscriptionStatus(user);
    const token = signAuthToken(user);
    user.passwordHash = undefined;
    res.json({ user, token });

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
  await Promise.all(users.map((u) => refreshTeacherSubscriptionStatus(u)));
  res.json(users);
};

// ADMIN UPDATE TEACHER SUBSCRIPTION
exports.updateTeacherSubscription = async (req, res) => {
  try {
    const adminSecret = req.header('x-admin-secret');
    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ message: 'Admin authorization required' });
    }

    const { status, months } = req.body;
    const teacher = await User.findOne({ _id: req.params.id, role: ROLE.TEACHER });
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    if (!Object.values(SUBSCRIPTION_STATUS).includes(status)) {
      return res.status(400).json({ message: 'Invalid subscription status' });
    }

    const now = new Date();
    teacher.subscriptionStatus = status;

    if (status === SUBSCRIPTION_STATUS.ACTIVE || status === SUBSCRIPTION_STATUS.TRIAL) {
      const durationMonths = Number(months || 1);
      teacher.subscriptionStartDate = now;
      teacher.subscriptionEndDate = addMonths(now, durationMonths);
    } else if (status === SUBSCRIPTION_STATUS.CANCELED) {
      teacher.subscriptionEndDate = now;
    }

    await teacher.save();
    res.json({
      _id: teacher._id,
      subscriptionStatus: teacher.subscriptionStatus,
      subscriptionStartDate: teacher.subscriptionStartDate,
      subscriptionEndDate: teacher.subscriptionEndDate,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// GET single user
exports.getUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
};
