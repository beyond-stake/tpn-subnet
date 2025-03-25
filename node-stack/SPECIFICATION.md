# Miner and validator conceptual specification

This document details the basic concepts of the miner and validator containers, and how they interact with each other. This is a layered interaction that is managed by the Bittensor subnet neuron code. These containers contain the off chain logic used to run the subnet.

The scoring flow is as follows:

1. Validator neuron generates a challenge by calling the `/challenge/new` endpoint on the validator container
2. Validator neuron sends the challenge url to the miner neuron over http
3. Miner neuron receives the solution to the challenge by opening the url that the validator provided
4. The miner neuron sends the solution to the challenge to the validator and includes a valid wireguard configuration
5. The validator neuron validates the response by:
    1. Checking the response to the challenge and generating a node score based on geolocation, speed, etc
    2. Checking the wireguard configuration by:
        1. Generating a new challenge by calling the `/challenge/new` endpoint on the validator container
        2. Connecting to the miner using the wireguard configuration
        3. Checking that the miner ip when connecting through the wireguard configuration is the same as the miner ip when the challenge was generated
        4. Generating a score based on the above information