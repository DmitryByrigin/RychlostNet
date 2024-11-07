export interface Server {
    url: string;
    name: string;
    country: string;
    sponsor: string | string[];
    host: string;
    distance: number;
}

export interface GeolocationData {
    ip: string;
    city: string;
    region: string;
    country: string;
    org: string;
    servers: Server[];
}
