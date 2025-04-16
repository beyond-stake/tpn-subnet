import { Router } from 'express'
import { log, make_retryable } from 'mentie'
import { get_valid_wireguard_config } from '../modules/wireguard.js'
import { request_is_local } from '../modules/network.js'
import { is_validator } from '../modules/metagraph.js'
export const router = Router()
const { CI_MODE } = process.env

router.get( '/', ( req, res ) => res.send( 'Wireguard router' ) )

router.get( '/new', async ( req, res ) => {

    // Before anything else, check if this is a call from a validator or local machine
    const is_local = request_is_local( req )
    const validator = is_validator( req )
    if( !validator && !is_local ) {
        log.info( `Request is not from a validator, nor from local, returning 403` )
        return res.status( 403 ).json( { error: 'Only validators may call this endpoint, please read the public API documentation' } )
    }
    log.info( `Wireguard config request is from validator ${ validator.uid } with ip ${ validator.ip } (local: ${ is_local })` )


    const handle_route = async () => {

        // Get properties from query string
        const { geo, lease_minutes } = req.query
        log.info( `Received request for new wireguard config with geo ${ geo } and lease_minutes ${ lease_minutes }` )

        // Check if properties are valid
        if( !geo || !lease_minutes ) return res.status( 400 ).json( { error: 'Missing geo or lease_minutes' } )

        // Lease must be between 5 and 60 minutes
        const lease_min = CI_MODE ? .1 : .5
        const lease_max = 60
        if( lease_min > lease_minutes || lease_minutes > lease_max ) return res.status( 400 ).json( { error: 'Lease must be between .5 and 60 minutes' } )
        
        // Get a valid WireGuard configuration, note: this endpoint should never receive the validator-dedicated files (used for challenge-response), so we are NOT setting the validator property
        const { peer_config, peer_id, peer_slots, expires_at } = await get_valid_wireguard_config( { validator: null, lease_minutes } )

        return res.json( { peer_slots, peer_config, peer_id, expires_at } )

    }

    try {

        const { CI_MODE } = process.env
        const retry_times = CI_MODE ? 1 : 2
        const retryable_handler = await make_retryable( handle_route, { retry_times, cooldown_in_s: 2, cooldown_entropy: true } )
        await retryable_handler()

    } catch ( error ) {
        log.error( `Error in wireguard /new: ${ error }` )
        return res.status( 500 ).json( { error: 'Internal server error' } )
    }

} )

