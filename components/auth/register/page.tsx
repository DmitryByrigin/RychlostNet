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
    PasswordInput,
    Stack,
    Text,
    TextInput,
} from '@mantine/core';
import { PaperProps as OriginalPaperProps } from '@mantine/core';
import {Social} from "@/components/auth/social";

import * as z from "zod";
import {useState, useTransition} from "react";


import {register} from "@/actions/register";
import {useSearchParams} from "next/navigation";
import {NotificationProps, RegisterSchema} from "@/schemas";
import Link from "next/link";

interface PaperProps extends OriginalPaperProps {
    searchParams?: any;
}

export default function RegisterPage(props: PaperProps) {
    const searchParams = useSearchParams();
    const urlError = searchParams.get("error") === "OAuthAccountNotLinked"
        ? "Email already in use with different provider!"
        : "";

    const [error, setError] = useState<string | undefined>("");
    const [success, setSuccess] = useState<string | undefined>("");
    const [isPending, startTransition] = useTransition();

    const form = useForm({
        initialValues: {
            email: '',
            name: '',
            password: '',
        },
        validate: values => {
            const result = RegisterSchema.safeParse(values);
            if (!result.success) {
                return result.error.formErrors.fieldErrors;
            }
            return {};
        },
    });

    const onSubmit = (values: z.infer<typeof RegisterSchema>) => {
        setError("");
        setSuccess("");

        startTransition(() => {
            register(values)
                .then((data) => {
                    setError(data.error);
                    setSuccess(data.success);
                });
        });
    };

    const { searchParams: _, ...paperProps } = props;

    function DisplayNotification({ message, color }: NotificationProps) {
        return message && <Notification withCloseButton={false} color={color}>{message}</Notification>;
    }

    const notifications = [
        { message: error, color: "red" },
        { message: urlError, color: "red" },
        { message: success, color: "green" },
    ];

    return (
        <Center style={{height: '100vh'}}>
            <Paper radius="md" p="xl" withBorder {...paperProps}>
                <Text size="lg" fw={500}>
                    Welcome to <Text component={Link} href="/" style={{ fontWeight: 700, color: '#1c7ed6' }}>OdmerajSi</Text>, login with
                </Text>


                <Social/>


                <Divider label="Or continue with email" labelPosition="center" my="lg"/>

                <form onSubmit={form.onSubmit(onSubmit)}>

                    <Stack>

                        <TextInput
                            withAsterisk
                            label="Name"
                            placeholder="Your name"
                            value={form.values.name}
                            onChange={(event) => form.setFieldValue('name', event.currentTarget.value)}
                            error={form.errors.email && 'This field is mandatory'}
                            radius="md"
                            autoComplete="name"
                        />


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
                            mb={"sm"}
                            autoComplete="new-password"
                        />
                    </Stack>


                    {/*{error && <Notification withCloseButton={false} color="red">{error}</Notification>}*/}
                    {/*{urlError && <Notification withCloseButton={false} color="red">{urlError}</Notification>}*/}
                    {/*{success && <Notification withCloseButton={false} color="green">{success}</Notification>}*/}


                    {notifications.map((notification, index) =>
                        <DisplayNotification key={index} message={notification.message} color={notification.color} />
                    )}


                    <Group justify="space-between" mt="xl">
                        <Anchor
                            component={Link}
                            href="/auth/login"
                            type="button"
                            c="dimmed"
                            size="xs"
                        >

                            Already have an account? Login

                        </Anchor>
                        <Button type="submit" radius="xl" disabled={isPending}>
                            Register
                        </Button>
                    </Group>
                </form>
            </Paper>
        </Center>
    );
}
