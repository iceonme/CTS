module.exports = {
  apps: [
    {
      name: 'cryptopulse-ai',
      script: 'npm',
      args: 'run dev',
      cwd: '/home/iceonme/CTS/my-app',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development'
      },
      log_file: '/home/iceonme/CTS/my-app/logs/pm2.log',
      error_file: '/home/iceonme/CTS/my-app/logs/pm2-error.log',
      out_file: '/home/iceonme/CTS/my-app/logs/pm2-out.log',
      time: true
    }
  ]
};
