import postgres from 'pg'
import { cache, log } from 'mentie'

// Create a connection pool to the postgres container
const { POSTGRES_PASSWORD='setthispasswordinthedotenvfile', POSTGRES_HOST='postgres', POSTGRES_PORT=5432, POSTGRES_USER='postgres', CI_MODE } = process.env
const { Pool } = postgres
log.info( `Connecting to postgres at ${ POSTGRES_USER }@${ POSTGRES_HOST }:${ POSTGRES_PORT } -p ${ POSTGRES_PASSWORD }` )
const pool = new Pool( {
    user: POSTGRES_USER,
    host: POSTGRES_HOST,
    database: 'postgres',
    password: POSTGRES_PASSWORD,
    port: POSTGRES_PORT
} )

// Stale setting for database queries
const epoch_minutes = 72
const ms_to_stale = 60_000 * ( epoch_minutes * 2 )
const stale_timestamp = Date.now() - ms_to_stale

export async function init_tables() {


    // In dev, delete old table
    if( CI_MODE ) {
        log.info( 'Dropping old table, in CI mode' )
        await pool.query( `DROP TABLE IF EXISTS timestamps` )
        await pool.query( `DROP TABLE IF EXISTS challenges` )
        await pool.query( `DROP TABLE IF EXISTS ip_addresses` )
        await pool.query( `DROP TABLE IF EXISTS scores` )
    }


    /* //////////////////////
    // Create tables if they don't exist
    ////////////////////// */

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
            miner_uid TEXT,
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

    // Create table for scores
    await pool.query( `
        CREATE TABLE IF NOT EXISTS scores (
            challenge TEXT,
            correct BOOLEAN,
            score BIGINT,
            speed_score BIGINT,
            uniqueness_score BIGINT,
            country_uniqueness_score BIGINT,
            solved_at BIGINT
        )
    ` )

    /* //////////////////////
    // Backwards iompatibility
    ////////////////////// */

    // Check if the challenges database has a miner_uid column, if not, add it
    const result = await pool.query( `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name='challenges' AND column_name='miner_uid'
    ` )
    if( result.rows.length == 0 ) {
        log.info( 'Adding miner_uid column to challenges table' )
        await pool.query( `ALTER TABLE challenges ADD COLUMN miner_uid TEXT` )
    }

    log.info( 'Tables initialized' )
}

export async function save_ip_address_and_return_ip_stats( { ip_address, country } ) {

    log.info( `Saving IP address ${ ip_address } with country ${ country }` )

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

export async function save_challenge_response( { challenge, response, miner_uid='unknown' } ) {
    // Save the challenge response; errors if challenge already exists
    log.info( 'Saving challenge response:', { challenge, response, miner_uid } )
    await pool.query(
        `INSERT INTO challenges (challenge, response, miner_uid, created) VALUES ($1, $2, $3, $4)`,
        [ challenge, response, miner_uid, Date.now() ]
    )
    return { challenge, response, miner_uid }
}

export async function get_challenge_response( { challenge } ) {
    
    // Retrieve challenge response and creation time
    const query = `SELECT response, miner_uid, created FROM challenges WHERE challenge = $1 LIMIT 1`
    log.info( 'Querying for challenge response:', query, [ challenge ] )
    const result = await pool.query(
        query,
        [ challenge ]
    )
    log.info( 'Query result:', result.rows )
    return result.rows.length > 0 ? result.rows[0] : {}
}

export async function mark_challenge_solved( { challenge, read_only=false } ) {

    const now = Date.now()
    // Update the solved field if it hasn't been set yet
    if( !read_only ) await pool.query(
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
    const result = await pool.query(
        `SELECT country FROM ip_addresses WHERE updated > $1`,
        [ stale_timestamp ]
    )

    // Reduce this to a per-country count
    log.info( `Received ${ result.rows.length } ip addresses, collating by country` )
    const country_counts = result.rows.reduce( ( acc, { country } ) => {
        acc[country] = ( acc[country] || 0 ) + 1
        return acc
    }, {} )
    log.info( `Country counts:`, country_counts )

    return cache( cache_key, country_counts, 60_000 )

}

export async function save_challenge_response_score( { correct, challenge, score, speed_score, uniqueness_score, country_uniqueness_score, solved_at }={} ) {

    // Round all numbers to nearest integer
    score = Math.round( score )
    speed_score = Math.round( speed_score )
    uniqueness_score = Math.round( uniqueness_score )
    country_uniqueness_score = Math.round( country_uniqueness_score )

    // Save score
    log.info( 'Saving score:', { correct, challenge, score, speed_score, uniqueness_score, country_uniqueness_score, solved_at } )
    await pool.query(
        `INSERT INTO scores (challenge, correct, score, speed_score, uniqueness_score, country_uniqueness_score, solved_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [ challenge, correct, score, speed_score, uniqueness_score, country_uniqueness_score, solved_at ]
    )
    log.info( 'Score saved:', { challenge, correct, score, speed_score, uniqueness_score, country_uniqueness_score, solved_at } )

    return { correct, score, speed_score, uniqueness_score, country_uniqueness_score, solved_at }

}

export async function get_challenge_response_score( { challenge } ) {

    // Retrieve the score for the given challenge
    log.info( `Querying for challenge response score ${ challenge }` )
    const result = await pool.query(
        `SELECT correct, score, speed_score, uniqueness_score, country_uniqueness_score, solved_at FROM scores WHERE challenge = $1 ORDER BY solved_at ASC LIMIT 1`,
        [ challenge ]
    )
    log.info( `Query result for challenge response score ${ challenge }:`, result.rows )

    const default_values = {
        correct: false,
        score: 0,
        speed_score: 0,
        uniqueness_score: 0,
        country_uniqueness_score: 0,
        solved_at: 0,
        error: 'No score found'
    }
    return result.rows.length > 0 ? result.rows[0] : default_values

}


export async function get_ips_by_country( { geo }={} ) {

    // Get nonstale ips, sort by timestamp where more recent is higher
    let query = `SELECT ip_address FROM ip_addresses WHERE updated > $1 ORDER BY updated DESC`
    if( geo ) query = `SELECT ip_address FROM ip_addresses WHERE country = $1 AND updated > $2 ORDER BY updated DESC`
    const variables = geo ? [ geo, stale_timestamp ] : [ stale_timestamp ]
    log.info( `Querying for IPs by country: ${ geo }: `, query, variables )
    const result = await pool.query(
        query,
        variables
    )
    const ips = result.rows.map( row => row.ip_address )
    log.info( `Query result for IPs by country ${ geo }:`, ips )

    return ips

}