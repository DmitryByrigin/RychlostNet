export interface WebRTCSpeedTestResult {
    download: number;
    upload: number;
    ping: number;
}

export interface WebRTCError {
    message: string;
    code?: string;
}

export interface ConnectionEstablishedData {
    message: string;
    isInitiator: boolean;
}

// RTCStates enum for connection states
export enum RTCStates {
    NEW = 'new',
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    DISCONNECTED = 'disconnected',
    FAILED = 'failed',
    CLOSED = 'closed',
    ERROR = 'error'
}
