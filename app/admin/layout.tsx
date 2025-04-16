import AdminLayout from "./AdminLayout";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <AdminLayout>{children}</AdminLayout>;
}
