import postgres from 'pg'
import { log, cache, wait } from 'mentie'
import { delete_wireguard_configs, restart_wg_container, wireguard_server_ready } from './wireguard.js'
const { CI_MODE } = process.env

// Create a connection pool to the postgres container
const { POSTGRES_PASSWORD, POSTGRES_HOST='postgres', POSTGRES_PORT=5432, POSTGRES_USER='postgres' } = process.env
log.info( `Connecting to postgres at ${ POSTGRES_USER }@${ POSTGRES_HOST }:${ POSTGRES_PORT } -p ${ POSTGRES_PASSWORD }` )
const { Pool } = postgres
const pool = new Pool( {
    user: POSTGRES_USER,
    host: POSTGRES_HOST,
    database: 'postgres',
    password: POSTGRES_PASSWORD,
    port: POSTGRES_PORT
} )

export async function init_tables() {

    // In dev, delete old table
    if( CI_MODE ) {
        log.info( 'Dropping old table, in CI mode' )
        await pool.query( `DROP TABLE IF EXISTS miner_wireguard_configs` )
    }

    // Create table for wireguard config leases
    await pool.query( `
        CREATE TABLE IF NOT EXISTS miner_wireguard_configs (
            id SERIAL PRIMARY KEY,
            expires_at BIGINT NOT NULL,
            updated_at TIMESTAMP NOT NULL
        )
    ` )

}

/**
 * Registers a WireGuard lease in the database.
 *
 * @param {Object} params - The parameters for the function.
 * @param {number} [params.start_id=1] - The starting ID to check for availability.
 * @param {number} [params.end_id=250] - The ending ID to check for availability.
 * @param {string} params.expires_at - The expiration date for the WireGuard lease.
 * @returns {Promise<Object>} result - A promise that resolves to an object containing the next available ID and whether the ID was recycled
 * @returns {number} result.next_available_id - The next available ID for the WireGuard lease.
 * @returns {boolean} result.recycled - Whether the ID was recycled from an expired lease.
 * @throws {Error} If no available WireGuard config slots are found within the specified range.
 */
export async function register_wireguard_lease( { start_id=1, end_id=250, expires_at } ) {

    log.info( `Registering WireGuard lease between ${ start_id } and ${ end_id }, expires at ${ expires_at }` )

    // Mitigate race contitions
    let working = cache( `register_wireguard_lease_working` )
    while( working ) {
        log.info( `Waiting for register_wireguard_lease to finish` )
        await wait( 1000 )
        working = cache( `register_wireguard_lease_working` )
        log.info( `Working: ${ working }` )
    }
    cache( `register_wireguard_lease_working`, true, 10_000 )

    // Find all expired rows
    log.info( 'Checking for expired rows' )
    const expired_rows = await pool.query( `SELECT id FROM miner_wireguard_configs WHERE expires_at < $1`, [ Date.now() ] )
    log.info( `Expired rows: ${ expired_rows.rows.map( row => row.id ).join( ', ' ) }` )

    // Delete all expired rows and their associated configs
    const expired_ids = expired_rows.rows.map( row => row.id )
    const { WIREGUARD_PEER_COUNT=250 } = process.env
    if( expired_ids.length == WIREGUARD_PEER_COUNT ) {

        log.info( `All ${ WIREGUARD_PEER_COUNT } WireGuard configs have expired, deleting all and restarting server` )

        // Delete and restart the wireguard server
        await delete_wireguard_configs( expired_ids )
        await restart_wg_container()

        // Delete the expired rows from the database
        await pool.query( `DELETE FROM miner_wireguard_configs WHERE id = ANY( $1::int[] )`, [ expired_ids ] )

    }

    // Check if there is an id that does not yet exist between the start and end id
    log.info( `Checking for available id between ${ start_id } and ${ end_id }` )
    let id = start_id
    while( id <= end_id ) {
        const existing_id = await pool.query( `SELECT id FROM miner_wireguard_configs WHERE id = $1`, [ id ] )
        if( !existing_id.rows.length ) break
        id++
    }
    let next_available_id = id > end_id ? null : id
    log.info( `Next available empty id: ${ next_available_id }` )

    // If no available id was found, throw an error
    if( !next_available_id ) {

        // Find the expiry timestamp of the row that expires soonest
        const soonest_expiry = await pool.query( `SELECT expires_at FROM miner_wireguard_configs ORDER BY expires_at ASC LIMIT 1` )
        const { expires_at=0 } = soonest_expiry.rows[0] || {}
        const soonest_expiry_s = ( expires_at - Date.now() ) / 1000

        log.warn( `No available WireGuard config slots found between ${ start_id } and ${ end_id }, soonest expiry in ${ Math.floor( soonest_expiry_s / 60 ) } minutes (${ soonest_expiry_s }s)` )
        throw new Error( `No available WireGuard config slots found between ${ start_id } and ${ end_id }` )
    }

    // Insert the new row, make sure that existing rows are updated and not appended
    await pool.query( `
        INSERT INTO miner_wireguard_configs ( id, expires_at, updated_at )
        VALUES ( $1, $2, NOW() )
        ON CONFLICT ( id ) DO UPDATE
        SET expires_at = $2, updated_at = NOW()
    `, [ next_available_id, expires_at ] )

    // Clear the working cache
    cache( `register_wireguard_lease_working`, false )

    // Wait for wireguard server to be ready for this config
    log.info( `Waiting for wireguard server to be ready for id ${ next_available_id }` )
    await wireguard_server_ready( 30_000, next_available_id )

    return next_available_id

}