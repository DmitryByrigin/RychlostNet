<?php
// CORS-заголовки
if (isset($_GET['cors'])) {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST');
    header('Access-Control-Allow-Headers: Content-Encoding, Content-Type');
}

// Заголовки для предотвращения кэширования
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');

// Получаем размер запрошенных данных из параметра
$data = '0';
$chunks = 0;
if (isset($_GET['ckSize'])) {
    $chunks = intval($_GET['ckSize']);
}

// Ограничение максимального размера для безопасности (1 ГБ)
if ($chunks > 1000) $chunks = 1000;

if ($chunks > 0) {
    // 1 МБ случайных данных, которые будут отправлены клиенту
    // Для эффективности, это лучше, чем генерировать новые случайные данные для каждого запроса
    $data = str_repeat('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 16384);
}

// Установка правильного Content-Length в заголовке
header('Content-Length: ' . ($chunks * 1048576));

// Отправка данных клиенту
for ($i = 0; $i < $chunks; $i++) {
    echo $data;
}
