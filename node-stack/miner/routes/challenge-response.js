import { Router } from 'express'
import { log, make_retryable } from 'mentie'
import fetch from 'node-fetch'
import { get_valid_wireguard_config } from '../modules/wireguard.js'
export const router = Router()


router.post( '/', async ( req, res ) => {

    const handle_route = async () => {

        // Get url paramater from post request
        const { url } = req.body
        log.info( `Received url: ${ url }` )
            
        // Check if the url is valid
        if( !url ) return res.status( 400 ).send( 'No url provided' )
        if( !url.startsWith( 'http' ) ) return res.status( 400 ).send( 'Invalid url' )
            
        // Get the { response } from the url body
        const response_to_challenge = await fetch( url )
        const { response } = await response_to_challenge.json()
        log.info( `Response from ${ url }: ${ response }` )

        // Generate a valid wireguard config
        const wireguard_config = await get_valid_wireguard_config( { lease_minutes: 10 } ) 
        log.info( `Generated wireguard config:`, wireguard_config )

        // Call the challenge-response API with the wireguard config in POST body
        const solution_url = `${ url }/${ response }`
        log.info( `Calling solution and offering vpn config to validator: ${ solution_url }` )
        const solution_res = await fetch( solution_url, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify( { wireguard_config } )
        } )
        const score = await solution_res.json()
        log.info( `Solution score reported by the validator:`, score )
            
        // Send the score back to the client
        return res.json( { ...score, response } )

    }

    try {

        const retryable_handler = await make_retryable( handle_route, { retry_times: 10, cooldown_in_s: 5, cooldown_entropy: true } )
        return retryable_handler()

    } catch ( error ) {
        log.error( `Error in challenge-response: ${ error }` )
        return res.status( 500 ).json( { error: 'Internal server error' } )
    }

} )

router.get( '/', ( req, res ) => res.send( 'Challenge-response router' ) )