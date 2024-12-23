"use client";

import { logout } from "@/actions/logout";
import React from "react";

interface LogoutButtonProps {
  children?: React.ReactNode;
}

export const LogoutButton = ({ children }: LogoutButtonProps) => {
  const onClick = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  return (
      <span onClick={onClick} className="cursor-pointer">
      {children}
    </span>
  );
};
