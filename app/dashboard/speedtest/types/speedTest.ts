import React from "react";

export interface SpeedTestResult { 
    size: number;
    time: number;
}

export interface PingStats {
    min: number;
    max: number;
    avg: number;
    jitter: number;
}

export interface NetworkStat {
    key: string;
    value: string;
    icon: React.ElementType;
}

export interface WebRTCSpeedTestResult {
    download: number;  // в Mbps
    upload: number;    // в Mbps
    ping: number;      // в миллисекундах
}
