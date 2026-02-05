const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['TEACHER', 'ASSISTANT', 'STUDENT'],
      default: 'STUDENT',
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// Hash password BEFORE save (NO next)
userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) return;

  if (this.passwordHash.startsWith('$2')) return;

  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

// Compare password
userSchema.methods.matchPassword = async function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);
