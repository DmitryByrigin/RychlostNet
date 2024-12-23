'use client';

import { useForm } from "@mantine/form";
import { z } from "zod";
import { Avatar, Button, NativeSelect, Notification, PasswordInput, Space, Switch, TextInput } from '@mantine/core';
import { NotificationProps, SettingsSchema } from "@/schemas";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { settings } from "@/actions/settings";
import { IconBadge, IconKey, IconLock, IconMail, IconUser } from '@tabler/icons-react';
import classes from "./userAccount.module.scss";

const DisplayNotification = ({ message, color }: NotificationProps) => (
    message ? <Notification withCloseButton={false} color={color}>{message}</Notification> : null
);

export function UserAccount() {
    const user = useCurrentUser();
    const [error, setError] = useState<string | undefined>();
    const [success, setSuccess] = useState<string | undefined>();
    const { update } = useSession();
    const [isPending, startTransition] = useTransition();

    const form = useForm<z.infer<typeof SettingsSchema>>({
        initialValues: {
            password: undefined,
            newPassword: undefined,
            name: user?.name || '',
            email: user?.email || '',
            role: user?.role || 'USER',
            isTwoFactorEnabled: user?.isTwoFactorEnabled || false,
        },
        validate: values => {
            const result = SettingsSchema.safeParse(values);
            return result.success ? {} : result.error.formErrors.fieldErrors;
        },
    });

    const onSubmit = async (values: z.infer<typeof SettingsSchema>) => {
        startTransition(() => {
            settings(values)
                .then(async (data) => {
                    if (data.error) {
                        setError(data.error);
                    }
                    if (data.success) {
                        await update();
                        setSuccess(data.success);
                    }
                })
                .catch(() => setError('Something went wrong!'));
        });
    };

    const notifications = [
        { message: error, color: "red" },
        { message: success, color: "green" },
    ];

    return (
        <form onSubmit={form.onSubmit(onSubmit)}>
            <div className={classes.userAccountFormContainer}>
                <div>
                    <Avatar src={user?.image || null} alt="User avatar" size="340" />
                </div>

                <Space h="md" />

                <div className={classes.fullWidth}>
                    <TextInput
                        label="Name"
                        radius="md"
                        leftSection={<IconUser stroke={1.5} size="1rem" className="icon" />}
                        {...form.getInputProps('name')}
                        mb="xs"
                    />

                    {user?.isOAuth === false && (
                        <>
                            <TextInput
                                radius="md"
                                mb="xs"
                                label="Email"
                                leftSection={<IconMail stroke={1.5} size="1rem" className="icon" />}
                                {...form.getInputProps('email')}
                            />
                            <PasswordInput
                                radius="md"
                                mb="xs"
                                label="Password"
                                placeholder="******"
                                leftSection={<IconLock stroke={1.5} size="1rem" className="icon" />}
                                {...form.getInputProps('password')}
                            />
                            <PasswordInput
                                radius="md"
                                mb="xs"
                                label="New Password"
                                placeholder="******"
                                leftSection={<IconKey stroke={1.5} size="1rem" className="icon" />}
                                {...form.getInputProps('newPassword')}
                            />
                        </>
                    )}

                    <NativeSelect
                        radius="md"
                        mb="xs"
                        label="Role"
                        leftSection={<IconBadge stroke={1.5} size="1rem" className="icon" />}
                        data={['ADMIN', 'USER']}
                        {...form.getInputProps('role')}
                    />

                    {user?.isOAuth === false && (
                        <Switch
                            size="md"
                            mt="xs"
                            mb="xs"
                            label="Enable Two-Factor Authentication"
                            onLabel="ON"
                            offLabel="OFF"
                            {...form.getInputProps('isTwoFactorEnabled', { type: 'checkbox' })}
                        />
                    )}

                    {notifications.map((notification, index) =>
                        <DisplayNotification key={index} message={notification.message} color={notification.color} />
                    )}

                    <Button mt="xs" type="submit" disabled={isPending}>Save Changes</Button>
                </div>
            </div>
        </form>
    );
}

