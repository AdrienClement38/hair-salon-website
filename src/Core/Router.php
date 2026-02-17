<?php
namespace Src\Core;

class Router
{
    private $routes = [];

    public function get($path, $callback)
    {
        $this->addRoute('GET', $path, $callback);
    }

    public function post($path, $callback)
    {
        $this->addRoute('POST', $path, $callback);
    }

    public function put($path, $callback)
    {
        $this->addRoute('PUT', $path, $callback);
    }

    public function delete($path, $callback)
    {
        $this->addRoute('DELETE', $path, $callback);
    }

    private function addRoute($method, $path, $callback)
    {
        $this->routes[] = [
            'method' => $method,
            'path' => $path,
            'callback' => $callback
        ];
    }

    public function dispatch($uri, $method)
    {
        // Strip query string
        $path = parse_url($uri, PHP_URL_PATH);

        // Remove trailing slash if desired, or handle strict
        // For subfolder installation, we might need to strip the base path if not at root
        // Assuming rewrites send distinct path to index.php

        // Match route
        foreach ($this->routes as $route) {
            if ($route['method'] === $method && $route['path'] === $path) {
                return $this->handleCallback($route['callback']);
            }
        }

        // 404
        http_response_code(404);
        echo json_encode(['error' => 'Not Found']);
    }

    private function handleCallback($callback)
    {
        if (is_array($callback)) {
            $controller = new $callback[0]();
            $method = $callback[1];
            return $controller->$method();
        }

        if (is_callable($callback)) {
            return call_user_func($callback);
        }
    }
}
