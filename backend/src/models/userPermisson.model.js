const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");

const userPermissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Permission" }],
  },
  { timestamps: true },
);

userPermissionSchema.plugin(tenantPlugin);
module.exports =
  mongoose.models.UserPermission ||
  mongoose.model("UserPermission", userPermissionSchema);
