<?php

/**
 * Router for `php artisan serve`. When present at project root, Laravel uses this instead of
 * the default. Ensures /api/* always hits the front controller (avoids rare static-path edge cases).
 */
$publicPath = getcwd();

$uri = urldecode(
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? ''
);

if (str_starts_with($uri, '/api') || str_starts_with($uri, '/sanctum')) {
    require_once $publicPath.'/index.php';
    return;
}

if ($uri !== '/' && file_exists($publicPath.$uri)) {
    return false;
}

require_once $publicPath.'/index.php';
