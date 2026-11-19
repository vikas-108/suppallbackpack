import mongoose from "mongoose";

export async function connectDatabase(uri) {
  if (!uri) throw new Error("MONGODB_URI is required to connect to the database.");
  mongoose.set("strictQuery", true);

  // Keep the driver's default pool for this single-process, low-volume app; tune it only from Atlas metrics.
  await mongoose.connect(uri);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
