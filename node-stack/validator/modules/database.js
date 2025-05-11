import postgres from 'pg'
import { log } from 'mentie'

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
const epoch_length_in_blocks = 300
const block_time = 12
const epoch_seconds = epoch_length_in_blocks * block_time
const epochs_until_stale = 1
const ms_to_stale = 1_000 * epoch_seconds * epochs_until_stale
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

    // Create payment events table
    await pool.query( `
        CREATE TABLE IF NOT EXISTS payment_events (
            account_hash TEXT,
            account_password TEXT,
            used BOOLEAN
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

// export async function save_ip_address_and_return_ip_stats( { ip_address, country, save_ip=false } ) {

//     log.info( `Saving IP address ${ ip_address } with country ${ country }` )

//     // Count all non-stale IP addresses
//     const ip_count_result = await pool.query(
//         `SELECT COUNT(*) AS count FROM ip_addresses WHERE updated > $1`,
//         [ stale_timestamp ]
//     )
//     const ip_count = parseInt( ip_count_result.rows[0].count, 10 ) || 0
//     log.info( `Total ip addresses: ${ ip_count }` )

//     // Get all non-stale IP addresses in the same country
//     log.info( `Checking for ip addresses in the same country: ${ country }` )
//     const ips_in_same_country_result = await pool.query(
//         `SELECT ip_address FROM ip_addresses WHERE country = $1 AND updated > $2`,
//         [ country, stale_timestamp ]
//     )
//     const ips_in_same_country = ips_in_same_country_result.rows.map( row => row.ip_address )
//     const country_count = ips_in_same_country.length || 0
//     log.info( `Total ip addresses in the same country: ${ country_count }` )

//     // Calculate the percentage, guarding against division by zero
//     const ip_pct_same_country = ip_count ? Math.round( country_count / ip_count  * 100 ) : 0
//     log.info( `Percentage of ip addresses in the same country: ${ ip_pct_same_country }` )

//     // Insert or update the IP address record
//     if( save_ip ) {
//         log.info( `Saving IP address ${ ip_address } to the database` )
//         await pool.query(
//             `INSERT INTO ip_addresses (ip_address, country, updated) VALUES ($1, $2, $3)
//             ON CONFLICT (ip_address)
//             DO UPDATE SET country = $4, updated = $5`,
//             [ ip_address, country, Date.now(), country, Date.now() ]
//         )
//     } else {
//         log.info( `Not saving IP address ${ ip_address } to the database` )
//     }

//     // Debug logging
//     log.info( `${ ip_address } is in ${ country }, others: `, ips_in_same_country.join( ', ' ) )

//     return { ip_count, country_count, ip_pct_same_country, ips_in_same_country }
// }

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

export async function save_challenge_response_score( { correct, challenge, score, speed_score, uniqueness_score, country_uniqueness_score, solved_at }={} ) {

    // Round all numbers to nearest integer
    score = Math.round( score )
    speed_score = Math.round( speed_score )
    uniqueness_score = Math.round( uniqueness_score )
    country_uniqueness_score = Math.round( country_uniqueness_score )

    // Save score
    log.info( `Saving score for ${ challenge }:`, { correct, challenge, score, speed_score, uniqueness_score, country_uniqueness_score, solved_at } )
    await pool.query(
        `INSERT INTO scores (challenge, correct, score, speed_score, uniqueness_score, country_uniqueness_score, solved_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [ challenge, correct, score, speed_score, uniqueness_score, country_uniqueness_score, solved_at ]
    )
    log.info( `Score saved for ${ challenge }:`, { challenge, correct, score, speed_score, uniqueness_score, country_uniqueness_score, solved_at } )

    // TEMPORARY DEBUGGING, read the entry we just wrote
    const result = await pool.query(
        `SELECT correct, score, speed_score, uniqueness_score, country_uniqueness_score, solved_at FROM scores WHERE challenge = $1 ORDER BY solved_at ASC LIMIT 1`,
        [ challenge ]
    )
    log.info( `Reading back saved score for ${ challenge }`, result.rows )

    return { correct, score, speed_score, uniqueness_score, country_uniqueness_score, solved_at }

}

export async function get_challenge_response_score( { challenge } ) {

    // Retrieve the score for the given challenge
    log.info( `Querying for challenge response score ${ challenge }` )
    const result = await pool.query(
        `SELECT correct, score, speed_score, uniqueness_score, country_uniqueness_score, solved_at FROM scores WHERE challenge = $1 ORDER BY solved_at ASC LIMIT 1`,
        [ challenge ]
    )

    const default_values = {
        correct: false,
        score: 0,
        speed_score: 0,
        uniqueness_score: 0,
        country_uniqueness_score: 0,
        solved_at: 0,
        error: 'No score found'
    }

    const data_to_return = result.rows.length > 0 ? result.rows[0] : default_values

    log.info( `Query result for challenge response score ${ challenge }:`, result.rows, data_to_return )

    return data_to_return

}

export async function save_account_hash( { account_hash, account_password, used=true } ) {

    // Save the account hash and password
    log.info( 'Saving account hash:', { account_hash, used } )
    await pool.query(
        `INSERT INTO payment_events (account_hash, account_password, used) VALUES ($1, $2, $3)`,
        [ account_hash, account_password, used ]
    )
    log.info( 'Account hash saved:', { account_hash, used } )
    return { account_hash, used }

}

export async function get_account_hash( { account_hash } ) {
    
    // Retrieve the account hash
    log.info( 'Querying for account hash:', { account_hash } )
    const result = await pool.query(
        `SELECT account_hash, account_password, used FROM payment_events WHERE account_hash = $1 LIMIT 1`,
        [ account_hash ]
    )
    log.info( 'Query result:', result.rows )
    return result.rows[0]
}
