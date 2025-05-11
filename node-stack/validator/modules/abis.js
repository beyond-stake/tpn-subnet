export const bittensor_pay_contract_addresses = {
    'testnet': '0x679EDd72303e18163215e947775844438c1F5808',
    'mainnet': ''
}

export const bittensor_pay_deployment_block = {
    'testnet': 4501834n,
    'mainnet': 0n
}

export const bittensor_pay_abi = [
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_fee_percent",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "_min_payment",
                "type": "uint256"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            }
        ],
        "name": "OwnableInvalidOwner",
        "type": "error"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "account",
                "type": "address"
            }
        ],
        "name": "OwnableUnauthorizedAccount",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "oldPercent",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "newPercent",
                "type": "uint256"
            }
        ],
        "name": "FeePercentUpdated",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "owner",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "amount",
                "type": "uint256"
            }
        ],
        "name": "FeeWithdrawn",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "oldMin",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "newMin",
                "type": "uint256"
            }
        ],
        "name": "MinPaymentUpdated",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "previousOwner",
                "type": "address"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "OwnershipTransferred",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint16",
                "name": "netuid",
                "type": "uint16"
            },
            {
                "indexed": true,
                "internalType": "uint16",
                "name": "uid",
                "type": "uint16"
            },
            {
                "indexed": true,
                "internalType": "bytes32",
                "name": "hotkey",
                "type": "bytes32"
            },
            {
                "indexed": false,
                "internalType": "bytes32",
                "name": "proof",
                "type": "bytes32"
            },
            {
                "indexed": false,
                "internalType": "string",
                "name": "payload",
                "type": "string"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "paid",
                "type": "uint256"
            }
        ],
        "name": "Payment",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint16",
                "name": "netuid",
                "type": "uint16"
            },
            {
                "indexed": false,
                "internalType": "uint16",
                "name": "uid",
                "type": "uint16"
            }
        ],
        "name": "StakeTargetUpdated",
        "type": "event"
    },
    {
        "stateMutability": "payable",
        "type": "fallback"
    },
    {
        "inputs": [],
        "name": "FEE_DENOMINATOR",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "MetagraphContract",
        "outputs": [
            {
                "internalType": "contract IMetagraph",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "StakingContract",
        "outputs": [
            {
                "internalType": "contract IStaking",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "feePercent",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "fee_withdraw",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "minPayment",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint16",
                "name": "netuid",
                "type": "uint16"
            },
            {
                "internalType": "uint16",
                "name": "validator_uid",
                "type": "uint16"
            },
            {
                "internalType": "bytes32",
                "name": "proof",
                "type": "bytes32"
            },
            {
                "internalType": "string",
                "name": "payload",
                "type": "string"
            }
        ],
        "name": "payment",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint16",
                "name": "netuid",
                "type": "uint16"
            },
            {
                "internalType": "bytes32",
                "name": "proof",
                "type": "bytes32"
            },
            {
                "internalType": "string",
                "name": "payload",
                "type": "string"
            }
        ],
        "name": "payment_to_default",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "renounceOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_fee_percent",
                "type": "uint256"
            }
        ],
        "name": "setFeePercent",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_minPayment",
                "type": "uint256"
            }
        ],
        "name": "setMinPayment",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint16",
                "name": "netuid",
                "type": "uint16"
            },
            {
                "internalType": "uint16",
                "name": "uid",
                "type": "uint16"
            }
        ],
        "name": "setStakeTarget",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint16[]",
                "name": "netuids",
                "type": "uint16[]"
            },
            {
                "internalType": "uint16[]",
                "name": "uids",
                "type": "uint16[]"
            }
        ],
        "name": "setStakeTargets",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint16",
                "name": "",
                "type": "uint16"
            }
        ],
        "name": "stakeTargets",
        "outputs": [
            {
                "internalType": "uint16",
                "name": "",
                "type": "uint16"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "newOwner",
                "type": "address"
            }
        ],
        "name": "transferOwnership",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "stateMutability": "payable",
        "type": "receive"
    }
]