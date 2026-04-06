const User = require('../models/User');
const Classroom = require('../models/Classroom');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { isSmtpConfigured, sendPasswordResetEmail } = require('../services/emailService');

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

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const REFRESH_COOKIE_NAME = 'refreshToken';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function signAccessToken(user) {
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
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

function generateRefreshToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT secret is not configured');
  }

  return jwt.sign({ userId }, secret, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

function getRefreshTokenFromRequest(req) {
  if (req.cookies && req.cookies[REFRESH_COOKIE_NAME]) {
    return req.cookies[REFRESH_COOKIE_NAME];
  }
  const cookieHeader = req.headers.cookie || '';
  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${REFRESH_COOKIE_NAME}=`))
    ?.split('=')[1];
}

function setRefreshTokenCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

function clearRefreshTokenCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

exports.refreshTokenHandler = async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);

    if (!refreshToken) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT secret is not configured');
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, secret);
    } catch (err) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const accessToken = signAccessToken(user);
    return res.json({ accessToken });
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function buildPasswordResetUrl(token) {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
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
    const accessToken = signAccessToken(user);
    const refreshToken = generateRefreshToken(user._id.toString());
    setRefreshTokenCookie(res, refreshToken);
    res.status(201).json({ user, accessToken });

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
    const accessToken = signAccessToken(user);
    const refreshToken = generateRefreshToken(user._id.toString());
    setRefreshTokenCookie(res, refreshToken);
    res.status(201).json({ user, accessToken });
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

    if (!user) {
      return res.status(404).json({ message: 'No account was found for this email address.' });
    }

    const match = await user.matchPassword(password);

    if (!match) {
      return res.status(401).json({ message: 'The password you entered is incorrect.' });
    }

    await refreshTeacherSubscriptionStatus(user);
    const accessToken = signAccessToken(user);
    const refreshToken = generateRefreshToken(user._id.toString());
    user.passwordHash = undefined;
    setRefreshTokenCookie(res, refreshToken);
    res.json({ user, accessToken });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.continueWithGoogle = async (req, res) => {
  try {
    const credential = String(req.body?.credential || '').trim();
    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required.' });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ message: 'Google client ID is not configured.' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ message: 'Invalid Google credential.' });
    }

    const email = String(payload.email || '').trim().toLowerCase();
    const name = String(payload.name || payload.given_name || 'Student').trim();
    const googleId = String(payload.sub || '').trim();

    if (!email || !googleId) {
      return res.status(400).json({ message: 'Google account is missing required information.' });
    }

    let user = await User.findOne({ email });
    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString('hex');
      user = await User.create({
        name,
        email,
        passwordHash: randomPassword,
        role: ROLE.STUDENT,
        googleId,
      });
    } else if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }

    await refreshTeacherSubscriptionStatus(user);
    const accessToken = signAccessToken(user);
    const refreshToken = generateRefreshToken(user._id.toString());
    user.passwordHash = undefined;
    setRefreshTokenCookie(res, refreshToken);
    return res.json({ user, accessToken });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

exports.logout = async (req, res) => {
  clearRefreshTokenCookie(res);
  res.json({ message: 'Logged out' });
};

exports.getMe = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(userId).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(user);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email }).select('+passwordResetTokenHash +passwordResetExpiresAt');

    if (!user) {
      return res.status(404).json({
        message: 'This email is incorrect. Please check it again or register if you do not have an account.',
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetTokenHash = hashResetToken(rawToken);
    user.passwordResetExpiresAt = new Date(Date.now() + 1000 * 60 * 30);
    await user.save();

    const resetUrl = buildPasswordResetUrl(rawToken);
    console.log(`[ForgotPassword] Reset link for ${email}: ${resetUrl}`);

    if (!isSmtpConfigured()) {
      return res.status(503).json({
        message: 'Password reset email is not configured on the server.',
      });
    }

    try {
      await sendPasswordResetEmail({ to: user.email, resetUrl });
    } catch (err) {
      console.error('[ForgotPassword] Failed to send reset email:', err.message);
      return res.status(502).json({
        message: 'We could not send the reset email right now. Please try again later.',
      });
    }

    return res.json({
      message: 'A password reset link was sent.',
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');

    if (!token) {
      return res.status(400).json({ message: 'Reset token is required.' });
    }

    if (!password) {
      return res.status(400).json({ message: 'Password is required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const user = await User.findOne({
      passwordResetTokenHash: hashResetToken(token),
      passwordResetExpiresAt: { $gt: new Date() },
    }).select('+passwordHash +passwordResetTokenHash +passwordResetExpiresAt');

    if (!user) {
      return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });
    }

    user.passwordHash = password;
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();

    return res.json({ message: 'Your password has been reset successfully.' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET assistants linked to a teacher
exports.getTeacherAssistants = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.max(parseInt(req.query.limit || '8', 10), 1);
    const skip = (page - 1) * limit;

    const teacher = await User.findOne({ _id: teacherId, role: ROLE.TEACHER });
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    const total = await User.countDocuments({
      role: ROLE.ASSISTANT,
      assistantTeacherId: teacherId,
    });

    const assistants = await User.find({
      role: ROLE.ASSISTANT,
      assistantTeacherId: teacherId,
    })
      .select('name email role assistantTeacherId createdAt')
      .skip(skip)
      .limit(limit);

    res.set('X-Total-Count', total.toString());
    res.set('X-Page', page.toString());
    res.set('X-Limit', limit.toString());

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

// REMOVE assistant linked to a teacher
exports.removeTeacherAssistant = async (req, res) => {
  try {
    const { teacherId, assistantId } = req.params;
    const requesterId = req.user?.userId?.toString();
    const requesterRole = req.user?.role;

    const teacher = await User.findOne({ _id: teacherId, role: ROLE.TEACHER });
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    if (
      requesterRole !== ROLE.ADMIN &&
      !(requesterRole === ROLE.TEACHER && teacher._id.toString() === requesterId)
    ) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const assistant = await User.findOne({
      _id: assistantId,
      role: ROLE.ASSISTANT,
      assistantTeacherId: teacherId,
    });

    if (!assistant) {
      return res.status(404).json({ message: 'Assistant not found for this teacher' });
    }

    await Classroom.updateMany(
      { teacherId, assistantIds: assistant._id },
      { $pull: { assistantIds: assistant._id } }
    );

    assistant.assistantTeacherId = null;
    await assistant.save();

    return res.json({ message: 'Assistant removed successfully' });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

// GET all users
exports.getUsers = async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.max(parseInt(req.query.limit || '8', 10), 1);
  const skip = (page - 1) * limit;
  const total = await User.countDocuments();
  const users = await User.find().skip(skip).limit(limit);
  await Promise.all(users.map((u) => refreshTeacherSubscriptionStatus(u)));
  res.set('X-Total-Count', total.toString());
  res.set('X-Page', page.toString());
  res.set('X-Limit', limit.toString());
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
