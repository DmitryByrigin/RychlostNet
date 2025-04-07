import React from "react";

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
