#!/usr/bin/env bash
# ==============================================================================
# Aroha House - Medusa v2 GCP Ubuntu Setup & Deployment Script
# Run this script on your GCP e2-micro Ubuntu VM (via SSH)
# ==============================================================================

set -e

echo "🚀 Starting GCP Server Configuration..."

# 1. System Updates & Prerequisites
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx certbot python3-certbot-nginx

# 2. Configure 2GB Swap Memory (Critical for 1GB RAM VM)
if [ ! -f /swapfile ]; then
  echo "💾 Creating 2GB Swap file for RAM optimization..."
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "✅ Swap memory enabled successfully!"
else
  echo "ℹ️ Swap file already exists."
fi

# 3. Install Global Tools
echo "🛠️ Installing PM2 process manager..."
sudo npm install -g pm2 yarn

# 4. Check for .env file
if [ ! -f .env ]; then
  echo "⚠️ Warning: .env file missing in project root."
  echo "Please create a .env file with DATABASE_URL, JWT_SECRET, STORE_CORS, ADMIN_CORS before building."
  exit 1
fi

# 5. Build Medusa Project
echo "🏗️ Installing dependencies and building Medusa..."
npm install
npm run build

# 6. PM2 Startup
echo "⚙️ Configuring PM2..."
pm2 stop medusa-backend 2>/dev/null || true
pm2 start "npx medusa start" --name "medusa-backend"
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp /home/$USER || true

# 7. Configure Nginx Reverse Proxy
echo "🌐 Configuring Nginx reverse proxy..."
sudo tee /etc/nginx/sites-available/medusa > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 25M;

    location / {
        proxy_pass http://localhost:9000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/medusa /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "🎉 Deployment Complete!"
echo "Your Medusa backend is running live on port 80 & 9000."
