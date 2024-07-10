import React from 'react';
import { UserAccount } from "@/components/dashboard/User/UserAccount";
import DashboardLayout from '../DashboardLayout'

const UserPage = () => {
    return (
        <DashboardLayout>
                <UserAccount/>
        </DashboardLayout>
    );
}

export default UserPage;
