"use client";

import * as z from "zod";
import {useForm} from "react-hook-form";
import {useState, useTransition} from "react";
import {zodResolver} from "@hookform/resolvers/zod";

import {NotificationProps, ResetSchema} from "@/schemas";

import {reset} from "@/actions/reset";
import {Anchor, Button, Center, Group, Notification, Paper, Space, Text, TextInput} from "@mantine/core";
import Link from "next/link";

export const ResetForm = () => {
    const [error, setError] = useState<string | undefined>("");
    const [success, setSuccess] = useState<string | undefined>("");
    const [isPending, startTransition] = useTransition();

    const form = useForm<z.infer<typeof ResetSchema>>({
        resolver: zodResolver(ResetSchema),
        defaultValues: {
            email: "",
        },
    });

    const onSubmit = (values: z.infer<typeof ResetSchema>) => {
        console.log(values)
        setError("");
        setSuccess("");

        startTransition(() => {
            reset(values)
                .then((data) => {
                    console.log(data)
                    setError(data?.error);
                    setSuccess(data?.success);
                });
        });
    };

    function DisplayNotification({message, color}: NotificationProps) {
        return message && <Notification withCloseButton={false} color={color}>{message}</Notification>;
    }

    const notifications = [
        {message: error, color: "red"},
        {message: success, color: "green"},
    ];

    return (
        <Center style={{height: '100vh'}}>
            <Paper radius="md" p="xl">
                <Text size="lg" fw={500}>
                    Forgot your password?
                </Text>
                <Space h={20}/>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <TextInput
                        withAsterisk
                        label="Email"
                        placeholder="hello@mantine.dev"
                        value={form.watch('email')}
                        onChange={(event) => form.setValue('email', event.currentTarget.value)}
                        error={form.formState.errors.email && 'Invalid email'}
                        radius="md"
                        mb="sm"
                        autoComplete="email"
                    />

                    {notifications.map((notification, index) =>
                        <DisplayNotification key={index} message={notification.message} color={notification.color}/>
                    )}

                    <Group justify="space-between" mt="lg">
                        <Anchor
                            component={Link}
                            href="/auth/login"
                            type="button"
                            c="dimmed"
                            size="xs"
                        >

                            Back to the login page
                        </Anchor>
                        <Button type="submit" radius="xl" disabled={isPending}>Reset password</Button>
                    </Group>

                </form>
            </Paper>
        </Center>
    );
};







