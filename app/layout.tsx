import "@mantine/core/styles.css";
import React from "react";
import {ColorSchemeScript, MantineProvider} from "@mantine/core";
import {theme} from "@/theme";
import {SessionProvider} from 'next-auth/react'
import {auth} from '@/auth'
import '@/styles/global.css';

export const metadata = {
    title: "OdmerajSi - Internet Speed Test",
    description: "Web application for measuring internet speed",
};

export default async function RootLayout({children}: { children: any }) {
    const session = await auth();
    return (
        <SessionProvider session={session}>
            <html lang="en">
            <head>
                <ColorSchemeScript/>
                <link rel="shortcut icon" href="/favicon.svg"/>
                <meta
                    name="viewport"
                    content="minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no"
                />
            </head>
            <body>
            <MantineProvider theme={theme}>{children}</MantineProvider>
            </body>
            </html>
        </SessionProvider>
    );
}
