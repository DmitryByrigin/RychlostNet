import { DashboardHeader } from "../dashboard/DashboardHeader/DashboardHeader";
import React from "react";
import { Container } from "@mantine/core";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  return (
    <>
      <Container size="100rem">
        <DashboardHeader />
        {children}
      </Container>
    </>
  );
};

export default AdminLayout;
