import React from 'react';
import { UserAccount } from "@/components/auth/user/userAccount";
import DashboardLayout from '../DashboardLayout'

const UserPage = () => {
    return (
        <DashboardLayout>
                <UserAccount/>
        </DashboardLayout>
    );
}

export default UserPage;
