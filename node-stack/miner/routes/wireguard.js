import { Router } from 'express'
import { log, make_retryable } from 'mentie'
import { get_valid_wireguard_config } from '../modules/wireguard.js'
import { request_is_local } from '../modules/network.js'
export const router = Router()
const { CI_MODE } = process.env

router.get( '/', ( req, res ) => res.send( 'Wireguard router' ) )

router.get( '/new', async ( req, res ) => {

    const handle_route = async () => {

        // Get properties from query string
        const { geo, lease_minutes } = req.query
        log.info( `Received request for new wireguard config with geo ${ geo } and lease_minutes ${ lease_minutes }` )

        // Log out local status
        const is_local = request_is_local( req )
        log.info( `Request is local: ${ is_local }` )

        // Check if properties are valid
        if( !geo || !lease_minutes ) return res.status( 400 ).json( { error: 'Missing geo or lease_minutes' } )

        // Lease must be between 5 and 60 minutes
        const lease_min = CI_MODE ? .1 : 5
        const lease_max = 60
        if( lease_min > lease_minutes || lease_minutes > lease_max ) return res.status( 400 ).json( { error: 'Lease must be between 5 and 60 minutes' } )
        
        // Get a valid WireGuard configuration
        const { peer_config, peer_id, peer_slots, expires_at } = await get_valid_wireguard_config( { lease_minutes } )

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

