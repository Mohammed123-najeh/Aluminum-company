<?php

$viteDevOrigins = [];
foreach (range(5173, 5180) as $p) {
    $viteDevOrigins[] = "http://localhost:{$p}";
    $viteDevOrigins[] = "http://127.0.0.1:{$p}";
}

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    /*
     * Browsers treat localhost and 127.0.0.1 as different origins. Allow both for Vite dev
     * (5173–5180 when the default port is busy) plus optional FRONTEND_URLS / FRONTEND_URL.
     */
    'allowed_origins' => array_values(array_filter(array_unique(array_merge(
        $viteDevOrigins,
        array_filter(array_map('trim', explode(',', (string) env('FRONTEND_URLS', '')))),
        [env('FRONTEND_URL') ?: null],
    )))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
