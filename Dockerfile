FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies required for Chrome + Node builds
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    ca-certificates \
    software-properties-common \
    build-essential \
    libxss1 \
    libgtk-3-0 \
    libgbm1 \
    libasound2t64 \
    libnss3 \
    libxshmfence1 \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Create non-root user early
RUN useradd -m appuser

# Set working directory and give ownership
WORKDIR /app
RUN chown appuser:appuser /app

# Switch to appuser so Chrome installs into /home/appuser/.cache/puppeteer
USER appuser

# Copy only package files to install dependencies at build time
COPY --chown=appuser:appuser package*.json ./

# Install ALL dependencies including dev (needed for tsc)
RUN npm install --include=dev

# Install Chrome via Puppeteer as appuser
RUN npx puppeteer browsers install chrome

# Patch revideo CLI to bind on 0.0.0.0 so the editor is accessible from outside the container
RUN sed -i 's/server: {/server: { host: "0.0.0.0",/' /app/node_modules/@revideo/cli/dist/editor.js

# Ensure output directory exists
RUN mkdir -p /app/output

# Default command: render
CMD ["npm", "run", "render"]

EXPOSE 9000