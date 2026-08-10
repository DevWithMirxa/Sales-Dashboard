require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");

// Connect to Database
connectDB();

const app = express();

// Middleware
const corsOptions = {
  origin: true, // dynamically reflect request origin
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "ngrok-skip-browser-warning",
  ],
  optionsSuccessStatus: 200, // support legacy browsers
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Defines Routes (Will add them slowly)
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/customers", require("./routes/customerRoutes"));
app.use("/api/salesmen", require("./routes/salesmanRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/regions", require("./routes/regionRoutes"));
app.use("/api/targets", require("./routes/targetRoutes"));
app.use("/api/trends", require("./routes/trends"));
app.use("/api/directory", require("./routes/directory"));

app.get("/", (req, res) => {
  res.send("Sales Dashboard API is running");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
