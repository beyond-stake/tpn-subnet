import { cache, log } from 'mentie'
import { createPublicClient, http, fallback, defineChain } from 'viem'
import { bittensor_pay_abi, bittensor_pay_contract_addresses, bittensor_pay_deployment_block } from './abis.js'

// Get default chain from env
const default_chain = process.env.BITTENSOR_CHAIN || 'testnet'

// RPC settings
const public_rpcs = {
    964: [ 'https://lite.chain.opentensor.ai' ], // mainnet
    945: [ 'https://test.chain.opentensor.ai/' ] // testnet
}
const private_rpcs = {
    964: `${ process.env.RPCS_964 || '' }`.split( ',' ).filter( rpc => !!rpc.length ),
    945: `${ process.env.RPCS_945 || '' }`.split( ',' ).filter( rpc => !!rpc.length ),
}

// Bittensor custom chainst
const bittensor_shared = {
    nativeCurrency: {
        decimals: 18,
        name: 'TAO',
        symbol: 'TAO',
    }
}
const bittensor_evm_mainnet = defineChain( {
    ...bittensor_shared,
    id: 964,
    name: 'Bittensor EVM Mainnet',
    rpcs: {
        default: public_rpcs[964][0]
    },
    blockExplorers: {
        default: {
            name: 'Bittensor EVM Mainnet Explorer',
            url: 'https://evm.taostats.io/',
        },
    }
} )
const bittensor_evm_testnet = defineChain( {
    ...bittensor_shared,
    id: 945,
    name: 'Bittensor EVM Testnet',
    rpcs: {
        default: public_rpcs[945][0]
    },
    blockExplorers: {
        default: {
            name: 'Bittensor EVM Testnet Explorer',
            url: 'https://testnet.taostats.io/',
        },
    }
} )

/**
 * Retrieves or creates a public client for interacting with an EVM chain.
 * @param {Object} options - The options for creating the public client.
 * @param {string} [options.chain_name='testnet'] - The name of the chain to connect to. 
 * @throws {Error} If the provided `chain_name` is invalid.
 * @returns {Object} The public client for the specified chain.
 */
export const get_emv_public_client = ( { chain_name=default_chain }={} ) => {

    // Cache check
    const cache_key = `bittensor_evm_public_client_${ chain_name }`
    const cached_client = cache( cache_key )
    if( cached_client ) {
        log.info( `Using cached client for ${ chain_name }` )
        return cached_client
    }

    // Check if chain name is valid
    const valid_names = [ 'mainnet', 'testnet' ]
    if( !valid_names.includes( chain_name ) ) throw new Error( `Invalid chain name: ${ chain_name }. Valid names are: ${ valid_names.join( ', ' ) }` )
    

    // Get RPCs, collate public and private but prefer private
    const chain_id = chain_name === 'mainnet' ? 964 : 945
    const chain = chain_name === 'mainnet' ? bittensor_evm_mainnet : bittensor_evm_testnet
    const rpc_endpoints = [
        ...private_rpcs[chain_id],
        ...public_rpcs[chain_id],
    ]
    log.info( `Creating public client for ${ chain_name } (${ chain_id }) with RPCs: ${ rpc_endpoints.join( ', ' ) }` )

    // Make viem public client
    const public_client = createPublicClient( {
        chain,
        transport: fallback( rpc_endpoints.map( ( rpc ) => http( rpc ) ) )
    } )

    return cache( cache_key, public_client )

}

/**
 * Reads logs for a specified event from the Ethereum Virtual Machine (EVM) blockchain.
 * @param {Object} options - The options for reading logs.
 * @param {string} options.address - The address of the contract to read logs from.
 * @param {Object} [options.event] - The event object from the ABI. If `event_name` is provided, this will be overridden.
 * @param {string} [options.event_name] - The name of the event to read logs for. Used to find the event object in the ABI.
 * @param {Object} [options.args={}] - The arguments to filter the logs by.
 * @param {bigint} [options.fromBlock=0n] - The starting block number to read logs from. Defaults to 0.
 * @param {bigint} [options.toBlock] - The ending block number to read logs up to. Defaults to the latest block number.
 * @returns {Promise<Array>} A promise that resolves to an array of logs matching the specified criteria.
 *
 * @throws {Error} Throws an error if the event name is not found in the ABI.
 */
export const read_logs = async ( { address, event, event_name, args={}, fromBlock=0n, toBlock }={} ) => {

    // Dependencies
    const client = get_emv_public_client( { chain_name: 'testnet' } )

    // Set default values
    toBlock = toBlock || await client.getBlockNumber()

    // If event name was specified, set event to the event object in the abi
    if( event_name ) event = bittensor_pay_abi.find( ( { name } ) => name == event_name )

    // Read the logs
    log.info( `Reading logs for event ${ event.name } between blocks ${ fromBlock }-${ toBlock } at ${ address }` )
    return client.getLogs( { address, event, args, fromBlock, toBlock } )

}

/**
 * Fetch and cache payment events from the EVM contract.
 *
 * @param {Object} options - Options for fetching payment events.
 * @param {string} [options.chain_name='testnet'] - The name of the chain from which to fetch events. Use 'mainnet' or 'testnet'.
 * @returns {Promise<Array>} A promise that resolves to an array of payment events.
 */
export async function get_all_payment_events( { chain_name=default_chain }={} ) {

    // Get the client
    const client = get_emv_public_client( { chain_name } )

    // Get the latest block number
    const latest_block = await client.getBlockNumber()

    // Check if the cache has the events up until the latest block
    const cache_key = `bittensor_evm_payment_events_${ chain_name }`
    const cached_events = cache( cache_key )
    if(  cached_events?.latest_block >= latest_block ) {
        log.info( `Using cached events for ${ chain_name }` )
        return cached_events.events
    }
    log.info( `Fetching events for ${ chain_name } from ${ cached_events?.latest_block || 0n } to ${ latest_block }` )

    // Get the events from the contract
    const events = await read_logs( {
        address: bittensor_pay_contract_addresses[chain_name],
        fromBlock: bittensor_pay_deployment_block[chain_name],
        toBlock: latest_block,
        event_name: 'Payment'
    } )

    // Cache the events
    const new_events = [ ...cached_events?.events || [], ...events ]
    const new_cache = {
        latest_block,
        events: new_events
    }
    cache( cache_key, new_cache )
    log.info( `Cached ${ new_events.length } events for ${ chain_name }` )

    return new_events
    
}