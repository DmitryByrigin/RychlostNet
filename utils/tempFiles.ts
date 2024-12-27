import path from 'path';
import fs from 'fs';
import os from 'os';

// Создаем временную директорию для файлов тестирования скорости
const getTempDir = () => {
    const tempDir = path.join(os.tmpdir(), 'speedtest-files');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
};

export const tempFilesUtils = {
    getTempDir,
    // Генерируем путь для временного файла
    getFilePath: (filename: string) => {
        return path.join(getTempDir(), filename);
    },
    // Получаем относительный путь для API
    getApiPath: (filename: string) => {
        return `/api/files/${filename}`;
    }
};
