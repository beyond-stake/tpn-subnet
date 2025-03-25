# Use Nodejs image base
FROM node:22.13.0-slim

# Set the working directory inside the container
WORKDIR /app

# Copy package management files
COPY package*.json ./

# Install dependencies, data files from maxmind and ip2location are downloaded later and not during build
RUN npm i -g npm
RUN npm ci --omit=dev

# Run available security updates
ENV DEBIAN_FRONTEND=noninteractive
RUN apt update && apt upgrade -y

# Install curl for the healthcheck
RUN apt update && apt install -y curl

# Install networking tools
RUN apt update && apt install -y wireguard wireguard-tools
RUN apt update && apt install -y iproute2 dnsutils iputils-ping iptables

# wg-quick dependencies
RUN apt update && apt install -y procps
RUN apt update && apt install -y resolvconf || echo "resolvconf postinstall is expected to fail"
RUN echo '#!/bin/sh\nexit 0' > /var/lib/dpkg/info/resolvconf.postinst && chmod +x /var/lib/dpkg/info/resolvconf.postinst
RUN dpkg --configure resolvconf


# Cachebuster
ARG CACHEBUST=1
RUN echo "CACHEBUST=$CACHEBUST"

# Copy application code
COPY app.js ./
COPY modules ./modules
COPY routes ./routes

# Expose the port the app runs on
EXPOSE 3000

# Serve the app
CMD ["node", "app.js"]

# Healthcheck call to /score, expect 200. Note that due to maxmind boot updates we need a long start period
HEALTHCHECK --interval=10s --timeout=10s --start-period=600s --retries=3 CMD curl -f http://localhost:3000/ || exit 1
