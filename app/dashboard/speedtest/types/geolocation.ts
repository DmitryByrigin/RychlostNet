export interface Server {
    name: string;
    sponsor: string | string[];
    url: string;
    lat: number;
    lon: number;
    distance: number;
    country: string;
    cc: string;
    id: string;
    host: string;
    location: {
        city: string;
        region: string;
        country: string;
        org: string;
    };
}

export interface GeolocationData {
    ip: string;
    city: string;
    region: string;
    country: string;
    org: string;
    servers: Server[];
}
