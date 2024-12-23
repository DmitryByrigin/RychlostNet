"use client"

import * as z from "zod";
import {startTransition, useState} from 'react';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {NewPasswordSchema} from '@/schemas';
import {newPassword} from '@/actions/new-password';
import {Anchor, Button, Container, Group, Notification, Paper, PasswordInput, Text, TextInput} from '@mantine/core';
import classes from "@/components/auth/newVerification/newVerification.module.scss";
import Link from "next/link";
import {useSearchParams} from "next/navigation";

export const NewPasswordForm = () => {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const [error, setError] = useState<string | undefined>('');
    const [success, setSuccess] = useState<string | undefined>('');

    const form = useForm<z.infer<typeof NewPasswordSchema>>({
        resolver: zodResolver(NewPasswordSchema),
        defaultValues: {
            password: "",
        },
    });

    const onSubmit = (values: z.infer<typeof NewPasswordSchema>) => {
        setError("");
        setSuccess("");

        startTransition(() => {
            newPassword(values, token)
                .then((data) => {
                    setError(data?.error);
                    setSuccess(data?.success);
                });
        });
    };

    return (
        <Container size="md">
            <div className={classes.inner}>
                <div className={classes.content}>
                    <Paper>
                        <Text size="lg" style={{fontWeight: 500, padding: '1rem'}}>
                            Reset Your Password
                        </Text>

                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <PasswordInput
                                withAsterisk
                                label="New Password"
                                value={form.watch('password')}
                                {...form.register('password')}
                                placeholder="******"
                                error={form.formState.errors.password?.message}
                                radius="md"
                                mb="sm"
                            />

                            {error && <Notification withCloseButton={false} color="red">{error}</Notification>}
                            {success && <Notification withCloseButton={false} color="green">{success}</Notification>}

                            <Group justify="space-between" mt="xl">
                                <Anchor
                                    component={Link}
                                    href="/auth/login"
                                    type="button"
                                    c="dimmed"
                                    size="xs"
                                >

                                    Back to login
                                </Anchor>
                                <Button type="submit" radius="xl">Reset Password</Button>

                            </Group>
                        </form>
                    </Paper>
                </div>
            </div>
        </Container>
    );
};
