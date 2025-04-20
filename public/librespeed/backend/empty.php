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

// Пустой файл для тестирования загрузки
// Просто получаем данные и ничего с ними не делаем
