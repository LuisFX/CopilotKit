#!/bin/bash

# Script to publish CopilotKit packages to local Verdaccio registry
# Run this from the root of your CopilotKit fork

set -e  # Exit on error

echo "Publishing CopilotKit packages to local Verdaccio registry..."
echo "Registry: http://localhost:4873"
echo ""

# Check if Verdaccio is running
if ! curl -s http://localhost:4873 > /dev/null; then
    echo "Error: Verdaccio doesn't seem to be running at http://localhost:4873"
    echo "Please start Verdaccio first: verdaccio"
    exit 1
fi

# Save current registry
ORIGINAL_REGISTRY=$(npm config get registry)
echo "Current registry: $ORIGINAL_REGISTRY"
echo ""

# Ensure we're using the local registry
npm config set registry http://localhost:4873

# Navigate to CopilotKit directory
cd CopilotKit

echo "Installing dependencies..."
pnpm install

echo ""
echo "Building all packages..."
pnpm run build

echo ""
echo "Publishing packages to local registry..."

# Generate a single timestamp for all packages (YYYYMMDDHHMM - no seconds)
TIMESTAMP=$(date +%Y%m%d%H%M)
echo "Using timestamp: $TIMESTAMP for all packages"

# Define packages in dependency order
PACKAGES=(
    "packages/shared"
    "packages/runtime-client-gql"
    "packages/sdk-js"
    "packages/react-core"
    "packages/react-textarea"
    "packages/react-ui"
    "packages/runtime"
)

# Track published packages
PUBLISHED_PACKAGES=()

for package_dir in "${PACKAGES[@]}"; do
    if [ -d "$package_dir" ]; then
        echo ""
        echo "Publishing $package_dir..."
        cd "$package_dir"
        
        # Get package name and version
        PACKAGE_NAME=$(node -p "require('./package.json').name")
        PACKAGE_VERSION=$(node -p "require('./package.json').version")
        
        # Generate consistent version for all packages
        BASE_VERSION="${PACKAGE_VERSION%-local.*}"  # Remove any existing local suffix
        NEW_VERSION="${BASE_VERSION}-local.${TIMESTAMP}"
        
        echo "Publishing as version: $NEW_VERSION"
        
        # Create a temporary package.json for publishing
        # This way we don't modify the actual package.json file
        cp package.json package.json.backup
        
        # Use npm pack with version override to create tarball
        npm version "$NEW_VERSION" --no-git-tag-version --allow-same-version > /dev/null 2>&1
        
        # Try to publish
        if npm publish --registry http://localhost:4873 2>&1 | tee /tmp/npm-publish.log; then
            if grep -q "npm ERR!" /tmp/npm-publish.log; then
                echo "Error publishing $PACKAGE_NAME"
                cat /tmp/npm-publish.log
            else
                echo "Successfully published $PACKAGE_NAME@$NEW_VERSION"
                PUBLISHED_PACKAGES+=("$PACKAGE_NAME@$NEW_VERSION")
            fi
        fi
        
        # Restore original package.json
        mv package.json.backup package.json
        
        cd ../..
    else
        echo "Warning: Directory $package_dir not found, skipping..."
    fi
done

echo ""
echo "========================================="
echo "Publishing complete!"
echo ""

if [ ${#PUBLISHED_PACKAGES[@]} -gt 0 ]; then
    echo "Published packages:"
    for pkg in "${PUBLISHED_PACKAGES[@]}"; do
        echo "  - $pkg"
    done
    echo ""
fi

echo "To use these packages in your project:"
echo "1. Make sure your project uses the local registry:"
echo "   npm config set registry http://localhost:4873"
echo ""
echo "2. Install the packages:"
echo "   npm install @copilotkit/react-core@latest"
echo "   npm install @copilotkit/react-ui@latest"
echo "   npm install @copilotkit/runtime@latest"
echo "   # etc..."
echo ""
echo "3. To revert to npm registry later:"
echo "   npm config set registry $ORIGINAL_REGISTRY"
echo "========================================="

# Optionally restore original registry
read -p "Do you want to restore the original npm registry now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm config set registry "$ORIGINAL_REGISTRY"
    echo "Registry restored to: $ORIGINAL_REGISTRY"
fi