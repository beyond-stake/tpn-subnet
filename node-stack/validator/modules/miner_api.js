import { log, require_props } from "mentie"
import { get_ips_by_country } from "./stats"

/**
 * Retrieves configuration from a miner based on the provided options.
 *
 * @param {Object} options - The options object.
 * @param {string|null} options.geo - The geographical code used to filter miner IPs. If set to 'any', it is treated as null.
 * @param {number} options.lease_minutes - The lease time in minutes. Must be between 0.5 and 60 minutes.
 * @param {string} [options.format='json'] - The expected response format.
 * @param {number} [options.timeout_ms=5000] - The timeout for the fetch request in milliseconds.
 * @returns {Promise<Object>} config - A promise that resolves to:
 * @returns {string} config.peer_config - The peer configuration received from the miner.
 * @returns {number} config.expires_at - The expiration time of the configuration.
 * 
 * @throws {Error} Throws an error if required properties are missing or if 'lease_minutes' is out of the allowed range.
 */
export async function get_config_from_miners( options ) {
    
    // Get request parameters
    let { geo, lease_minutes, format='json', timeout_ms=5_000 } = options
    log.info( `Request received for new config:`, { geo, lease_minutes } )
    
    // Validate request parameters
    const required_properties = [ 'geo', 'lease_minutes' ]
    require_props( options, required_properties )
    log.info( `Request properties validated` )
    
    // Validate lease
    const lease_min = .5
    const lease_max = 60
    if( lease_minutes < lease_min || lease_minutes > lease_max ) {
        throw new Error( `Lease must be between ${ lease_min } and ${ lease_max } minutes, you supplied ${ lease_minutes }` )
    }
    
    // If geo was set to 'any', set it to null
    if( geo == 'any' ) geo = null
    
    // Dummy response
    const live = true
    if( !live ) {
        return { error: 'Endpoint not yet enabled, it will be soon', your_inputs: { geo, lease_minutes } }
    }
    
    // Get the miner ips for this country code
    const ips = await get_ips_by_country( { geo } )
    log.info( `Got ${ ips.length } ips for country:`, geo )
    
    // If there are no ips, return an error
    if( ips.length == 0 ) return { error: `No ips found for country: ${ geo }` }
    
    // Request configs from these miners until one succeeds
    let config = null
    for( let ip of ips ) {
    
        log.info( `Requesting config from miner:`, ip )
    
        // Sanetise potential ipv6 mapping of ipv4 address
        if( ip?.trim()?.startsWith( '::ffff:' ) ) ip = ip?.replace( '::ffff:', '' )
    
    
        // Create the config url
        let config_url = new URL( `http://${ ip }:3001/wireguard/new` )
        config_url.searchParams.set( 'lease_minutes', lease_minutes )
        config_url.searchParams.set( 'geo', geo )
        config_url = config_url.toString()
        log.info( `Requesting config from:`, config_url )
    
        // Response holder for trycatch management
        let response = undefined
    
        try {
    
            // Request with timeout
            const controller = new AbortController()
            const timeout_id = setTimeout( () => {
                controller.abort()
            }, timeout_ms )
            response = await fetch( config_url, { signal: controller.signal } )
            clearTimeout( timeout_id )
    
            const json = await response.clone().json()
            log.info( `Response from ${ ip }:`, json )
    
            // Get relevant properties
            const { peer_config, expires_at } = json
            if( peer_config && expires_at ) config = { peer_config, expires_at }
    
            // If we have a config, exit the for loop
            if( config ) break
    
        } catch ( e ) {
    
            const text_response = await response?.clone()?.text()?.catch( e => e.message )
            log.info( `Error requesting config from ${ ip }: ${ e.message }. Response body:`, text_response )
            continue
    
        }
    
    
    }
    
    // If no config was found, return an error 
    if( !config ) return { error: `No config found for country: ${ geo } (${ ips.length } miners)` }
    log.info( `Config found for ${ geo }:`, config )

    // Validate config properties
    const required_config_properties = [ 'peer_config', 'expires_at' ]
    require_props( config, required_config_properties )

    return config

}