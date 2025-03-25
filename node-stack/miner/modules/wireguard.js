import { cache, log, wait } from "mentie"
import { promises as fs } from "fs"
import { join } from "path"
import url from "url"
import { exec } from "child_process"
import { register_wireguard_lease } from "./database.js"
const __dirname = url.fileURLToPath( new URL( '.', import.meta.url ) )
const wireguard_folder = join( __dirname, '..', 'wireguard' )

/**
 * Asynchronously checks if the Wireguard server is ready by ensuring the necessary folders and configuration file exist.
 *
 * @param {number} [grace_window_ms=5000] - The maximum time in milliseconds to wait for the server readiness.
 * @returns {Promise<boolean>} A promise that resolves to true if the server becomes ready within the grace period, or false otherwise.
 */
export async function wireguard_server_ready( grace_window_ms=5_000, peer_id=1 ) {

    const start = Date.now()
    let time_passed = 0
    const config_path = join( wireguard_folder, `peer${ peer_id }`, `peer${ peer_id }.conf` )
    log.info( `Checking if wireguard server is ready for peer${ peer_id } at ${ config_path }` )

    while( time_passed < grace_window_ms ) {

        try {

            // Check if wireguard folder exists
            log.info( `Checking if wireguard folder exists at ${ wireguard_folder }` )
            const folder_exists = await fs.stat( wireguard_folder )
            if( !folder_exists ) throw new Error( 'Wireguard folder does not exist' )

            // Check if the folder list has at least one peer folder with valid config in wireguard/peer1/peer1.conf
            const has_config = await fs.stat( config_path )
            if( !has_config ) throw new Error( 'Wireguard config does not exist' )

            return true

        } catch ( e ) {

            log.info( `Wireguard server not ready: ${ e.message }` )

        }

        // Pause
        log.info( `Waiting for ${ 1000 }ms` )
        await wait( 1000 )
        time_passed = Date.now() - start

    }

    return false

}

/**
 * Counts the number of existing WireGuard configuration files.
 * @param {number} [max_count=255] - The maximum number of configuration files to check.
 * @returns {Promise<number>} - A promise that resolves to the count of existing WireGuard configuration files.
 */
export async function count_wireguard_configs( max_count=255 ) {

    // Check for cached value
    const cache_key = 'wireguard_config_count'
    const cached_count = cache( cache_key )
    if( cached_count ) {
        log.info( `Returning cached count: ${ cached_count }` )
        return cached_count
    }

    let count = 0
    for( let i = 1; i <= max_count; i++ ) {
        const folder_exists = await fs.stat( join( wireguard_folder, `peer${ i }`, `peer${ i }.conf` ) ).catch( e => {
            if( e.code !== 'ENOENT' ) log.error( `Error in count_wireguard_configs:`, e )
            return false
        } )
        if( folder_exists ) count++
    }

    // Cache the count for 10 seconds
    log.info( `Caching count: ${ count }` )
    return cache( cache_key, count, 10_000 )

}

/**
 * Deletes WireGuard configurations for the given IDs.
 *
 * @param {Array<number>} ids - An array of IDs for which the WireGuard configurations should be deleted.
 * @returns {Promise<void>} A promise that resolves when the configurations have been deleted.
 * @throws Will log an error message if the deletion process fails.
 */
export async function delete_wireguard_configs( ids=[] ) {

    try {
        // Delete all configs
        const folder_paths = ids.map( id => join( wireguard_folder, `peer${ id }` ) )
        log.info( `Deleting wireguard configs: ${ ids.join( ', ' ) }` )
        await Promise.allSettled( folder_paths.map( path => fs.rm( path, { recursive: true } ) ) )
        log.info( `Deleted wireguard configs: ${ ids.join( ', ' ) }` )
    } catch ( e ) {
        log.error( `Error in delete_wireguard_configs:`, e )
    }

}

/**
 * Restart the WireGuard container.
 * 
 * This function attempts to restart a Docker container named "wireguard".
 * It logs the result if successful, and logs an error if the restart fails.
 * 
 * @async
 * @function restart_wg_container
 * @returns {Promise<void>} A promise that resolves when the container is restarted.
 * @throws Will throw an error if the Docker command fails.
 */
export async function restart_wg_container() {

    // Restart the wireguard container, note that this relies on the container being named "wireguard"
    try {
        const result = await new Promise( ( resolve, reject ) => {
            exec( `docker restart wireguard`, ( error, stdout, stderr ) => {
                if( error ) return reject( error )
                if( stderr ) return reject( stderr )
                resolve( stdout )
            } )
        } )
        log.info( `Restarted wireguard container`, result )
    } catch ( e ) {
        log.error( `Error in restart_wg_container:`, e )
    }
}


/**
 * Retrieves a valid WireGuard configuration.
 *
 * @param {Object} options - The options for the WireGuard configuration.
 * @param {number} [options.lease_minutes=60] - The lease duration in minutes.
 * @returns {Promise<Object>} A promise that resolves to an object containing the WireGuard configuration.
 * @returns {string} return.peer_config - The WireGuard peer configuration.
 * @returns {number} return.peer_id - The ID of the registered WireGuard lease.
 * @returns {number} return.peer_slots - The number of WireGuard peer slots.
 * @returns {number} return.expires_at - The expiration timestamp of the lease.
 */
export async function get_valid_wireguard_config( { lease_minutes=60 } ) {

    // Check if wireguard server is ready
    const wg_ready = await wireguard_server_ready()
    log.info( `Wireguard server ready: ${ wg_ready }` )
    
    // Count amount of wireguard configs
    log.info( 'Counting wireguard configs' )
    const peer_slots = await count_wireguard_configs()
    
    // Get a valid wireguard config slot
    const expires_at = Date.now() + lease_minutes * 60_000
    log.info( `Requesting wireguard lease with expiration ${ expires_at }` )
    const peer_id = await register_wireguard_lease( { expires_at, end_id: peer_slots } )
    log.info( `Registered wireguard lease with ID ${ peer_id }` )
    
    // Read the peer config file
    log.info( `Reading peer${ peer_id } config file` )
    const peer_config = await fs.readFile( `./wireguard/peer${ peer_id }/peer${ peer_id }.conf`, 'utf8' )
    log.info( `Read peer${ peer_id }.conf config file` )

    return { peer_config, peer_id, peer_slots, expires_at }
    
}