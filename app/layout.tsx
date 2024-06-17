import "@mantine/core/styles.css";
import React from "react";
import {MantineProvider, ColorSchemeScript, Center} from "@mantine/core";
import { theme } from "../theme";

export const metadata = {
  title: "RýchlosťNet - meranie rýchlosti pripojenia",
  description: "Webová aplikácia na meranie rýchlosti internetu",
};

export default function RootLayout({ children }: { children: any }) {
  return (
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
      <MantineProvider theme={theme}>
              {children}
      </MantineProvider>
      </body>
      </html>
  );
}
