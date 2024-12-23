"use client";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Group } from "@mantine/core";
import { IconBrandGoogleFilled, IconBrandGithub } from "@tabler/icons-react";

export const Social = () => {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard/speedtest";
    const onClick = async (provider: "google" | "github") => {
        try {
            await signIn(provider, {
                callbackUrl: callbackUrl,
            });
        } catch (error) {
            console.error("Error during sign-in", error);
        }
    };

    return (
        <Group grow mb="md" mt="md">
            <Button radius="xl" onClick={() => onClick("google")}>
                <IconBrandGoogleFilled />
            </Button>
            <Button radius="xl" onClick={() => onClick("github")}>
                <IconBrandGithub />
            </Button>
        </Group>
    );
};
