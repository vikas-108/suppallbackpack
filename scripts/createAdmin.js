import { env } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import User from "../models/User.js";
import { hashPassword } from "../services/authService.js";
import { normalizePhone, supportedCountryCodes } from "../utils/phone.js";
import { passwordSchema } from "../utils/validation.js";

async function createAdmin() {
  const { ADMIN_NAME, ADMIN_COUNTRY_CODE, ADMIN_PHONE, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME?.trim() || !ADMIN_COUNTRY_CODE || !ADMIN_PHONE || !ADMIN_PASSWORD) {
    throw new Error("Set ADMIN_NAME, ADMIN_COUNTRY_CODE, ADMIN_PHONE, and ADMIN_PASSWORD before running this command.");
  }
  if (!supportedCountryCodes.includes(ADMIN_COUNTRY_CODE)) {
    throw new Error("ADMIN_COUNTRY_CODE must be one of the supported country codes.");
  }
  const password = passwordSchema.parse(ADMIN_PASSWORD);
  const phone = normalizePhone(ADMIN_COUNTRY_CODE, ADMIN_PHONE);

  await connectDatabase(env.mongoUri);
  if (await User.exists({ role: "admin" })) {
    throw new Error("An administrator already exists; bootstrap can only create the initial administrator.");
  }
  await User.create({
    name: ADMIN_NAME.trim(),
    countryCode: ADMIN_COUNTRY_CODE,
    phone,
    passwordHash: await hashPassword(password),
    role: "admin",
    isActive: true
  });
  console.info("Initial administrator created. Remove the ADMIN_PASSWORD from the environment.");
}

createAdmin()
  .catch(error => {
    console.error("Administrator bootstrap failed.", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
