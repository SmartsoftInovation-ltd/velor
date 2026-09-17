const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

// Platform operators (you and your team). Deliberately separate from the tenant
// User collection so no tenant query can ever return a platform account.
const platformUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    // superadmin: full control; support: read-only
    role: { type: String, enum: ["superadmin", "support"], default: "support" },
    isActive: { type: Boolean, default: true },
    // Incremented to revoke every issued platform token (logout, password change, deactivation)
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.twoFactorSecret;
        return ret;
      },
    },
  },
);

platformUserSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

platformUserSchema.methods.comparePassword = async function (candidate) {
  if (!this.password || !candidate) return false;
  return bcrypt.compare(candidate, this.password);
};

module.exports =
  mongoose.models.PlatformUser || mongoose.model("PlatformUser", platformUserSchema);
