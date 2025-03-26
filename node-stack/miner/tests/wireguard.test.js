import { wait_for_server_up } from "./helpers"
import { describe, test, expect } from 'vitest'
import fetch from 'node-fetch'
import 'dotenv/config'
const { CI_MODE } = process.env
if( !CI_MODE ) console.log( '🚨 CI_MODE is not set, it really should be' )

describe( 'Wireguard endpoint', () => {

    test( 'Can release a new wireguard config', { timeout: 60_000 }, async () => {

        // Wait for sever to be up
        console.log( 'Waiting for server to be up' )
        await wait_for_server_up()
        console.log( 'Server is up' )

        // Can retreive new wireguard config
        const lease_min = CI_MODE ? .5 : 5
        const response = await fetch( `http://localhost:3001/wireguard/new?geo=any&lease_minutes=${ lease_min }` ).then( r => r.json() )
        console.log( 'Response: ', response )

        // Expect properties peer-slots, peer_config, peer_id
        expect( response ).toHaveProperty( 'peer_slots' )
        expect( response ).toHaveProperty( 'peer_config' )
        expect( response ).toHaveProperty( 'peer_id' )
        expect( response ).toHaveProperty( 'expires_at' )

    } )

    test( 'Errors when configs run out', { timeout: 60_000 }, async () => {

        // Exhaust the config pool
        const expected_configs = 5
        const requests = [ ...new Array( expected_configs ) ].map( f => fetch( 'http://localhost:3001/wireguard/new?geo=any&lease_minutes=1' ) )
        const exhausted_responses = await Promise.all( requests )

        // Log the statuses of the exhausted_responses
        const statuses = exhausted_responses.map( r => r.status )
        const responses = await Promise.all( exhausted_responses.map( r => r.json() ) )
        console.log( 'Statuses: ', statuses, responses )

        // Expect a status 500 with { error: 'Internal server error' }
        const attempt = await fetch( 'http://localhost:3001/wireguard/new?geo=any&lease_minutes=.1' )
        const response = await attempt.json()
        // console.log( 'Attempt: ', attempt.status, response )
        expect( attempt.status ).toBe( 500 )
        expect( response ).toEqual( { error: 'Internal server error' } )

    } )

} )
