"use client";

import { DEFAULT_LOGIN_REDIRECT } from "@/routes";
import {useSearchParams} from "next/navigation";
import { signIn } from "next-auth/react";
import {Button, Group} from "@mantine/core";
import {IconBrandGoogleFilled, IconBrandGithub} from "@tabler/icons-react";

export const Social = () => {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl");

    const onClick = (provider: "google" | "github") => {
        signIn(provider, {
            callbackUrl: callbackUrl || "/dashboard/speedtest",
        });
    }

    return (
        <Group grow mb="md" mt="md">
            <Button radius="xl" onClick={() => onClick("google")}>
                <IconBrandGoogleFilled/>
            </Button>
            <Button radius="xl" onClick={() => onClick("github")}>
                <IconBrandGithub/>
            </Button>
        </Group>
    );
};
