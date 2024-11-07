import React from "react";

export interface PingStats {
    min: number;
    max: number;
    avg: number | null;
}

export interface NetworkStat {
    key: string;
    value: string;
    icon: React.ElementType;
}
