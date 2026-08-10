const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/sales_dashboard";
    const dbName = process.env.MONGODB_DB || "sales_dashboard";
    const conn = await mongoose.connect(mongoUri, { dbName });
    console.log(
      `MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`,
    );
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
// Database connection configured
