# TPN - Tao Private Network

The TPN subnet coordinares miners that offer VPN connections in a wide variety of geographic locations.

In the TPN subnet, there are two kinds of nodes:

- **Miners**: These nodes offer VPN connections to users and are rewarded for their service
- **Validators**: These nodes validate the work of miners and act as an interface to end users

If you want to contribute to the TPN subnet, the easiers way to do so it to run a miner. This page will explain how to run a miner and a validator. Keep in mind that you should:

- Decide if you want to run a miner or a validator
- Make sure you have the necessary hardware for the miner or validator
- Running a miner is easier than running a validator

**CURRENT SUBNET STATUS**

The TPN is currently in bootstrap mode. This means that miners do not yet offer VPN connections, but are incentivited to get their infrastructure up and running.


> [!CAUTION]
> This documentation is a work in public alpha. Expect things to break. Specifically the validator instructions are currently unstable due to development pace.

## Preparing your machine

Before starting your miner and/or validator, please prepare your machine by setting up the required enrivonment.

### 1: Installing dependencies

Requirements:

- Linux OS (Ubuntu LTS recommended)
- 2 CPU cores
- 2GB RAM
- 50GB disk space
- Publically accessible IP address


The miner and validator share the same dependencies. No matter which you choose to run, please install the dependencies by executing the following commands:

```bash
# Install the required system dependencies
sudo apt update
sudo apt install -y git python3 python3-venv python3-pip
sudo apt upgrade -y # OPTIONAL, this updated system packages

# Install docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install node and pm2
sudo apt install -y nodejs npm
npm install -g pm2

# Clone the TPN repository, it contains all the required code
cd ~
git clone https://github.com/beyond-stake/tpn-subnet.git

# Install the required python dependencies
cd tpn-subnet
python3 -m venv venv
source venv/bin/activate
pip3 install -r requirements.txt
export PYTHONPATH=.

# Add the current user to docker for rootless docker running
if [ -z "$USER" ]; then
    USER=$(whoami)
fi
sudo groupadd docker &> /dev/null
sudo usermod -aG docker $USER
newgrp docker << EOF
    sudo service docker start
EOF
```

### 2: Configure keys

The next step is to configure the Bittensor keys for your miner and/or validator. Note that these keys are stored in the `~/.bittensor` directory. You have 2 options:

1. Copy existing cold and hotkeys to `~/.bittensor`
2. Generate a new coldkey and hotkey

If you have existing keys that you are deploying, copy them in the following structure:

```bash
~/.bittensor/
├── tpn_coldkey # This directory name is how btcli knows the name of your coldkey
│   ├── coldkeypub.txt # This file contains your public coldkey, NOT THE PRIVATE KEY, the miner machine does not need the private key
|   └── hotkeys # This directory contains the private keys of your hotkeys
|       ├── hotkey # This file contains the private key of your hotkey in json format
```

If you want to generate new keys, execute the following commands:

```bash
btcli w new_coldkey --wallet.name tpn_coldkey
btcli w new_hotkey --wallet.name tpn_hotkey
``` 

Note that the above will generate a private key for your coldkey as well. This is a key with security implications and should be stored securely. Ideally you delete it from your miner server after backing it up safely.

## Running a miner

Note that your rewards depend on the uniqueness of the location of your miner. Once you have chosen a location, either as a hosted VPS or as physical hardware, you can start the miner.

The consists out of two components:

1. A miner docker container that is managed through `docker`
2. A miner neuron that is managed through `pm2`

To start the docker container, there are 2 steps. Creating a `.env` file and starting the container.

Create a `.env` file in the `node-stack/miner` directory with the following content:

```bash
POSTGRES_PASSWORD=xxxx c# REQUIRED, may be any valid string, choose something random
LOG_LEVEL=info # optional, this controls the log level, valid values are: info, warn, error
POSTGRES_HOST=postgres # optional, only use if you have a remote database (not recommended)
POSTGRES_PORT=5432 # optional, this changes the postgres port (not recommended)
WIREGUARD_PEER_COUNT=250 # optional, this changes the amount of connections the miner offers, must be between 15 and 250
```

Then start the miner docker container:

```bash
# NOTE: this assumes you are in the tpn-subnet directory
docker compose -f node-stack/miner/miner.docker-compose.yml up -d
```

To start the miner neuron:

```bash
# NOTE: this assumes you are in the tpn-subnet director
export PYTHONPATH=. && pm2 start "python3 neurons/miner.py \
    --netuid 65 \ # 65 for mainnet, 279 for testnet
    --subtensor.network finney \ # Finney means mainnet, test means testnet
    --wallet.name tpn_coldkey \
    --wallet.hotkey tpn_hotkey \
    --logging.info \
    --axon.port 8091 \
    --blacklist.force_validator_permit" --name tpn_miner
```

### Updating your miner

The miner automatically updates some components periodically, but not all. You should regularly run the following commands to keep your miner up to date:

```bash
# Update the TPN repository
cd ~/tpn-subnet
git pull

# Pull the latest docker images
docker compose -f node-stack/miner/miner.docker-compose.yml pull

# Restart the miner docker container
docker compose -f node-stack/miner/miner.docker-compose.yml up -d

# Restart the pm2 process
pm2 restart tpn_miner
```

## Running a validator

Validators are the interface between end users and miners. They send work requests to miners, which the miners complete and submit to the validator. Running a validator is more complicated than a miner and requires more setup than a miner.

### Step 1: Register the validator key on chain

You must announce your intention to run a validator on chain by running the following command:

```bash
btcli s register --wallet.name tpn_coldkey --hotkey tpn_hotkey --netuid 65 # 65 for mainnet, 279 for testnet
```

### Step 2: Configure the validator settings

The validator neuron needs you to supply a WanDB API key. You can get one by signing up at [WanDB](https://wandb.ai/site). Once you have the key, add it to your environment by running the code below:

```bash
# 🚨 Change the below to your API key
WANDB_API_KEY=xxxx

# Determine the default login shell using the SHELL env variable
shell=$(basename "$SHELL")
export_line="export WANDB_API_KEY=$WANDB_API_KEY"

# For bash: if the default shell is bash, add the export_line to ~/.bashrc if not present
if [[ "$shell" == "bash" ]]; then
  # Check if the exact export_line exists in ~/.bashrc
  if ! grep -Fxq "$export_line" ~/.bashrc; then
    echo "$export_line" >> ~/.bashrc  # Append if not found
    echo "Added '$export_line' to ~/.bashrc"
  else
    echo "'$export_line' already exists in ~/.bashrc"
  fi
fi

# For zsh: if the default shell is zsh, add the export_line to ~/.zshrc if not present
if [[ "$shell" == "zsh" ]]; then
  # Check if the exact export_line exists in ~/.zshrc
  if ! grep -Fxq "$export_line" ~/.zshrc; then
    echo "$export_line" >> ~/.zshrc  # Append if not found
    echo "Added '$export_line' to ~/.zshrc"
  else
    echo "'$export_line' already exists in ~/.zshrc"
  fi
fi

# Run the export line in the current shell
eval $export_line
```

The validator needs to be configured with some settings and third party API keys. These values are stored in `node-stack/validator/.env`. Populate that file like so:

```bash
# This controls the verbosity of the logs. Possible values are: info, warn, error
LOG_LEVEL=info # Optional

# A free license key, obtained by creating an account and API key at http://maxmind.com/en/accounts/
MAXMIND_LICENSE_KEY=xxxx

# This is the public URL where the validator can be reached.
PUBLIC_VALIDATOR_URL=http://1.2.3.4

# This is 3000 by default, you should only change it if your device is behind a firewall or reverse proxy.
# Miners MUST be able to call your validator at this port. If they cannot, your validator is NOT valid. Test this by running `curl $PUBLIC_VALIDATOR_URL:$PUBLIC_PORT`
PUBLIC_PORT=3000

# The free ip2location lite API key, obtained by creating an account at https://lite.ip2location.com/login
IP2LOCATION_DOWNLOAD_TOKEN=xxxx
POSTGRES_PASSWORD=xxxx # May be any valid string, choose something random, it does not matter what.
```

### Step 3: Start the validator

The validator also consists out of two components:

1. A validator docker container that is managed through `docker`
2. A validator neuron that is managed through `pm2`

To start the docker container:

```bash
# NOTE: this assumes you are in the tpn-subnet directory
docker compose -f node-stack/validator/validator.docker-compose.yml up -d
```

To start the validator neuron:

```bash
# NOTE: this assumes you are in the tpn-subnet director
export PYTHONPATH=. && pm2 start "python3 neurons/validator.py \
    --netuid 65 \ # 65 for mainnet, 279 for testnet
    --subtensor.network finney \ # Finney means mainnet, test means testnet
    --wallet.name tpn_coldkey \
    --wallet.hotkey tpn_hotkey \
    --logging.info \
    --axon.port 9000 \
    --neuron.vpermit 10000 \
    --force_validator_permit" --name tpn_validator
```

### Updating your validator

The validator automatically updates some components periodically, but not all. You should regularly run the following commands to keep your validator up to date:

```bash
# Update the TPN repository
cd ~/tpn-subnet
git pull

# Pull the latest docker images
docker compose -f node-stack/validator/validator.docker-compose.yml pull

# Restart the validator docker container
docker compose -f node-stack/validator/validator.docker-compose.yml up -d

# Restart the pm2 process
pm2 restart tpn_validator
```