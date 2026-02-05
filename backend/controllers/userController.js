const User = require('../models/User');

// REGISTER
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: 'Email already exists' });

    const user = await User.create({
      name,
      email,
      passwordHash: password,
      role
    });

    user.passwordHash = undefined;
    res.status(201).json(user);

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
