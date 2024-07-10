import {DashboardHeader} from './DashboardHeader/DashboardHeader';
import React from "react";
import {Container,} from '@mantine/core';


interface DashboardLayoutProps {
    children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({children}) => {
    return (
        <>

            <DashboardHeader/>
            <Container size="xl">
                {children}
            </Container>
        </>
    );
};

export default DashboardLayout;
