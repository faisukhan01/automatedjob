<?php

/**
 * Laravel — A PHP Framework For Web Artisans.
 *
 * This file lets PHP's built-in web server emulate Apache's "mod_rewrite",
 * keeping the application servable via `php artisan serve` regardless of
 * which ServeCommand implementation the framework version uses.
 */

$uri = urldecode(
    parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)
);

if ($uri !== '/' && file_exists(__DIR__.'/public'.$uri)) {
    return false;
}

require_once __DIR__.'/public/index.php';
