<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | The JobPilot dashboard (Next.js, port 3000) calls this API straight from
    | the browser during local development, so all origins are allowed for
    | API paths. Laravel's built-in HandleCors middleware consumes this
    | configuration, and App\Http\Middleware\CorsMiddleware additionally
    | answers OPTIONS preflight requests with an immediate 204 response.
    |
    */

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => ['*'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 86400,

    'supports_credentials' => false,

];
