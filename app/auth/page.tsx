'use client';

import {upperFirst, useToggle} from '@mantine/hooks';
import {useForm} from '@mantine/form';
import {
    Anchor,
    Button,
    Center,
    Checkbox,
    Divider,
    Group,
    Paper,
    PaperProps,
    PasswordInput,
    Space,
    Stack,
    Text,
    TextInput,
} from '@mantine/core';
import {IconBrandGoogleFilled, IconBrandX} from '@tabler/icons-react';

export function AuthenticationForm(props: PaperProps) {
    const [type, toggle] = useToggle(['login', 'register', 'forgotPassword']);
    const form = useForm({
        initialValues: {
            email: '',
            name: '',
            password: '',
            terms: true,
        },

        validate: {
            email: (val) => (/^\S+@\S+$/.test(val) ? null : 'Invalid email'),
            password: (val) => (val.length <= 6 ? 'Password should include at least 6 characters' : null),
        },
    });

    if (type === 'forgotPassword') {
        return (
            <Center style={{height: '100vh'}}>
            <Paper radius="md" p="xl" withBorder {...props}>
                <Text size="lg" fw={500}>
                    Forgot your password?
                </Text>
                <Space h={20}/>
                <TextInput label="Your email" placeholder="me@mantine.dev" required/>
                <Group justify="space-between" mt="lg">
                    <Anchor component="button" size="sm" onClick={() => toggle('login')}>
                        Back to the login page
                    </Anchor>
                    <Button>Reset password</Button>
                </Group>
            </Paper>
            </Center>
        );
    }

    return (
        <Center style={{height: '100vh'}}>
            <Paper radius="md" p="xl" withBorder {...props}>
                <Text size="lg" fw={500}>
                    Welcome to Mantine, {type} with
                </Text>

                <Group grow mb="md" mt="md">
                    <Button radius="xl">
                        <IconBrandGoogleFilled/>
                    </Button>
                    <Button radius="xl">
                        <IconBrandX/>
                    </Button>
                </Group>

                <Divider label="Or continue with email" labelPosition="center" my="lg"/>

                <form onSubmit={form.onSubmit(() => {
                })}>
                    <Stack>
                        {type === 'register' && (
                            <TextInput
                                required
                                label="Name"
                                placeholder="Your name"
                                value={form.values.name}
                                onChange={(event) => form.setFieldValue('name', event.currentTarget.value)}
                                radius="md"
                            />
                        )}

                        <TextInput
                            required
                            label="Email"
                            placeholder="hello@mantine.dev"
                            value={form.values.email}
                            onChange={(event) => form.setFieldValue('email', event.currentTarget.value)}
                            error={form.errors.email && 'Invalid email'}
                            radius="md"
                        />

                        <PasswordInput
                            required
                            label="Password"
                            placeholder="Your password"
                            value={form.values.password}
                            onChange={(event) => form.setFieldValue('password', event.currentTarget.value)}
                            error={form.errors.password && 'Password should include at least 6 characters'}
                            radius="md"
                        />

                        {type === 'register' && (
                            <Checkbox
                                label="I accept terms and conditions"
                                checked={form.values.terms}
                                onChange={(event) => form.setFieldValue('terms', event.currentTarget.checked)}
                            />
                        )}
                    </Stack>

                    <Group justify="space-between" mt="lg">
                        <Anchor component="button" size="sm" onClick={() => toggle('forgotPassword')}>
                            Forgot password?
                        </Anchor>
                    </Group>

                    <Group justify="space-between" mt="xl">
                        <Anchor
                            component="button"
                            type="button"
                            c="dimmed"
                            onClick={() => toggle(type === 'register' ? 'login' : 'register')}
                            size="xs"
                        >
                            {type === 'register'
                                ? 'Already have an account? Login'
                                : "Don't have an account? Register"}
                        </Anchor>
                        <Button type="submit" radius="xl">
                            {upperFirst(type)}
                        </Button>
                    </Group>
                </form>
            </Paper>
        </Center>
    );
}
