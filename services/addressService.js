import Address from "../models/Address.js";
import { parseInternationalPhone } from "../utils/phone.js";
import { serializeAddress } from "../utils/serializers.js";

export async function getAddress(userId) {
  return serializeAddress(await Address.findOne({ userId }));
}

export async function saveAddress(userId, data) {
  const phone = parseInternationalPhone(data.phone);
  const address = await Address.findOneAndUpdate(
    { userId },
    { $set: { ...data, phone: `${phone.countryCode} ${phone.phone}` } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return serializeAddress(address);
}
