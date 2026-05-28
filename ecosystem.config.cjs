module.exports = {
  apps: [
    {
      name: "rocky-ai",
      script: "server.js",
      cwd: "/var/www/rocky-ai",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "8000"
      },
      max_memory_restart: "512M",
      time: true
    }
  ]
};
