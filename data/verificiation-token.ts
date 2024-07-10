import { db } from "@/lib/db";

export const getVerificationTokenByToken = async (
  token: string
) => {
  try {
    console.log("Token passed to function: ", token);
    const verificationToken = await db.verificationToken.findUnique({
      where: { token }
    });
    console.log("Token: ", verificationToken);
    console.log("verificationToken: ", verificationToken);
    return verificationToken;
  } catch {
    return null;
  }
}

export const getVerificationTokenByEmail = async (
  email: string
) => {
  try {
    const verificationToken = await db.verificationToken.findFirst({
      where: { email }
    });

    return verificationToken;
  } catch {
    return null;
  }
}
