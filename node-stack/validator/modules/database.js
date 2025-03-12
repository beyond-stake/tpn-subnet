import postgres from 'pg'
import { cache, log } from 'mentie'

// Create a connection pool to the postgres container
const { POSTGRES_PASSWORD, POSTGRES_HOST='postgres', POSTGRES_PORT=5432, POSTGRES_USER='postgres', CI_MODE } = process.env
const { Pool } = postgres
log.info( `Connecting to postgres at ${ POSTGRES_USER }@${ POSTGRES_HOST }:${ POSTGRES_PORT }` )
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
        await pool.query( `DROP TABLE IF EXISTS timestamps` )
        await pool.query( `DROP TABLE IF EXISTS challenges` )
        await pool.query( `DROP TABLE IF EXISTS ip_addresses` )
    }

    // Create table for timestamps
    await pool.query( `
        CREATE TABLE IF NOT EXISTS timestamps (
            label TEXT PRIMARY KEY,
            timestamp BIGINT,
            updated BIGINT
        )
    ` )

    // Create table for challenges
    await pool.query( `
        CREATE TABLE IF NOT EXISTS challenges (
            challenge TEXT PRIMARY KEY,
            response TEXT,
            created BIGINT,
            solved BIGINT
        )
    ` )

    // Create table for IP addresses
    await pool.query( `
        CREATE TABLE IF NOT EXISTS ip_addresses (
            ip_address TEXT PRIMARY KEY,
            country TEXT,
            updated BIGINT
        )
    ` )
}

export async function save_ip_address_and_return_ip_stats( { ip_address, country } ) {
    const ms_to_stale = 1000 * 60 * 30
    const stale_timestamp = Date.now() - ms_to_stale

    // Count all non-stale IP addresses
    const ipCountResult = await pool.query(
        `SELECT COUNT(*) AS count FROM ip_addresses WHERE updated > $1`,
        [ stale_timestamp ]
    )
    const ip_count = parseInt( ipCountResult.rows[0].count, 10 ) || 0
    log.info( `Total ip addresses: ${ ip_count }` )

    // Count non-stale IP addresses in the same country
    log.info( `Checking for ip addresses in the same country: ${ country }` )
    const countryCountResult = await pool.query(
        `SELECT COUNT(*) AS count FROM ip_addresses WHERE country = $1 AND updated > $2`,
        [ country, stale_timestamp ]
    )
    const country_count = parseInt( countryCountResult.rows[0].count, 10 ) || 0
    log.info( `Total ip addresses in the same country: ${ country_count }` )

    // Calculate the percentage, guarding against division by zero
    const ip_pct_same_country = ip_count ? Math.round(  country_count / ip_count  * 100 ) : 0
    log.info( `Percentage of ip addresses in the same country: ${ ip_pct_same_country }` )

    // Insert or update the IP address record
    await pool.query(
        `INSERT INTO ip_addresses (ip_address, country, updated) VALUES ($1, $2, $3)
        ON CONFLICT (ip_address)
        DO UPDATE SET country = $4, updated = $5`,
        [ ip_address, country, Date.now(), country, Date.now() ]
    )

    return { ip_count, country_count, ip_pct_same_country }
}

export async function get_timestamp( { label } ) {
    // Retrieve the timestamp for the given label
    const result = await pool.query(
        `SELECT timestamp FROM timestamps WHERE label = $1 LIMIT 1`,
        [ label ]
    )
    return result.rows.length > 0 ? result.rows[0].timestamp : 0
}

export async function set_timestamp( { label, timestamp } ) {
    // Insert or update the timestamp record
    await pool.query(
        `INSERT INTO timestamps (label, timestamp, updated) VALUES ($1, $2, $3)
        ON CONFLICT (label)
        DO UPDATE SET timestamp = $4, updated = $5`,
        [ label, timestamp, Date.now(), timestamp, Date.now() ]
    )
    log.info( 'Timestamp set:', { label, timestamp } )
}

export async function save_challenge_response( { challenge, response } ) {
    // Save the challenge response; errors if challenge already exists
    await pool.query(
        `INSERT INTO challenges (challenge, response, created) VALUES ($1, $2, $3)`,
        [ challenge, response, Date.now() ]
    )
    return { challenge, response }
}

export async function get_challenge_response( { challenge } ) {
    // Retrieve challenge response and creation time
    const query = `SELECT response, created FROM challenges WHERE challenge = $1 LIMIT 1`
    log.info( 'Querying for challenge response:', query, [ challenge ] )
    const result = await pool.query(
        query,
        [ challenge ]
    )
    return result.rows.length > 0 ? result.rows[0] : {}
}

export async function mark_challenge_solved( { challenge } ) {
    const now = Date.now()
    // Update the solved field if it hasn't been set yet
    await pool.query(
        `UPDATE challenges SET solved = $1 WHERE challenge = $2 AND solved IS NULL`,
        [ now, challenge ]
    )
    // Retrieve the updated solved timestamp
    const result = await pool.query(
        `SELECT solved FROM challenges WHERE challenge = $1 LIMIT 1`,
        [ challenge ]
    )
    return result.rows.length > 0 ? Number( result.rows[0].solved ) : null
}

export async function get_miner_stats() {

    // Check for cached value
    const cache_key = 'miner_stats'
    const cached_value = cache( cache_key )
    if( cached_value ) return cached_value

    // Get all ip addresses with a country that are not stale
    const ms_to_stale = 1000 * 60 * 30
    const stale_timestamp = Date.now() - ms_to_stale
    const result = await pool.query(
        `SELECT country FROM ip_addresses WHERE updated > $1`,
        [ stale_timestamp ]
    )

    // Reduce this to a per-country count
    const country_counts = result.rows.reduce( ( acc, { country } ) => {
        acc[country] = ( acc[country] || 0 ) + 1
        return acc
    }, {} )

    return cache( cache_key, country_counts,  5 * 60_000 )

}