// Дополнительные типы для хука useSpeedTest
export interface PingStats {
    min: number;
    max: number;
    avg: number;
    jitter: number;
}

// Тип результата тестирования
export interface SpeedTestResultExtended {
    download: number;
    upload: number;
    ping: {
        min: number;
        max: number;
        avg: number;
    };
    jitter: number;
    ip: string;
    server: any;
    timestamp: string;
}

// Резервный сервер для тестирования
// Обновленный формат для LibreSpeed v5.4.1
export const FALLBACK_SERVER = {
    name: "Тестовый сервер",
    // в v5.4.1 URL сервера должен заканчиваться на /
    server: "https://speedtest.fastersoft.com.ru/",
    // Важно: для 5.4.1 пути нужно указывать без начального слеша
    dlURL: "garbage.php",
    ulURL: "empty.php",
    pingURL: "empty.php",
    getIpURL: "getIP.php",
    ignoreIds: true // Добавлено для совместимости с 5.4.1
};
