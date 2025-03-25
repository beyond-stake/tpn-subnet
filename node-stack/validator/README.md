# Sybil network validator stack

## Usage

For setup:

- Make an account at https://lite.ip2location.com/. Set it as the `IP2LOCATION_DOWNLOAD_TOKEN` environment variable in the docker compose file.
- Make an account at https://www.maxmind.com and generate a license key in account settings. Set it as the `MAXMIND_LICENSE_KEY` environment variable in the docker compose file.
- Run `docker build -t sybil-network:nightly . --no-cache` to build the docker image
- Run `docker-compose up` to start the container, note that on first start the importing or maxmind and ip2location databases may take a while.


Docker compose:

```yaml
version: '3.7'
services:
    sybil-network:
        image: sybil-network:nightly
        ports:
            - "${PUBLIC_PORT:-3000}:3000" 
        # You may also create a .env file in the same folder as the docker-compose.yml file
        environment:
            LOG_LEVEL: info
            MAXMIND_LICENSE_KEY:
            IP2LOCATION_DOWNLOAD_TOKEN:
            PUBLIC_VALIDATOR_URL: "http://localhost"
            PUBLIC_PORT: 3000
        volumes:
            - ./database.sqlite:/app/database.sqlite
```

### Endpoints

The endpoints available in this container:

- `/` - Nonfunctional hello page
- `/score` - Returns the score of the calling ip address, used for testing and debugging
  - Sample response: `{ score: 30 }`
- `/challenge/new` - Generates a new challenge, the validator calls this locally and sends this url to a miner
  - Sample response: `{ challenge: 1234, challenge_url: "http://localhost:3000/challenge/1234" }`, note that the base url is configured using environment variables, in production it will not be localhost.
- `/challenge/:id` - Returns the response belinging to a challenge, the miner calls this endpoint
  - Sample response: `{ response: "abcd" }`
- `/challenge/:id/:response` - Validates the response to a challenge, the miner calls this endpoint, and the validator uses it to score the miner and updates it's internal database. The endpoint returns scoring info to the miner
   - Sample response: `{ correct: true, score: 49, speed_score: 98, uniqueness_score: 0, solved_at: 1738145282214 }`

## Development

Required variables in `.env` file:

```bash
# .env
LOGLEVEL=info,warn,error
MAXMIND_LICENSE_KEY= # Make a free account on maxmind.com and generate a license key in account settings
PUBLIC_VALIDATOR_URL= # The URL where the app is hosted, may be an ip or domain based url starting with http:// or https://
PUBLIC_PORT= # The port where the app is hosted, usually 3000
```

Docker run:

```bash
docker run \
    -p 3000:3000 \
    -e LOG_LEVEL=info \
    -e MAXMIND_LICENSE_KEY="" \
    -e PUBLIC_VALIDATOR_URL="http://localhost" \
    -e PUBLIC_PORT=3000 \
    -v "$(pwd)/database.sqlite:/app/database.sqlite" \
    tpn-network:local
```

Building docker file:

```docker build -t tpn-network:local . --no-cache```

## Attributions

This software uses the IP2Location LITE database for <a href="https://lite.ip2location.com">IP geolocation</a>.

This software uses the MaxMind GeoLite2 database for <a href="https://www.maxmind.com">IP geolocation</a>.