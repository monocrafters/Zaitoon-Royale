const mongoose = require("mongoose");

const connectDatabase = async () => {
  const mongoUri = "mongodb://carvistorsllc_db_user:Mohsin0307@ac-0smb7hu-shard-00-00.qwbqa2z.mongodb.net:27017,ac-0smb7hu-shard-00-01.qwbqa2z.mongodb.net:27017,ac-0smb7hu-shard-00-02.qwbqa2z.mongodb.net:27017/?authSource=admin&replicaSet=atlas-7j6x4z-shard-0&tls=true&retryWrites=true&w=majority&appName=Cluster0";

  try {
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully.");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
  }
};

module.exports = connectDatabase;
