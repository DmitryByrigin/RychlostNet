"use server";

import { db } from "@/lib/db";
import { getUserByEmail } from "@/data/user";
import { getVerificationTokenByToken } from "@/data/verificiation-token";

export const newVerification = async (token: string) => {
  console.log("token:", token)
  const existingToken = await getVerificationTokenByToken(token);
  console.log("existingToken:", existingToken)
  if (!existingToken) {
    return { error: "Token does not exist!" };
  }

  const hasExpired = new Date(existingToken.expires) < new Date();

  if (hasExpired) {
    return { error: "Token has expired!" };
  }

  const existingUser = await getUserByEmail(existingToken.email);

  if (!existingUser) {
    return { error: "Email does not exist!" };
  }

  await db.user.update({
    where: { id: existingUser.id },
    data: {
      emailVerified: new Date(),
      email: existingToken.email,
    }
  });

  setTimeout(async () => {
    try {
      await db.verificationToken.delete({
        where: { id: existingToken.id }
      });
    } catch (error) {
      // Use a type assertion to tell TypeScript that error is of type any
      const err = error as any;
      if (err.code !== 'P2025') {
        throw err;
      }
      // Ignore error if token does not exist
    }
  }, 5000);

  return { success: "Email verified!" };

};
