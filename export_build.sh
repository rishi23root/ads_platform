
# Export production build artifacts (for deployment)
# Layout matches Dockerfile: server.js at root, .env alongside for Next.js to load
set -e

npm run build
echo "Build completed"

sudo rm -rf build_tmp/
sudo mkdir -p build_tmp
echo "Build directory created in build_tmp/"


# Copy standalone contents to root including hidden .next (matches Docker)
# Using standalone/. ensures .next (BUILD_ID, manifests, server/) is copied — * excludes hidden
sudo cp -r .next/standalone/. build_tmp/
# Overlay static assets (standalone's .next has no static/)
sudo cp -r .next/static build_tmp/.next/static
sudo cp -r public build_tmp/public
sudo cp -r drizzle build_tmp/drizzle

# Env must be alongside server.js so Next.js loadEnvConfig finds it
# if [ -f .env.local ]; then sudo cp .env.local build_tmp/.env
if [ -f .env.prod ]; then sudo cp .env.prod build_tmp/.env
elif [ -f .env ]; then sudo cp .env build_tmp/.env
fi

echo "Build exported to build_tmp/"
echo ""
echo "Run locally:  cd build_tmp && node server.js"


# Optionally, create a tarball and clean up (uncomment to use)
tar -C build_tmp -czf build_tmp.tar.gz .
sudo rm -rf build_tmp/
echo "Build exported to build_tmp.tar.gz"
