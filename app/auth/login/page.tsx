'use client';

import {useForm} from '@mantine/form';
import {
    Anchor,
    Button,
    Center,
    Divider,
    Group,
    Notification,
    Paper,
    PaperProps as OriginalPaperProps,
    PasswordInput,
    PinInput,
    Stack,
    Text,
    TextInput,
} from '@mantine/core'
import {Social} from "@/components/auth/social";

import * as z from "zod";
import React, {useState, useTransition} from "react";


import {LoginSchema, NotificationProps} from "@/schemas";
import {useSearchParams} from "next/navigation";
import {login} from "@/actions/login";
import Link from "next/link";

interface PaperProps extends OriginalPaperProps {
    searchParams?: any;
}

export default function AuthenticationForm(props: PaperProps) {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl");
    const urlError = searchParams.get("error") === "OAuthAccountNotLinked"
        ? "Email already in use with different provider!"
        : "";

    const [showTwoFactor, setShowTwoFactor] = useState(false);
    const [error, setError] = useState<string | undefined>("");
    const [success, setSuccess] = useState<string | undefined>("");
    const [isPending, startTransition] = useTransition();

    const form = useForm({
        initialValues: {
            email: '',
            name: '',
            password: '',
            code: '',
        },
        validate: values => {
            const result = LoginSchema.safeParse(values);
            if (!result.success) {
                return result.error.formErrors.fieldErrors;
            }
            return {};
        },
    });

    const onSubmit = (values: z.infer<typeof LoginSchema>) => {
        setError("");
        setSuccess("");

        startTransition(() => {
            login(values, callbackUrl)
                .then((data) => {
                    if (data?.error) {
                        form.reset();
                        setError(data.error);
                    }

                    if (data?.success) {
                        form.reset();
                        setSuccess(data.success);
                    }

                    if (data?.twoFactor) {
                        setShowTwoFactor(true);
                    }
                })
                .catch(() => setError("Something went wrong"));
        });
    };

    const {searchParams: _, ...paperProps} = props;

    function DisplayNotification({message, color}: NotificationProps) {
        return message && <Notification withCloseButton={false} color={color}>{message}</Notification>;
    }

    const notifications = [
        {message: error, color: "red"},
        {message: urlError, color: "red"},
        {message: success, color: "green"},
    ];


    return (
        <Center style={{height: '100vh'}}>
            <Paper radius="md" p="xl" withBorder {...paperProps}>
                <Text size="lg" fw={500}>
                    Welcome to RýchlosťNet, login with
                </Text>


                <Social/>


                <Divider label="Or continue with email" labelPosition="center" my="lg"/>

                <form onSubmit={form.onSubmit(onSubmit)}>
                    {showTwoFactor && (
                        <Stack>
                            <PinInput
                                length={6}
                                value={form.values.code}
                                onChange={(value: string) => form.setFieldValue('code', value)}
                                error={!!form.errors.code || undefined}
                                radius="md"
                            />
                        </Stack>
                    )}


                    {!showTwoFactor && (
                        <Stack>
                            <TextInput
                                withAsterisk
                                label="Email"
                                placeholder="hello@mantine.dev"
                                value={form.values.email}
                                onChange={(event) => form.setFieldValue('email', event.currentTarget.value)}
                                error={form.errors.email && 'Invalid email'}
                                radius="md"
                                autoComplete="email"
                            />

                            <PasswordInput
                                withAsterisk
                                label="Password"
                                placeholder="Your password"
                                value={form.values.password}
                                onChange={(event) => form.setFieldValue('password', event.currentTarget.value)}
                                error={form.errors.password && 'Password should include at least 6 characters'}
                                radius="md"
                                autoComplete="password"
                            />

                        </Stack>
                    )}
                    <Group justify="space-between" mt="lg">
                        <Anchor
                            component={Link}
                            href="/auth/reset"
                            type="button"
                            c="dimmed"
                            size="xs"
                        >

                            Forgot password?
                        </Anchor>
                    </Group>


                    {notifications.map((notification, index) =>
                        <DisplayNotification key={index} message={notification.message} color={notification.color}/>
                    )}

                    <Group justify="space-between" mt="xl">
                        <Anchor
                            component={Link}
                            href="/auth/register"
                            type="button"
                            c="dimmed"
                            size="xs"
                        >

                            Dont have an account? Register
                        </Anchor>
                        <Button type="submit" radius="xl" disabled={isPending}>
                            {showTwoFactor ? "Confirm" : "Login"}
                        </Button>
                    </Group>
                </form>
            </Paper>
        </Center>
    );
}
