import { Router } from "express"
export const router = Router()
import { cache, hash, log } from "mentie"
import { get_miner_stats } from "../modules/stats.js"
import { get_config_from_miners } from "../modules/miner_api.js"
import { get_all_payment_events, get_emv_public_client } from "../modules/evm.js"
import { get_account_hash, save_account_hash } from "../modules/database.js"

router.get( "/config/countries", async ( req, res ) => {

    try {

        // Check if we have cached data
        let country_codes = cache(  'country_code_stats' )
        if( country_codes ) return res.json( country_codes )

        // Cache stats
        const stats = await get_miner_stats()
        country_codes = Object.keys( stats )
        log.info( `country_code_stats`, country_codes, 60_000 )

        return res.json( country_codes )
        
    } catch ( e ) {

        log.error( e )
        return res.status( 500 ).json( { error: e.message } )

    }

} )

router.get( '/config/new', async ( req, res ) => {

    try {

        // Get request parameters
        let { geo, lease_minutes, format='json', timeout_ms=5_000 } = req.query
        const { error, ...config } = await get_config_from_miners( { geo, lease_minutes, format, timeout_ms } )

        // If there was an error, return to user
        if( error ) {
            log.info( `Error requesting config:`, error )
            return res.status( 400 ).json( { error } )
        }

        // If no config was found, return an error 
        if( !config ) return res.status( 404 ).json( { error: `No config found for country: ${ geo }` } )
        log.info( `Config found for ${ geo }:`, config )

        // Return the config to the requester
        if( format == 'json' ) return res.json( { ...config } )
        return res.send( config.peer_config )


    } catch ( e ) {

        log.info( `Error requesting config:`, e.message )
        return res.status( 400 ).json( { error: e.message } )

    }

} )

router.get( '/config/new_with_payment', async ( req, res ) => {

    try {

        // Get the request parameters
        const { geo, lease_minutes, format='json', timeout_ms=5_000, account_hash, account_password } = req.query

        // Verify that the password matches the hash
        const hash_match = hash( account_password ) == account_hash
        if( !hash_match ) {
            log.info( `Password hash does not match` )
            return res.status( 400 ).json( { error: `Password hash does not match` } )
        }

        // Check that the provided hash has an even associated with it on chain
        const payment_events = await get_all_payment_events()
        const payment_event = payment_events.find( event => event.args.account_hash == account_hash )
        if( !payment_event ) {
            log.info( `No payment event found for hash:`, account_hash )
            return res.status( 400 ).json( { error: `No payment event found for hash: ${ account_hash }` } )
        }

        // Check the local database to see if we used this payment already
        const account_data = await get_account_hash( { account_hash } )
        if( account_data.used ) {
            log.info( `Account hash already used:`, account_hash )
            return res.status( 400 ).json( { error: `Account hash already used: ${ account_hash }` } )
        }

        // Validate that they payment data matches our requirements
        const { blockNumber, args } = payment_event
        const { netuid, uid, hotkey, payload, paid } = args // where netuid is subnet uid, uid is validator uid, hotkey is validator hotkey, payload can be any string, paid is the amount of TAO paid
        const client = get_emv_public_client()
        const block = await client.getBlock( { blockNumber } )
        const block_time_ms = 12_000
        const event_age = ( Date.now() - block.timestamp * 1000 ) / block_time_ms
        const event_maxage = 60 * 60 * 72
        if( event_age > event_maxage ) {
            log.info( `Payment event is too old:`, event_age )
            return res.status( 400 ).json( { error: `Payment event is too old: ${ event_age }` } )
        }

        // Get the config from the miners
        const { error, ...config } = await get_config_from_miners( { geo, lease_minutes, format, timeout_ms } )

        // If there was an error, return to user
        if( error ) {
            log.info( `Error requesting config:`, error )
            return res.status( 400 ).json( { error } )
        }

        // Mark the account hash as used
        await save_account_hash( { account_hash, used: true } )
        log.info( `Account hash marked as used:`, account_hash )

        // Return the config to the user
        if( format == 'json' ) return res.json( { ...config } )
        return res.send( config.peer_config )



    } catch ( e ) {

        log.info( `Error requesting config:`, e.message )
        return res.status( 400 ).json( { error: e.message } )

    }

} )