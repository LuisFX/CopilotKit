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
        
        # Add a local suffix to version if not already present
        if [[ ! "$PACKAGE_VERSION" == *"-local"* ]]; then
            # Update version with local suffix (without modifying package.json)
            NEW_VERSION="${PACKAGE_VERSION}-local.$(date +%s)"
            npm version "$NEW_VERSION" --no-git-tag-version --allow-same-version
        fi
        
        # Try to publish (will skip if already published)
        if npm publish --registry http://localhost:4873 2>&1 | tee /tmp/npm-publish.log; then
            if grep -q "npm ERR!" /tmp/npm-publish.log; then
                if grep -q "cannot publish over the previously published versions" /tmp/npm-publish.log; then
                    echo "Package $PACKAGE_NAME already published with this version, skipping..."
                else
                    echo "Error publishing $PACKAGE_NAME"
                    cat /tmp/npm-publish.log
                fi
            else
                echo "Successfully published $PACKAGE_NAME"
                PUBLISHED_PACKAGES+=("$PACKAGE_NAME@$NEW_VERSION")
            fi
        fi
        
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