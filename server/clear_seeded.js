require('dotenv').config();
const connectDB = require('./config/db');
const Customer = require('./models/Customer');

async function clearSeeded() {
  await connectDB();
  const result = await Customer.deleteMany({
    $or: [
      { businessType: "Feed Mill" },
      { businessType: "Sales Team" }
    ],
    createdAt: { $lt: new Date('2026-08-05') }
  });
  console.log('Deleted:', result.deletedCount);
  process.exit(0);
}

clearSeeded();
