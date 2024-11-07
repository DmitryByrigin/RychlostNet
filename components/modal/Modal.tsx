// components/modal/Modal.tsx
import { useDisclosure } from '@mantine/hooks';
import { Modal as MantineModal, Button } from '@mantine/core';
import React from "react";

interface CustomModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode
}

export default function CustomModal({ isOpen, onClose, children }: CustomModalProps) {
    return (
        <MantineModal opened={isOpen} onClose={onClose} title="Authentication" centered>
            <div>{children}</div>
        </MantineModal>
    );
}
