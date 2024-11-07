'use client'

import React from 'react';
import SpeedTestHistory from './components/SpeedTestHistory';
import DashboardLayout from "@/app/dashboard/DashboardLayout";


const HistoryPage: React.FC = () => {
    return (
        <DashboardLayout>
            <div>
                <h1>Speed Test History</h1>
                <SpeedTestHistory/>
            </div>
        </DashboardLayout>
    );
};

export default HistoryPage;
