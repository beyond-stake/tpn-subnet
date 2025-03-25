import { Router } from "express"
import { generate_challenge, solve_challenge } from "../modules/challenge.js"
import { score_request_uniqueness } from "../modules/scoring.js"
import { get_challenge_response } from "../modules/database.js"
import { cache, log, make_retryable } from "mentie"
import { base_url } from "../modules/url.js"
import { validate_wireguard_config } from "../modules/wireguard.js"
export const router = Router()

// Generate challenge route
router.get( "/new", async ( req, res ) => {

    try {

        // Generate a new challenge
        const challenge = await generate_challenge()

        // Formulate public challenge URL
        const challenge_url = `${ base_url }/challenge/${ challenge }`

        return res.json( { challenge, challenge_url } )

    } catch ( e ) {

        log.error( e )
        return res.status( 500 ).json( { error: e.message } )

    }

} )

// Challenge route
// :challenge only - return the response for the challenge
// :challenge and :response - validate the response and return the score
// 🚨 NOTE: part of this function is legacy code from the challenge-response only version of the subnet. After a grace period this requires refactoring
router.get( "/:challenge/:response?", async ( req, res ) => {

    const handle_route = async () => {


        // Extract challenge and response from request
        const { challenge, response } = req.params

        // If only the challenge is provided, return the response
        if( !response ) {

            const cached_value = cache( `challenge_solution_${ challenge }` )
            if( cached_value ) return res.json( { response: cached_value.response } )

            const challenge_response = await get_challenge_response( { challenge } )
            if( !cached_value ) cache( `challenge_solution_${ challenge }`, challenge_response )

            log.info( `Returning challenge response for challenge ${ challenge }: `, challenge_response )
            return res.json( { response: challenge_response.response } )

        }

        // Check for cached value
        const cached_value = cache( `solution_score_${ challenge }` )
        if( cached_value ) {
            log.info( `Returning cached value for solution ${ challenge }` )
            return res.json( cached_value )
        }

        // Validate the response
        const { correct, ms_to_solve, solved_at } = await solve_challenge( { challenge, response } )

        // If not correct, return false
        if( !correct ) return res.json( { correct } )

        // If correct, score the request
        const uniqueness_score = await score_request_uniqueness( req )
        if( uniqueness_score === undefined ) return res.status( 500 ).json( { error: 'Nice try' } )

        // Score based on delay, with a grace period, and a punishment per ms above it
        log.info( `Time to solve ${ challenge }: ${ ms_to_solve } (${ solved_at })` )
        const s_to_solve = ms_to_solve / 1000
        const penalty = Math.min( 100, 2 ** s_to_solve - 1 )
        const speed_score = 100 - penalty

        // Composite score, average of uniqueness and speed
        const score = Math.round( ( uniqueness_score + speed_score ) / 2 )

        // Formulate and cache response
        const data = { correct, score, speed_score, uniqueness_score, solved_at }
        cache( `solution_score_${ challenge }`, data )

        return res.json( data )

    }

    try {

        const retryable_handler = await make_retryable( handle_route, { retry_times: 2, cooldown_in_s: 10, cooldown_entropy: false } )
        return retryable_handler()
        
    } catch ( e ) {

        log.error( `Error handling challenge/response routes, returning 500 response. Error:`, e )
        return res.status( 500 ).json( { error: e.message } )

    }
} )

// Wireguard challenge response route
// :challenge only - return the response for the challenge
// :challenge and :response - validate the response and return the score, expects a wireguard_config object in the request body
router.post( "/:challenge/:response", async ( req, res ) => {

    const handle_route = async () => {


        // Extract challenge and response from request
        const { challenge, response } = req.params
        if( !challenge || !response ) return res.status( 400 ).json( { error: 'Missing challenge or response' } )

        // Extact wireguard config from request
        const { wireguard_config={} } = req.body || {}
        const { peer_config, peer_id, peer_slots, expires_at } = wireguard_config

        // Validate existence of wireguard config fields
        if( !peer_config || !peer_id || !peer_slots || !expires_at ) {
            log.info( `Bad challenge/response ${ challenge }/${ response } with body:`, req.body )
            return res.status( 400 ).json( { error: 'Missing wireguard config fields' } )
        }

        // Validate the challenge solution
        log.info( `Validating challenge solution for ${ challenge }/${ response }` )
        const { correct, ms_to_solve, solved_at } = await solve_challenge( { challenge, response } )

        // If not correct, return false
        if( !correct ) return res.json( { correct } )

        // If correct, score the request
        const uniqueness_score = await score_request_uniqueness( req )
        if( uniqueness_score === undefined ) return res.status( 500 ).json( { error: 'Nice try' } )

        // Upon solution success, test the wireguard config
        const wireguard_valid = await validate_wireguard_config( { peer_config, peer_id } )
        if( !wireguard_valid ) {
            log.info( `Wireguard config for peer ${ peer_id } failed challenge` )
            return res.json( { correct: false } )
        }

        // Score based on delay, with a grace period, and a punishment per ms above it
        log.info( `Time to solve ${ challenge }: ${ ms_to_solve } (${ solved_at })` )
        const s_to_solve = ms_to_solve / 1000
        const penalty = Math.min( 100, 2 ** s_to_solve - 1 )
        const speed_score = 100 - penalty

        // Composite score, average of uniqueness and speed
        const score = Math.round( ( uniqueness_score + speed_score ) / 2 )

        // Formulate and cache response
        const data = { correct, score, speed_score, uniqueness_score, solved_at }
        cache( `solution_score_${ challenge }`, data )

        return res.json( data )

    }

    try {

        const retryable_handler = await make_retryable( handle_route, { retry_times: 2, cooldown_in_s: 10, cooldown_entropy: false } )
        return retryable_handler()
        
    } catch ( e ) {

        log.error( `Error handling challenge/response routes, returning 500 response. Error:`, e )
        return res.status( 500 ).json( { error: e.message } )

    }
} )