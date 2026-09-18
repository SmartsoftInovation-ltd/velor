const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");
const { dbConfig } = require("../constant/constant");
const { isProduction } = require("../config/nodeEnv");
const dbConnect = async () => {
  try {
    // Production indexes are built by migration scripts, never implicitly on boot
    const conn = await mongoose.connect(`${process.env.DATABASE_URL}`, {
      autoIndex: !isProduction(),
    });
    console.log(conn.connection.host, " 🚀🚀🚀 database connected 🚀🚀");
  } catch (error) {
    console.error("Database connection error:", error.message);
    throw new customError("Database connection error", 500);
  }
};

module.exports = { dbConnect };
